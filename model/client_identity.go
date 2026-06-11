package model

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
)

// ClientIdentitySetting 客户端标识符管理配置
type ClientIdentitySetting struct {
	Enabled                   bool                    `json:"enabled"`
	ApplyToAllOpenAIResponses bool                    `json:"apply_to_all_openai_responses"`
	ApplyToAllClaudeMessages  bool                    `json:"apply_to_all_claude_messages"`
	Codex                     CodexIdentityConfig     `json:"codex"`
	Claude                    ClaudeIdentityConfig    `json:"claude"`
	Generic                   []GenericIdentityConfig `json:"generic"`
}

// CodexIdentityConfig Codex 标识符配置
type CodexIdentityConfig struct {
	Enabled             bool   `json:"enabled"`
	Mode                string `json:"mode"` // force_global, disabled
	InstallationID      string `json:"installation_id"`
	RotateEnabled       bool   `json:"rotate_enabled"`
	RotateIntervalUnit  string `json:"rotate_interval_unit"`  // week, month, year
	RotateIntervalValue int    `json:"rotate_interval_value"` // >= 1
	NextRotateAt        int64  `json:"next_rotate_at"`        // unix timestamp
}

// ClaudeIdentityConfig Claude 标识符配置
type ClaudeIdentityConfig struct {
	Enabled             bool   `json:"enabled"`
	Mode                string `json:"mode"` // force_global, disabled
	DeviceID            string `json:"device_id"`
	SessionIDMode       string `json:"session_id_mode"` // force_global, disabled
	FixedSessionID      string `json:"fixed_session_id"`
	SyncSessionHeader   bool   `json:"sync_session_header"`
	RotateEnabled       bool   `json:"rotate_enabled"`
	RotateIntervalUnit  string `json:"rotate_interval_unit"`
	RotateIntervalValue int    `json:"rotate_interval_value"`
	NextRotateAt        int64  `json:"next_rotate_at"`
}

// GenericIdentityConfig 通用厂商标识符配置（支持自定义字段路径）
type GenericIdentityConfig struct {
	Name                string `json:"name"` // 配置名称，如 "Gemini", "Tongyi"
	Enabled             bool   `json:"enabled"`
	Mode                string `json:"mode"`       // force_global, disabled
	PathType            string `json:"path_type"`  // body_json, header
	FieldPath           string `json:"field_path"` // JSON 路径如 "metadata.user_id" 或 header 名如 "X-Device-Id"
	FieldValue          string `json:"field_value"`
	RotateEnabled       bool   `json:"rotate_enabled"`
	RotateIntervalUnit  string `json:"rotate_interval_unit"`
	RotateIntervalValue int    `json:"rotate_interval_value"`
	NextRotateAt        int64  `json:"next_rotate_at"`
}

const (
	IdentityModeForceGlobal = "force_global"
	IdentityModeDisabled    = "disabled"

	SessionIDModeForceGlobal = "force_global"
	SessionIDModeDisabled    = "disabled"

	RotateUnitWeek  = "week"
	RotateUnitMonth = "month"
	RotateUnitYear  = "year"

	PathTypeBodyJSON = "body_json"
	PathTypeHeader   = "header"
)

// GetClientIdentitySetting 获取客户端标识符配置，自动规范化
func GetClientIdentitySetting() ClientIdentitySetting {
	common.OptionMapRWMutex.RLock()
	value, exists := common.OptionMap["client_identity_setting"]
	common.OptionMapRWMutex.RUnlock()

	if !exists || strings.TrimSpace(value) == "" {
		// 初始化默认配置
		setting := getDefaultClientIdentitySetting()
		_ = saveClientIdentitySetting(setting)
		return setting
	}

	var setting ClientIdentitySetting
	if err := json.Unmarshal([]byte(value), &setting); err != nil {
		common.SysLog("client identity setting JSON invalid, using defaults: " + err.Error())
		setting = getDefaultClientIdentitySetting()
		_ = saveClientIdentitySetting(setting)
		return setting
	}

	// 规范化配置
	setting = normalizeClientIdentitySetting(setting)
	return setting
}

