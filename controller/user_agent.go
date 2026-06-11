package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetAllUserAgents(c *gin.Context) {
	userAgents, err := model.GetAllUserAgents()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    userAgents,
	})
}

func GetUserAgent(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "invalid parameter",
		})
		return
	}
	userAgent, err := model.GetUserAgentById(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    userAgent,
	})
}

func CreateUserAgent(c *gin.Context) {
	var userAgent model.UserAgent
	err := c.ShouldBindJSON(&userAgent)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "invalid parameter: " + err.Error(),
		})
		return
	}

	if err := normalizeUserAgentForSave(&userAgent); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	userAgent.CreatedTime = time.Now().Unix()
	userAgent.UpdatedTime = time.Now().Unix()

	err = userAgent.Insert()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	model.InitUserAgentCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    userAgent,
	})
}

func UpdateUserAgent(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "invalid parameter",
		})
		return
	}

	var userAgent model.UserAgent
	err = c.ShouldBindJSON(&userAgent)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "invalid parameter: " + err.Error(),
		})
		return
	}

	if err := normalizeUserAgentForSave(&userAgent); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	userAgent.Id = id
	userAgent.UpdatedTime = time.Now().Unix()

	err = userAgent.Update()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	model.InitUserAgentCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    userAgent,
	})
}

func DeleteUserAgent(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "invalid parameter",
		})
		return
	}

	userAgent := model.UserAgent{Id: id}
	err = userAgent.Delete()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	model.InitUserAgentCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func GetUserAgentCategories(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    model.ValidModelCategories,
	})
}

func ExportUserAgents(c *gin.Context) {
	userAgents, err := model.GetAllUserAgents()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"version":     1,
			"user_agents": userAgents,
		},
	})
}

func ImportUserAgents(c *gin.Context) {
	var payload struct {
		Mode       string             `json:"mode"`
		UserAgents []*model.UserAgent `json:"user_agents"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid parameter: " + err.Error()})
		return
	}
	if payload.Mode == "" {
		payload.Mode = "append"
	}
	now := time.Now().Unix()
	for _, ua := range payload.UserAgents {
		if ua == nil {
			continue
		}
		if err := normalizeUserAgentForSave(ua); err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
		ua.CreatedTime = now
		ua.UpdatedTime = now
	}
	if strings.EqualFold(payload.Mode, "replace") {
		if err := model.ReplaceUserAgents(payload.UserAgents); err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
	} else {
		for _, ua := range payload.UserAgents {
			if ua == nil {
				continue
			}
			ua.Id = 0
			if err := ua.Insert(); err != nil {
				c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
				return
			}
		}
	}
	model.InitUserAgentCache()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func normalizeUserAgentForSave(userAgent *model.UserAgent) error {
	userAgent.Name = strings.TrimSpace(userAgent.Name)
	userAgent.Value = strings.TrimSpace(userAgent.Value)
	userAgent.ModelCategory = strings.ToLower(strings.TrimSpace(userAgent.ModelCategory))
	if userAgent.ModelCategory == "" {
		userAgent.ModelCategory = model.ModelCategoryOther
	}
	if userAgent.Name == "" || userAgent.Value == "" {
		return fmt.Errorf("name and value are required")
	}
	for _, cat := range model.ValidModelCategories {
		if userAgent.ModelCategory == cat {
			return nil
		}
	}
	return fmt.Errorf("invalid model_category, must be one of: %s", strings.Join(model.ValidModelCategories, ", "))
}
