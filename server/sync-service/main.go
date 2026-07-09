package main

import (
	"log"
	"net/http"

	"keban/sync-service/handlers"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	// Health check
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Sync API v1
	v1 := r.Group("/api/v1/sync")
	{
		v1.POST("/push", handlers.Push)
		v1.GET("/pull", handlers.Pull)
		v1.POST("/resolve", handlers.Resolve)
		v1.GET("/status", handlers.Status)
	}

	log.Println("[sync-service] Starting on :8081")
	if err := r.Run(":8081"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
