package antipoison

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

const ProbeInstruction = "Reply exactly with the word OK inside the verification envelope. Do not add any other text."

func ProbeRequired(info *relaycommon.RelayInfo) bool {
	if info == nil || info.IsChannelTest {
		return false
	}
	cfg := FromChannelSettingsForChannel(info.ChannelId, info.ChannelSetting)
	return cfg.Enabled && cfg.ProbeBeforeEveryRequest
}

func MarkProbeRequest(c *gin.Context, requestID string) {
	if c == nil || requestID == "" {
		return
	}
	common.SetContextKey(c, constant.ContextKeyAntiPoisonProbeRequestID, requestID)
}

func BuildOpenAIProbeRequest(model string) *dto.GeneralOpenAIRequest {
	stream := false
	maxTokens := uint(32)
	return &dto.GeneralOpenAIRequest{
		Model:     model,
		Stream:    &stream,
		MaxTokens: &maxTokens,
		Messages: []dto.Message{
			{Role: "user", Content: ProbeInstruction},
		},
	}
}

func BuildResponsesProbeRequest(model string) *dto.OpenAIResponsesRequest {
	stream := false
	maxTokens := uint(32)
	input, _ := json.Marshal(ProbeInstruction)
	return &dto.OpenAIResponsesRequest{
		Model:           model,
		Input:           input,
		Stream:          &stream,
		MaxOutputTokens: &maxTokens,
	}
}

func BuildClaudeProbeRequest(model string) *dto.ClaudeRequest {
	stream := false
	maxTokens := uint(32)
	return &dto.ClaudeRequest{
		Model:     model,
		Stream:    &stream,
		MaxTokens: &maxTokens,
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: ProbeInstruction},
		},
	}
}
