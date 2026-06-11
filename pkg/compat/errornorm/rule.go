package errornorm

import (
	"strings"

	"gorm.io/gorm"
)

// Rule represents a DB-driven error normalization rule.
//
// Match semantics:
//   - Platforms: empty list matches all platforms; otherwise channel.Type's string form must be in list
//   - UpstreamStatus: 0 matches all; otherwise must equal err.StatusCode
//   - Keywords: empty list matches all; otherwise body must contain at least one keyword (case-insensitive)
//
// Transform semantics:
//   - PassthroughCode=true: keep upstream status code as-is
//   - PassthroughCode=false: use ResponseCode (default: upstream status)
//   - Response body is never passed through to the client. CustomMessage is
//     admin-authored fixed text; empty means FixedMessage(status).
type Rule struct {
	ID              int64  `gorm:"primaryKey" json:"id"`
	Enabled         bool   `gorm:"default:true" json:"enabled"`
	Description     string `gorm:"type:varchar(255)" json:"description"`
	Platforms       string `gorm:"type:varchar(255)" json:"platforms"` // comma-separated channel type strings
	UpstreamStatus  int    `gorm:"default:0" json:"upstream_status"`   // 0 = any
	Keywords        string `gorm:"type:text" json:"keywords"`          // comma-separated, case-insensitive substring match
	PassthroughCode bool   `gorm:"default:false" json:"passthrough_code"`
	ResponseCode    int    `gorm:"default:0" json:"response_code"`        // 0 = use upstream status
	PassthroughBody bool   `gorm:"default:false" json:"passthrough_body"` // deprecated; always forced false
	CustomMessage   string `gorm:"type:text" json:"custom_message"`       // empty = use FixedMessage(status)
	SkipMonitoring  bool   `gorm:"default:false" json:"skip_monitoring"`  // deprecated; upstream originals stay in masked logs
	Priority        int    `gorm:"default:100" json:"priority"`           // lower runs first
	CreatedAt       int64  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       int64  `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName overrides GORM default to clarify ownership.
func (Rule) TableName() string {
	return "error_passthrough_rules"
}

// cachedRule is the pre-processed Rule with lowercased keywords/platforms for hot-path matching.
type cachedRule struct {
	rule          *Rule
	lowerKeys     []string
	lowerPlatform map[string]struct{}
}

func newCachedRule(r *Rule) *cachedRule {
	c := &cachedRule{rule: r}
	if r.Keywords != "" {
		for _, k := range strings.Split(r.Keywords, ",") {
			k = strings.TrimSpace(strings.ToLower(k))
			if k != "" {
				c.lowerKeys = append(c.lowerKeys, k)
			}
		}
	}
	if r.Platforms != "" {
		c.lowerPlatform = make(map[string]struct{})
		for _, p := range strings.Split(r.Platforms, ",") {
			p = strings.TrimSpace(strings.ToLower(p))
			if p != "" {
				c.lowerPlatform[p] = struct{}{}
			}
		}
	}
	return c
}

func (c *cachedRule) matches(platform string, status int, body string) bool {
	if c.rule == nil || !c.rule.Enabled {
		return false
	}
	if len(c.lowerPlatform) > 0 {
		if _, ok := c.lowerPlatform[strings.ToLower(platform)]; !ok {
			return false
		}
	}
	if c.rule.UpstreamStatus != 0 && c.rule.UpstreamStatus != status {
		return false
	}
	if len(c.lowerKeys) > 0 {
		lowerBody := strings.ToLower(body)
		matched := false
		for _, k := range c.lowerKeys {
			if strings.Contains(lowerBody, k) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}
	return true
}

// EnsureSchema creates/migrates the error_passthrough_rules table.
func EnsureSchema(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	return db.AutoMigrate(&Rule{})
}
