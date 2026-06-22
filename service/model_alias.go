package service

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var (
	modelLatestAliasMu     sync.RWMutex
	modelLatestAliasRaw    string
	modelLatestAliasParsed map[string]string
)

func ResolveLatestModelAlias(modelName string) string {
	if !common.GetEnvOrDefaultBool("MODEL_LATEST_ALIAS_ENABLED", false) {
		return modelName
	}
	aliases := getLatestModelAliasMap()
	if len(aliases) == 0 {
		return modelName
	}
	trimmed := strings.TrimSpace(modelName)
	if trimmed == "" {
		return modelName
	}
	if resolved := aliases[strings.ToLower(trimmed)]; resolved != "" {
		return resolved
	}
	return modelName
}

func getLatestModelAliasMap() map[string]string {
	raw := common.GetEnvOrDefaultString("MODEL_LATEST_ALIAS_MAP", "")
	modelLatestAliasMu.RLock()
	if raw == modelLatestAliasRaw && modelLatestAliasParsed != nil {
		defer modelLatestAliasMu.RUnlock()
		return modelLatestAliasParsed
	}
	modelLatestAliasMu.RUnlock()

	parsed := map[string]string{}
	if raw != "" {
		var configured map[string]string
		if err := common.Unmarshal([]byte(raw), &configured); err != nil {
			common.SysError("failed to parse MODEL_LATEST_ALIAS_MAP: " + err.Error())
		} else {
			for alias, target := range configured {
				alias = strings.ToLower(strings.TrimSpace(alias))
				target = strings.TrimSpace(target)
				if alias != "" && target != "" {
					parsed[alias] = target
				}
			}
		}
	}

	modelLatestAliasMu.Lock()
	modelLatestAliasRaw = raw
	modelLatestAliasParsed = parsed
	modelLatestAliasMu.Unlock()
	return parsed
}

func ResetLatestModelAliasCacheForTest() {
	modelLatestAliasMu.Lock()
	defer modelLatestAliasMu.Unlock()
	modelLatestAliasRaw = ""
	modelLatestAliasParsed = nil
}
