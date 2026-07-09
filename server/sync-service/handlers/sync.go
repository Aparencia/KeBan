package handlers

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// ---------- Domain types ----------

// Operation represents a single client or server operation log entry.
type Operation struct {
	ID          string      `json:"id"`
	DeviceID    string      `json:"deviceId"`
	EntityType  string      `json:"entityType"`
	EntityID    string      `json:"entityId"`
	Operation   string      `json:"operation"` // create | update | delete
	Version     int64       `json:"version"`
	Patch       string      `json:"patch,omitempty"`
	Payload     interface{} `json:"payload,omitempty"`
	Data        interface{} `json:"data,omitempty"`
	CreatedAt   string      `json:"createdAt"`
	ServerSeqNo int64       `json:"serverSeqNo"` // server-assigned monotonic sequence
}

// ConflictInfo is returned to the client when a version conflict is detected.
type ConflictInfo struct {
	EntityType    string      `json:"entityType"`
	EntityID      string      `json:"entityId"`
	ServerVersion int64       `json:"serverVersion"`
	ServerData    interface{} `json:"serverData"`
}

// ---------- In-memory store ----------

// Store holds all server-side sync state.
// MVP: everything lives in memory; restart loses history.
type Store struct {
	mu sync.RWMutex

	// entityVersions maps "entityType:entityId" -> latest known version on server
	entityVersions map[string]int64

	// entityData maps "entityType:entityId" -> latest payload/data
	entityData map[string]interface{}

	// operations is an append-only log, ordered by ServerSeqNo
	operations []Operation

	// globalSeqNo is the monotonically increasing server sequence counter
	globalSeqNo int64
}

var store = &Store{
	entityVersions: make(map[string]int64),
	entityData:     make(map[string]interface{}),
	operations:     make([]Operation, 0, 1024),
}

func entityKey(entityType, entityID string) string {
	return entityType + ":" + entityID
}

// ---------- Push handler ----------

type pushRequest struct {
	DeviceID   string `json:"deviceId"`
	Operations []struct {
		ID         string      `json:"id"`
		EntityType string      `json:"entityType"`
		EntityID   string      `json:"entityId"`
		Operation  string      `json:"operation"`
		Version    int64       `json:"version"`
		Patch      string      `json:"patch,omitempty"`
		Payload    interface{} `json:"payload,omitempty"`
		CreatedAt  string      `json:"createdAt"`
	} `json:"operations"`
}

// Push accepts a batch of client operations and applies them server-side.
// - client version >= server version → accept
// - client version <  server version → conflict
func Push(c *gin.Context) {
	var req pushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	accepted := make([]string, 0)
	conflicts := make([]ConflictInfo, 0)
	var pushErrors []string

	for _, op := range req.Operations {
		key := entityKey(op.EntityType, op.EntityID)
		serverVersion, exists := store.entityVersions[key]

		if exists && op.Version < serverVersion {
			// Conflict: client is behind server
			conflicts = append(conflicts, ConflictInfo{
				EntityType:    op.EntityType,
				EntityID:      op.EntityID,
				ServerVersion: serverVersion,
				ServerData:    store.entityData[key],
			})
			continue
		}

		// Accept: update server state
		store.globalSeqNo++
		store.entityVersions[key] = op.Version
		store.entityData[key] = op.Payload

		storedOp := Operation{
			ID:          op.ID,
			DeviceID:    req.DeviceID,
			EntityType:  op.EntityType,
			EntityID:    op.EntityID,
			Operation:   op.Operation,
			Version:     op.Version,
			Patch:       op.Patch,
			Payload:     op.Payload,
			CreatedAt:   op.CreatedAt,
			ServerSeqNo: store.globalSeqNo,
		}
		store.operations = append(store.operations, storedOp)
		accepted = append(accepted, op.ID)
	}

	c.JSON(http.StatusOK, gin.H{
		"accepted":  accepted,
		"conflicts": conflicts,
		"errors":    pushErrors,
	})
}

// ---------- Pull handler ----------

// Pull returns all server operations since `sinceVersion` (exclusive).
// Query params: deviceId, sinceVersion
func Pull(c *gin.Context) {
	deviceID := c.Query("deviceId")
	sinceVersionStr := c.DefaultQuery("sinceVersion", "0")
	sinceVersion, err := strconv.ParseInt(sinceVersionStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sinceVersion"})
		return
	}

	store.mu.RLock()
	defer store.mu.RUnlock()

	result := make([]gin.H, 0)
	var latestVersion int64 = sinceVersion

	for _, op := range store.operations {
		if op.ServerSeqNo <= sinceVersion {
			continue
		}
		// Don't echo operations back to the originating device
		if op.DeviceID == deviceID {
			continue
		}

		result = append(result, gin.H{
			"entityType": op.EntityType,
			"entityId":   op.EntityID,
			"operation":  op.Operation,
			"data":       op.Payload,
			"version":    op.ServerSeqNo,
		})

		if op.ServerSeqNo > latestVersion {
			latestVersion = op.ServerSeqNo
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"operations":    result,
		"latestVersion": latestVersion,
	})
}

// ---------- Resolve handler ----------

type resolveRequest struct {
	EntityType string      `json:"entityType"`
	EntityID   string      `json:"entityId"`
	Strategy   string      `json:"strategy"` // "local" | "remote" | "manual"
	Data       interface{} `json:"data,omitempty"`
	Version    int64       `json:"version"`
	DeviceID   string      `json:"deviceId"`
}

// Resolve handles conflict resolution submitted by the client.
func Resolve(c *gin.Context) {
	var req resolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	key := entityKey(req.EntityType, req.EntityID)

	switch req.Strategy {
	case "local":
		// Client wins: overwrite server with client data
		store.globalSeqNo++
		store.entityVersions[key] = req.Version
		store.entityData[key] = req.Data
		store.operations = append(store.operations, Operation{
			DeviceID:    req.DeviceID,
			EntityType:  req.EntityType,
			EntityID:    req.EntityID,
			Operation:   "update",
			Version:     req.Version,
			Payload:     req.Data,
			CreatedAt:   time.Now().UTC().Format(time.RFC3339),
			ServerSeqNo: store.globalSeqNo,
		})

	case "remote":
		// Server wins: no changes needed, client will pull latest

	case "manual":
		// Manual merge: client sends merged data
		if req.Data != nil {
			store.globalSeqNo++
			store.entityVersions[key] = req.Version
			store.entityData[key] = req.Data
			store.operations = append(store.operations, Operation{
				DeviceID:    req.DeviceID,
				EntityType:  req.EntityType,
				EntityID:    req.EntityID,
				Operation:   "update",
				Version:     req.Version,
				Payload:     req.Data,
				CreatedAt:   time.Now().UTC().Format(time.RFC3339),
				ServerSeqNo: store.globalSeqNo,
			})
		}

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown strategy: " + req.Strategy})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"resolved": true,
		"strategy": req.Strategy,
	})
}

// ---------- Status handler ----------

// Status returns a lightweight summary of the sync store.
func Status(c *gin.Context) {
	store.mu.RLock()
	defer store.mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"totalOperations": len(store.operations),
		"trackedEntities": len(store.entityVersions),
		"latestSeqNo":     store.globalSeqNo,
	})
}
