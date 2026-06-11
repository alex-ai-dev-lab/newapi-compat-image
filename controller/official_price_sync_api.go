package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// TriggerOfficialPriceSync lets an admin run the official price sync on demand.
func TriggerOfficialPriceSync(c *gin.Context) {
	merged, err := RunOfficialPriceSync()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
			"data":    OfficialPriceSyncStatus(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"added_models":   merged,
			"updated_models": merged,
			"status":         OfficialPriceSyncStatus(),
		},
	})
}

// GetOfficialPriceSyncStatus returns the last sync status.
func GetOfficialPriceSyncStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    OfficialPriceSyncStatus(),
	})
}
