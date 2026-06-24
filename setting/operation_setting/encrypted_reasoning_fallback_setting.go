package operation_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type EncryptedReasoningFallbackSetting struct {
	AffinityEnabled             bool     `json:"affinity_enabled"`
	ScrubFallbackEnabled        bool     `json:"scrub_fallback_enabled"`
	MaxFallbackTimes            int      `json:"max_fallback_times"`
	FallbackStatusCodes         string   `json:"fallback_status_codes"`
	FallbackErrorText           []string `json:"fallback_error_text"`
	StreamingPreFirstChunkRetry bool     `json:"streaming_pre_first_chunk_retry"`
}

var encryptedReasoningFallbackSetting = EncryptedReasoningFallbackSetting{
	AffinityEnabled:             true,
	ScrubFallbackEnabled:        true,
	MaxFallbackTimes:            10,
	FallbackStatusCodes:         "402,408,429,500-599",
	StreamingPreFirstChunkRetry: true,
	FallbackErrorText: []string{
		"invalid_encrypted_content",
		"encrypted content could not be verified",
		"encrypted content could not be decrypted or parsed",
		"could not be decrypted",
		"quota",
		"credit",
		"balance",
		"billing",
		"insufficient",
		"rate limit",
		"too many requests",
		"connection reset",
		"unexpected eof",
		"context deadline exceeded",
		"do request failed",
	},
}

func init() {
	config.GlobalConfig.Register("encrypted_reasoning_fallback_setting", &encryptedReasoningFallbackSetting)
}

func GetEncryptedReasoningFallbackSetting() *EncryptedReasoningFallbackSetting {
	return &encryptedReasoningFallbackSetting
}

func EncryptedReasoningFallbackErrorTexts() []string {
	setting := GetEncryptedReasoningFallbackSetting()
	if setting == nil {
		return nil
	}
	out := make([]string, 0, len(setting.FallbackErrorText))
	for _, item := range setting.FallbackErrorText {
		item = strings.ToLower(strings.TrimSpace(item))
		if item != "" {
			out = append(out, item)
		}
	}
	return out
}
