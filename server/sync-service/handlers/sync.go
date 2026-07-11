package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"keban/sync-service/cache"
	"keban/sync-service/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ---------- Domain types (JSON request/response only) ----------

// ConflictInfo is returned to the client when a version conflict is detected.
type ConflictInfo struct {
	EntityType    string      `json:"entityType"`
	EntityID      string      `json:"entityId"`
	ServerVersion int64       `json:"serverVersion"`
	ServerData    interface{} `json:"serverData"`
}

// ---------- helpers ----------

// toJSON serialises v to a JSON string. Returns "" when v is nil.
func toJSON(v interface{}) string {
	if v == nil {
		return ""
	}
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}

// fromJSON deserialises a JSON string back to interface{}.
// Returns nil when the string is empty.
func fromJSON(s string) interface{} {
	if s == "" {
		return nil
	}
	var v interface{}
	if err := json.Unmarshal([]byte(s), &v); err != nil {
		return s // fall back to raw string
	}
	return v
}

// nextSeqNo atomically increments and returns the new GlobalSeqNo inside tx.
func nextSeqNo(tx *gorm.DB) (int64, error) {
	var g models.GlobalSeqNo
	if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&g).Error; err != nil {
		return 0, err
	}
	g.SeqNo++
	if err := tx.Save(&g).Error; err != nil {
		return 0, err
	}
	return g.SeqNo, nil
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
//   - client version >= server version → accept
//   - client version <  server version → conflict
func Push(c *gin.Context) {
	var req pushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	accepted := make([]string, 0)
	conflicts := make([]ConflictInfo, 0)
	pushErrors := make([]string, 0)
	var latestSeqNo int64 // track highest seqNo assigned in this push batch

	for _, op := range req.Operations {
		// Look up current server version for this entity.
		var ev models.EntityVersion
		result := models.DB.Where("user_id = ? AND entity_type = ? AND entity_id = ?", userID, op.EntityType, op.EntityID).First(&ev)

		if result.RowsAffected == 0 && result.Error != nil && result.Error != gorm.ErrRecordNotFound {
			pushErrors = append(pushErrors, "db error: "+result.Error.Error())
			continue
		}
		entityExists := result.RowsAffected > 0

		if entityExists && op.Version < ev.Version {
			// Conflict: client is behind server.
			conflicts = append(conflicts, ConflictInfo{
				EntityType:    op.EntityType,
				EntityID:      op.EntityID,
				ServerVersion: ev.Version,
				ServerData:    fromJSON(ev.Data),
			})
			continue
		}

		// Accept: run inside a transaction for atomicity.
		var opSeqNo int64
		txErr := models.DB.Transaction(func(tx *gorm.DB) error {
			seqNo, err := nextSeqNo(tx)
			if err != nil {
				return err
			}
			opSeqNo = seqNo

			payloadJSON := toJSON(op.Payload)

			// Upsert EntityVersion.
			if entityExists {
				if err := tx.Model(&ev).Updates(map[string]interface{}{
					"version": op.Version,
					"data":    payloadJSON,
				}).Error; err != nil {
					return err
				}
			} else {
				newEV := models.EntityVersion{
					UserID:     userID,
					EntityType: op.EntityType,
					EntityID:   op.EntityID,
					Version:    op.Version,
					Data:       payloadJSON,
				}
				if err := tx.Create(&newEV).Error; err != nil {
					return err
				}
			}

			// Append Operation log.
			dbOp := models.Operation{
				ServerSeqNo: seqNo,
				DeviceID:    req.DeviceID,
				UserID:      userID,
				EntityType:  op.EntityType,
				EntityID:    op.EntityID,
				Operation:   op.Operation,
				Version:     op.Version,
				Patch:       op.Patch,
				Payload:     payloadJSON,
				CreatedAt:   op.CreatedAt,
			}
			return tx.Create(&dbOp).Error
		})

		if txErr != nil {
			pushErrors = append(pushErrors, "tx error: "+txErr.Error())
			continue
		}
		accepted = append(accepted, op.ID)
		if opSeqNo > latestSeqNo {
			latestSeqNo = opSeqNo
		}
	}

	// Update Redis cache after successful push.
	ctx := context.Background()
	if req.DeviceID != "" {
		_ = cache.SetDeviceOnline(ctx, userID, req.DeviceID)
	}
	if latestSeqNo > 0 {
		_ = cache.SetLastSyncVersion(ctx, userID, latestSeqNo)
	}

	// Broadcast accepted operations to the user's other online devices via WebSocket.
	if len(accepted) > 0 {
		wsOps := make([]WSOperationPayload, 0, len(accepted))
		for _, op := range req.Operations {
			for _, aid := range accepted {
				if op.ID == aid {
					wsOps = append(wsOps, WSOperationPayload{
						EntityType: op.EntityType,
						EntityID:   op.EntityID,
						Operation:  op.Operation,
						Data:       op.Payload,
						Version:    op.Version,
						DeviceID:   req.DeviceID,
					})
					break
				}
			}
		}
		BroadcastOperation(userID, req.DeviceID, wsOps)
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
	userID := c.GetString("user_id")
	deviceID := c.Query("deviceId")
	sinceVersionStr := c.DefaultQuery("sinceVersion", "0")
	sinceVersion, err := strconv.ParseInt(sinceVersionStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sinceVersion"})
		return
	}

	var ops []models.Operation
	if err := models.DB.
		Where("user_id = ? AND server_seq_no > ? AND device_id != ?", userID, sinceVersion, deviceID).
		Order("server_seq_no ASC").
		Find(&ops).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := make([]gin.H, 0, len(ops))
	var latestVersion int64 = sinceVersion

	for _, op := range ops {
		result = append(result, gin.H{
			"entityType": op.EntityType,
			"entityId":   op.EntityID,
			"operation":  op.Operation,
			"data":       fromJSON(op.Payload),
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
	userID := c.GetString("user_id")

	var req resolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	switch req.Strategy {
	case "local", "manual":
		// Client wins / manual merge: overwrite server with supplied data.
		if req.Data == nil && req.Strategy == "manual" {
			break // nothing to write
		}

		txErr := models.DB.Transaction(func(tx *gorm.DB) error {
			seqNo, err := nextSeqNo(tx)
			if err != nil {
				return err
			}

			payloadJSON := toJSON(req.Data)

			// Upsert EntityVersion.
			var ev models.EntityVersion
			res := tx.Where("user_id = ? AND entity_type = ? AND entity_id = ?", userID, req.EntityType, req.EntityID).First(&ev)
			if res.RowsAffected > 0 {
				if err := tx.Model(&ev).Updates(map[string]interface{}{
					"version": req.Version,
					"data":    payloadJSON,
				}).Error; err != nil {
					return err
				}
			} else {
				if err := tx.Create(&models.EntityVersion{
					UserID:     userID,
					EntityType: req.EntityType,
					EntityID:   req.EntityID,
					Version:    req.Version,
					Data:       payloadJSON,
				}).Error; err != nil {
					return err
				}
			}

			// Append Operation log.
			return tx.Create(&models.Operation{
				ServerSeqNo: seqNo,
				DeviceID:    req.DeviceID,
				UserID:      userID,
				EntityType:  req.EntityType,
				EntityID:    req.EntityID,
				Operation:   "update",
				Version:     req.Version,
				Payload:     payloadJSON,
				CreatedAt:   time.Now().UTC().Format(time.RFC3339),
			}).Error
		})

		if txErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": txErr.Error()})
			return
		}

	case "remote":
		// Server wins: no changes needed; client will pull latest.

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
	userID := c.GetString("user_id")

	var opCount, evCount int64
	models.DB.Model(&models.Operation{}).Where("user_id = ?", userID).Count(&opCount)
	models.DB.Model(&models.EntityVersion{}).Where("user_id = ?", userID).Count(&evCount)

	var g models.GlobalSeqNo
	models.DB.First(&g)

	c.JSON(http.StatusOK, gin.H{
		"totalOperations": opCount,
		"trackedEntities": evCount,
		"latestSeqNo":     g.SeqNo,
		"redisConnected":  cache.RDB != nil,
	})
}
