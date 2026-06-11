package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetClientIdentitySetting 获取客户端标识符配置
func GetClientIdentitySetting(c *gin.Context) {
	setting := model.GetClientIdentitySetting()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    setting,
	})
}

// UpdateClientIdentitySetting 更新客户端标识符配置
func UpdateClientIdentitySetting(c *gin.Context) {
	var setting model.ClientIdentitySetting
	if err := c.ShouldBindJSON(&setting); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	if err := model.UpdateClientIdentitySetting(setting); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to update setting: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Client identity setting updated successfully",
	})
}

// GenerateCodexInstallationID 生成新的 Codex installation ID（不保存）
func GenerateCodexInstallationID(c *gin.Context) {
	newID := uuid.NewString()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    newID,
	})
}

// GenerateClaudeDeviceID 生成新的 Claude device ID（不保存）
func GenerateClaudeDeviceID(c *gin.Context) {
	newID := uuid.NewString()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    newID,
	})
}

// RotateCodexInstallationID 立即轮换 Codex installation ID
func RotateCodexInstallationID(c *gin.Context) {
	newID, err := model.RotateCodexInstallationID()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to rotate Codex installation ID: " + err.Error(),
		})
		return
	}

	common.SysLog("admin manually rotated codex installation id")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Codex installation ID rotated successfully",
		"data":    newID,
	})
}

// RotateClaudeDeviceID 立即轮换 Claude device ID
func RotateClaudeDeviceID(c *gin.Context) {
	newID, err := model.RotateClaudeDeviceID()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to rotate Claude device ID: " + err.Error(),
		})
		return
	}

	common.SysLog("admin manually rotated claude device id")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Claude device ID rotated successfully",
		"data":    newID,
	})
}
