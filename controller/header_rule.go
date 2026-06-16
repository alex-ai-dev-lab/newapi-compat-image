package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetHeaderRuleSetting(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": model.GetHeaderRuleSetting()})
}

func UpdateHeaderRuleSetting(c *gin.Context) {
	var setting model.HeaderRuleSetting
	if err := c.ShouldBindJSON(&setting); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request: " + err.Error()})
		return
	}
	if err := model.UpdateHeaderRuleSetting(setting); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to update: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Header rule setting updated"})
}

func GetHeaderRuleCategories(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{
		model.HeaderRuleCategoryAll,
		model.ModelCategoryClaude,
		"codex",
		model.ModelCategoryOpenAI,
		model.ModelCategoryGemini,
		model.ModelCategoryGrok,
		model.ModelCategoryOther,
	}})
}
