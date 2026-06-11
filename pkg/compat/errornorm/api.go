// Package errornorm — admin HTTP handlers for managing rules.
package errornorm

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// RegisterAdminRoutes mounts CRUD endpoints under the given router group.
// Caller is responsible for applying admin auth middleware.
//
// Routes:
//
//	GET    /         - list all rules
//	POST   /         - create rule
//	GET    /:id      - get single rule
//	PUT    /:id      - update rule
//	DELETE /:id      - delete rule
//	POST   /reload   - force reload from DB
func RegisterAdminRoutes(rg *gin.RouterGroup, s *Store) {
	if rg == nil || s == nil {
		return
	}
	rg.GET("", listRules(s))
	rg.POST("", createRule(s))
	rg.GET("/:id", getRule(s))
	rg.PUT("/:id", updateRule(s))
	rg.DELETE("/:id", deleteRule(s))
	rg.POST("/reload", reloadRules(s))
}

func listRules(s *Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var rules []Rule
		if err := s.db.WithContext(c.Request.Context()).Order("priority ASC, id ASC").Find(&rules).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": rules})
	}
}

func createRule(s *Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var r Rule
		if err := c.ShouldBindJSON(&r); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			return
		}
		r.ID = 0 // ignore client-supplied ID
		normalizeRuleForSave(&r)
		if err := s.db.WithContext(c.Request.Context()).Create(&r).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
			return
		}
		// Reload synchronously so caller sees fresh state.
		_ = s.Reload(context.Background())
		c.JSON(http.StatusOK, gin.H{"success": true, "data": r})
	}
}

func getRule(s *Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
			return
		}
		var r Rule
		if err := s.db.WithContext(c.Request.Context()).First(&r, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": r})
	}
}

func updateRule(s *Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
			return
		}
		var r Rule
		if err := c.ShouldBindJSON(&r); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			return
		}
		r.ID = id
		normalizeRuleForSave(&r)
		if err := s.db.WithContext(c.Request.Context()).Save(&r).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
			return
		}
		_ = s.Reload(context.Background())
		c.JSON(http.StatusOK, gin.H{"success": true, "data": r})
	}
}

func normalizeRuleForSave(r *Rule) {
	if r == nil {
		return
	}
	// The anti-poison feature must never pass upstream-controlled error text
	// back to clients. Keep deprecated fields normalized so old API clients or
	// old DB rows cannot re-enable passthrough behavior.
	r.PassthroughBody = false
	r.SkipMonitoring = false
}

func deleteRule(s *Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
			return
		}
		if err := s.db.WithContext(c.Request.Context()).Delete(&Rule{}, id).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
			return
		}
		_ = s.Reload(context.Background())
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func reloadRules(s *Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := s.Reload(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "count": s.Count()})
	}
}
