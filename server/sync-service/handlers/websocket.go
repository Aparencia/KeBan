package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"keban/sync-service/models"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// ---------- WebSocket upgrader ----------

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins during development; restrict in production.
		return true
	},
}

// ---------- Timing constants ----------

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 65536
)

// ---------- Message protocol ----------

// WSMessage defines the wire format for all WebSocket messages.
type WSMessage struct {
	Type    string          `json:"type"`    // "operation", "ack", "ping", "pong", "sync_request"
	Payload json.RawMessage `json:"payload"`
}

// WSOperationPayload is carried inside "operation" messages pushed to clients.
type WSOperationPayload struct {
	EntityType string      `json:"entityType"`
	EntityID   string      `json:"entityId"`
	Operation  string      `json:"operation"`
	Data       interface{} `json:"data,omitempty"`
	Version    int64       `json:"version"`
	DeviceID   string      `json:"deviceId"` // originating device
}

// WSSyncRequestPayload is sent by clients inside a "sync_request" message.
type WSSyncRequestPayload struct {
	SinceVersion int64 `json:"sinceVersion"`
}

// ---------- Connection ----------

// WSConnection represents a single WebSocket connection bound to a user+device.
type WSConnection struct {
	UserID   string
	DeviceID string
	Conn     *websocket.Conn
	Send     chan []byte
	closed   bool
	mu       sync.Mutex
}

// close safely marks the connection as closed and closes the underlying socket.
func (c *WSConnection) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.closed {
		c.closed = true
		close(c.Send)
		_ = c.Conn.Close()
	}
}

// isClosed returns whether the connection has already been torn down.
func (c *WSConnection) isClosed() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.closed
}

// readPump reads messages from the WebSocket connection.
// It handles ping/pong and incoming sync_request / operation messages.
func (c *WSConnection) readPump() {
	defer func() {
		wsManager.unregister(c)
		c.close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, raw, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("[ws] read error user=%s device=%s: %v", c.UserID, c.DeviceID, err)
			}
			return
		}

		var msg WSMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			log.Printf("[ws] bad message from user=%s device=%s: %v", c.UserID, c.DeviceID, err)
			continue
		}

		switch msg.Type {
		case "ping":
			// Respond with pong.
			pong, _ := json.Marshal(WSMessage{Type: "pong"})
			select {
			case c.Send <- pong:
			default:
			}

		case "sync_request":
			// Client asks for updates since a given version.
			var payload WSSyncRequestPayload
			if err := json.Unmarshal(msg.Payload, &payload); err != nil {
				continue
			}
			ops := fetchOperationsSince(payload.SinceVersion, c.DeviceID)
			data, _ := json.Marshal(ops)
			resp, _ := json.Marshal(WSMessage{Type: "operation", Payload: data})
			select {
			case c.Send <- resp:
			default:
			}

		case "operation":
			// Client-pushed operation over WebSocket (future enhancement).
			// For now, acknowledge receipt.
			ack, _ := json.Marshal(WSMessage{Type: "ack", Payload: msg.Payload})
			select {
			case c.Send <- ack:
			default:
			}
		}
	}
}

// writePump pumps messages from the Send channel to the WebSocket connection.
// It also sends periodic ping frames to keep the connection alive.
func (c *WSConnection) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Channel closed.
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("[ws] write error user=%s device=%s: %v", c.UserID, c.DeviceID, err)
				return
			}

		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ---------- Connection manager ----------

// WSManager keeps track of all live WebSocket connections, indexed by userID → deviceID.
type WSManager struct {
	mu          sync.RWMutex
	connections map[string]map[string]*WSConnection
}

// Global singleton used by handlers.
var wsManager = &WSManager{
	connections: make(map[string]map[string]*WSConnection),
}

// register adds a connection to the manager.
func (m *WSManager) register(c *WSConnection) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.connections[c.UserID]; !ok {
		m.connections[c.UserID] = make(map[string]*WSConnection)
	}
	// Replace any previous connection from the same device.
	if old, exists := m.connections[c.UserID][c.DeviceID]; exists {
		old.close()
	}
	m.connections[c.UserID][c.DeviceID] = c
	log.Printf("[ws] registered user=%s device=%s", c.UserID, c.DeviceID)
}

// unregister removes a connection from the manager.
func (m *WSManager) unregister(c *WSConnection) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if devices, ok := m.connections[c.UserID]; ok {
		if existing, exists := devices[c.DeviceID]; exists && existing == c {
			delete(devices, c.DeviceID)
			log.Printf("[ws] unregistered user=%s device=%s", c.UserID, c.DeviceID)
		}
		if len(devices) == 0 {
			delete(m.connections, c.UserID)
		}
	}
}

// broadcastToUser sends a message to all online devices of a user, optionally excluding one device.
func (m *WSManager) broadcastToUser(userID string, excludeDeviceID string, message []byte) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	devices, ok := m.connections[userID]
	if !ok {
		return
	}
	for deviceID, conn := range devices {
		if deviceID == excludeDeviceID {
			continue
		}
		if conn.isClosed() {
			continue
		}
		select {
		case conn.Send <- message:
		default:
			// Buffer full → close connection to protect the server.
			log.Printf("[ws] buffer overflow, closing user=%s device=%s", userID, deviceID)
			go conn.close()
		}
	}
}

// ---------- Gin handler entry-points ----------

// HandleWebSocketWithGin is the Gin-compatible entry point for WebSocket upgrades.
// It expects user_id to have been extracted by the JWT middleware already.
func HandleWebSocketWithGin(c *gin.Context, userID string, deviceID string) {
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "device_id query parameter is required"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[ws] upgrade failed user=%s: %v", userID, err)
		return
	}

	wsConn := &WSConnection{
		UserID:   userID,
		DeviceID: deviceID,
		Conn:     conn,
		Send:     make(chan []byte, 256),
	}

	wsManager.register(wsConn)

	go wsConn.writePump()
	go wsConn.readPump()
}

// BroadcastOperation notifies all other online devices of a user about new operations.
// Called from the Push handler after operations are accepted.
func BroadcastOperation(userID string, sourceDeviceID string, ops []WSOperationPayload) {
	if len(ops) == 0 {
		return
	}
	data, err := json.Marshal(ops)
	if err != nil {
		return
	}
	msg, err := json.Marshal(WSMessage{Type: "operation", Payload: data})
	if err != nil {
		return
	}
	wsManager.broadcastToUser(userID, sourceDeviceID, msg)
}

// ---------- helpers ----------

// fetchOperationsSince queries the DB for operations newer than sinceVersion, excluding the requesting device.
func fetchOperationsSince(sinceVersion int64, excludeDeviceID string) []WSOperationPayload {
	var ops []operationRow
	_ = models.DB.
		Table("operations").
		Select("entity_type, entity_id, operation, payload, server_seq_no, device_id").
		Where("server_seq_no > ? AND device_id != ?", sinceVersion, excludeDeviceID).
		Order("server_seq_no ASC").
		Find(&ops).Error

	result := make([]WSOperationPayload, 0, len(ops))
	for _, op := range ops {
		result = append(result, WSOperationPayload{
			EntityType: op.EntityType,
			EntityID:   op.EntityID,
			Operation:  op.Operation,
			Data:       fromJSON(op.Payload),
			Version:    op.ServerSeqNo,
			DeviceID:   op.DeviceID,
		})
	}
	return result
}

// operationRow is a lightweight projection used by fetchOperationsSince.
type operationRow struct {
	EntityType  string
	EntityID    string
	Operation   string
	Payload     string
	ServerSeqNo int64
	DeviceID    string
}
