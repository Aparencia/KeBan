package main

import (
	"log"
	"net/http"

	"keban/sync-service/cache"
	"keban/sync-service/handlers"
	"keban/sync-service/middleware"
	"keban/sync-service/models"

	"github.com/gin-gonic/gin"
)

func main() {
	// Initialise PostgreSQL connection before anything else.
	if err := models.InitDB(); err != nil {
		log.Fatalf("[sync-service] Database initialisation failed: %v", err)
	}

	// Initialise Redis cache (graceful degradation on failure).
	if err := cache.InitRedis(); err != nil {
		log.Printf("[sync-service] Redis init error: %v", err)
	}
	defer cache.CloseRedis()

	r := gin.Default()

	// Health check
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Sync API v1
	v1 := r.Group("/api/v1/sync")
	v1.Use(middleware.AuthMiddleware())
	{
		v1.POST("/push", handlers.Push)
		v1.GET("/pull", handlers.Pull)
		v1.POST("/resolve", handlers.Resolve)
		v1.GET("/status", handlers.Status)
	}

	// WebSocket real-time sync channel.
	// Uses WSAuthMiddleware which reads the JWT from ?token= query parameter
	// (browsers cannot set custom headers on WebSocket upgrade requests).
	ws := r.Group("/api/v1/sync")
	ws.Use(middleware.WSAuthMiddleware())
	{
		ws.GET("/ws", func(c *gin.Context) {
			userID := c.GetString("user_id")
			deviceID := c.Query("device_id")
			handlers.HandleWebSocketWithGin(c, userID, deviceID)
		})
	}

	log.Println("[sync-service] Starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