// getDefaultClientIdentitySetting 返回默认配置
func getDefaultClientIdentitySetting() ClientIdentitySetting {
	return ClientIdentitySetting{
		Enabled:                   true,
		ApplyToAllOpenAIResponses: true,
		ApplyToAllClaudeMessages:  true,
		Codex: CodexIdentityConfig{
			Enabled:             true,
			Mode:                IdentityModeForceGlobal,
			InstallationID:      "",
			RotateEnabled:       false,
			RotateIntervalUnit:  RotateUnitMonth,
			RotateIntervalValue: 1,
			NextRotateAt:        0,
		},
		Claude: ClaudeIdentityConfig{
			Enabled:             true,
			Mode:                IdentityModeForceGlobal,
			DeviceID:            "",
			SessionIDMode:       SessionIDModeForceGlobal,
			FixedSessionID:      "",
			SyncSessionHeader:   true,
			RotateEnabled:       false,
			RotateIntervalUnit:  RotateUnitMonth,
			RotateIntervalValue: 1,
			NextRotateAt:        0,
		},
		Generic: []GenericIdentityConfig{},
	}
}

// normalizeClientIdentitySetting 规范化配置值
func normalizeClientIdentitySetting(s ClientIdentitySetting) ClientIdentitySetting {
	// 规范化 Codex 配置
	if s.Codex.Mode != IdentityModeForceGlobal && s.Codex.Mode != IdentityModeDisabled {
		s.Codex.Mode = IdentityModeForceGlobal
	}
	if s.Codex.RotateIntervalUnit != RotateUnitWeek && s.Codex.RotateIntervalUnit != RotateUnitMonth && s.Codex.RotateIntervalUnit != RotateUnitYear {
		s.Codex.RotateIntervalUnit = RotateUnitMonth
	}
	if s.Codex.RotateIntervalValue < 1 {
		s.Codex.RotateIntervalValue = 1
	}

	// 规范化 Claude 配置
	if s.Claude.Mode != IdentityModeForceGlobal && s.Claude.Mode != IdentityModeDisabled {
		s.Claude.Mode = IdentityModeForceGlobal
	}
	if s.Claude.SessionIDMode != SessionIDModeForceGlobal && s.Claude.SessionIDMode != SessionIDModeDisabled {
		s.Claude.SessionIDMode = SessionIDModeForceGlobal
	}
	if s.Claude.RotateIntervalUnit != RotateUnitWeek && s.Claude.RotateIntervalUnit != RotateUnitMonth && s.Claude.RotateIntervalUnit != RotateUnitYear {
		s.Claude.RotateIntervalUnit = RotateUnitMonth
	}
	if s.Claude.RotateIntervalValue < 1 {
		s.Claude.RotateIntervalValue = 1
	}

	// 规范化通用配置
	for i := range s.Generic {
		if s.Generic[i].Mode != IdentityModeForceGlobal && s.Generic[i].Mode != IdentityModeDisabled {
			s.Generic[i].Mode = IdentityModeForceGlobal
		}
		if s.Generic[i].RotateIntervalUnit != RotateUnitWeek && s.Generic[i].RotateIntervalUnit != RotateUnitMonth && s.Generic[i].RotateIntervalUnit != RotateUnitYear {
			s.Generic[i].RotateIntervalUnit = RotateUnitMonth
		}
		if s.Generic[i].RotateIntervalValue < 1 {
			s.Generic[i].RotateIntervalValue = 1
		}
		if s.Generic[i].PathType != PathTypeBodyJSON && s.Generic[i].PathType != PathTypeHeader {
			s.Generic[i].PathType = PathTypeBodyJSON
		}
	}

	return s
}

