package openaicompat

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
)

func ShouldChatCompletionsUseResponsesPolicy(policy model_setting.ChatCompletionsToResponsesPolicy, channelID int, channelType int, model string) bool {
	if !policy.IsChannelEnabled(channelID, channelType) {
		return false
	}
	return matchAnyRegex(policy.ModelPatterns, model)
}

func ShouldChatCompletionsUseResponsesGlobal(channelID int, channelType int, model string) bool {
	return ShouldChatCompletionsUseResponsesPolicy(
		model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy,
		channelID,
		channelType,
		model,
	)
}

func ShouldChatCompletionsUseResponsesForChannel(channelID int, channelType int, baseURL string, model string) bool {
	if ShouldChatCompletionsUseResponsesGlobal(channelID, channelType, model) {
		return true
	}
	return shouldUseResponsesCompatibilityHeuristic(channelType, baseURL, model)
}

func shouldUseResponsesCompatibilityHeuristic(channelType int, baseURL string, model string) bool {
	if channelType == constant.ChannelTypeCodex {
		return true
	}

	lowerModel := strings.ToLower(strings.TrimSpace(model))
	if common.IsOpenAIResponseOnlyModel(lowerModel) || strings.Contains(lowerModel, "codex") {
		return true
	}

	lowerBaseURL := strings.ToLower(strings.TrimRight(strings.TrimSpace(baseURL), "/"))
	if lowerBaseURL == "" {
		return false
	}

	return strings.Contains(lowerBaseURL, "/codex")
}
