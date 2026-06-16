package model

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	HeaderActionKeep        = "keep"
	HeaderActionReplace     = "replace"
	HeaderActionSetFixed    = "set_fixed"
	HeaderActionDelete      = "delete"
	HeaderActionSetIfAbsent = "set_if_absent"
)

const HeaderRuleCategoryAll = "*"

type HeaderRule struct {
	Enabled bool   `json:"enabled"`
	Name    string `json:"name"`
	Action  string `json:"action"`
	Value   string `json:"value"`
}

type HeaderRuleGroup struct {
	Category string       `json:"category"`
	Enabled  bool         `json:"enabled"`
	Rules    []HeaderRule `json:"rules"`
}

type HeaderRuleSetting struct {
	Enabled            bool              `json:"enabled"`
	ApplyToChannelTest bool              `json:"apply_to_channel_test"`
	Groups             []HeaderRuleGroup `json:"groups"`
}

func defaultHeaderRuleSetting() HeaderRuleSetting {
	return HeaderRuleSetting{Enabled: false, ApplyToChannelTest: true, Groups: []HeaderRuleGroup{}}
}

func GetHeaderRuleSetting() HeaderRuleSetting {
	common.OptionMapRWMutex.RLock()
	value, exists := common.OptionMap["header_rule_setting"]
	common.OptionMapRWMutex.RUnlock()

	if !exists || strings.TrimSpace(value) == "" {
		setting := defaultHeaderRuleSetting()
		_ = saveHeaderRuleSetting(setting)
		return setting
	}

	var setting HeaderRuleSetting
	if err := json.Unmarshal([]byte(value), &setting); err != nil {
		common.SysLog("header rule setting JSON invalid, using defaults: " + err.Error())
		setting = defaultHeaderRuleSetting()
		_ = saveHeaderRuleSetting(setting)
		return setting
	}
	return normalizeHeaderRuleSetting(setting)
}

func normalizeHeaderRuleSetting(setting HeaderRuleSetting) HeaderRuleSetting {
	for i := range setting.Groups {
		category := strings.ToLower(strings.TrimSpace(setting.Groups[i].Category))
		if category == "" {
			category = HeaderRuleCategoryAll
		}
		setting.Groups[i].Category = category
		for j := range setting.Groups[i].Rules {
			rule := &setting.Groups[i].Rules[j]
			rule.Name = strings.TrimSpace(rule.Name)
			switch rule.Action {
			case HeaderActionKeep, HeaderActionReplace, HeaderActionSetFixed, HeaderActionDelete, HeaderActionSetIfAbsent:
			default:
				rule.Action = HeaderActionKeep
			}
		}
	}
	return setting
}

func saveHeaderRuleSetting(setting HeaderRuleSetting) error {
	data, err := json.Marshal(setting)
	if err != nil {
		return err
	}
	return UpdateOption("header_rule_setting", string(data))
}

func UpdateHeaderRuleSetting(setting HeaderRuleSetting) error {
	return saveHeaderRuleSetting(normalizeHeaderRuleSetting(setting))
}