// saveClientIdentitySetting 保存配置到数据库
func saveClientIdentitySetting(setting ClientIdentitySetting) error {
	data, err := json.Marshal(setting)
	if err != nil {
		return err
	}
	return UpdateOption("client_identity_setting", string(data))
}

// UpdateClientIdentitySetting 更新客户端标识符配置
func UpdateClientIdentitySetting(setting ClientIdentitySetting) error {
	setting = normalizeClientIdentitySetting(setting)
	return saveClientIdentitySetting(setting)
}

// EnsureCodexInstallationID 确保 Codex installation ID 存在，不存在则生成并保存
func EnsureCodexInstallationID() (string, error) {
	setting := GetClientIdentitySetting()
	if id := strings.TrimSpace(setting.Codex.InstallationID); id != "" {
		return id, nil
	}

	// 生成新 UUID
	newID := uuid.NewString()
	setting.Codex.InstallationID = newID
	err := saveClientIdentitySetting(setting)
	if err != nil {
		return "", err
	}
	return newID, nil
}

// EnsureClaudeDeviceID 确保 Claude device ID 存在，不存在则生成并保存
func EnsureClaudeDeviceID() (string, error) {
	setting := GetClientIdentitySetting()
	if id := strings.TrimSpace(setting.Claude.DeviceID); id != "" {
		return id, nil
	}

	newID := uuid.NewString()
	setting.Claude.DeviceID = newID
	err := saveClientIdentitySetting(setting)
	if err != nil {
		return "", err
	}
	return newID, nil
}

// EnsureClaudeSessionID 确保 Claude 固定 session ID 存在，不存在则生成并保存
func EnsureClaudeSessionID() (string, error) {
	setting := GetClientIdentitySetting()
	if id := strings.TrimSpace(setting.Claude.FixedSessionID); id != "" {
		return id, nil
	}

	newID := uuid.NewString()
	setting.Claude.FixedSessionID = newID
	err := saveClientIdentitySetting(setting)
	if err != nil {
		return "", err
	}
	return newID, nil
}

// RotateCodexInstallationID 立即轮换 Codex installation ID
func RotateCodexInstallationID() (string, error) {
	setting := GetClientIdentitySetting()
	newID := uuid.NewString()
	setting.Codex.InstallationID = newID

	// 计算下次轮换时间
	if setting.Codex.RotateEnabled {
		setting.Codex.NextRotateAt = CalculateNextRotateTime(
			setting.Codex.RotateIntervalUnit,
			setting.Codex.RotateIntervalValue,
		)
	}

	err := saveClientIdentitySetting(setting)
	if err != nil {
		return "", err
	}
	return newID, nil
}

// RotateClaudeDeviceID 立即轮换 Claude device ID
func RotateClaudeDeviceID() (string, error) {
	setting := GetClientIdentitySetting()
	newID := uuid.NewString()
	setting.Claude.DeviceID = newID
	if setting.Claude.SessionIDMode == SessionIDModeForceGlobal {
		setting.Claude.FixedSessionID = uuid.NewString()
	}

	if setting.Claude.RotateEnabled {
		setting.Claude.NextRotateAt = CalculateNextRotateTime(
			setting.Claude.RotateIntervalUnit,
			setting.Claude.RotateIntervalValue,
		)
	}

	err := saveClientIdentitySetting(setting)
	if err != nil {
		return "", err
	}
	return newID, nil
}

// CalculateNextRotateTime 计算下次轮换时间
func CalculateNextRotateTime(unit string, value int) int64 {
	now := time.Now()
	var next time.Time

	switch unit {
	case RotateUnitWeek:
		next = now.AddDate(0, 0, 7*value)
	case RotateUnitMonth:
		next = now.AddDate(0, value, 0)
	case RotateUnitYear:
		next = now.AddDate(value, 0, 0)
	default:
		next = now.AddDate(0, 1, 0)
	}

	return next.Unix()
}
