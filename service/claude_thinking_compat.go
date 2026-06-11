package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

type ClaudeThinkingSanitizeResult struct {
	Changed                     bool
	RemovedRequestThinking      bool
	RemovedThinkingBlocks       int
	RemovedRedactedThinking     int
	RemovedInvalidThinkingBlock int
}

func ClaudeRequestHasThinking(req *dto.ClaudeRequest) bool {
	if req == nil {
		return false
	}
	if req.Thinking != nil {
		return true
	}
	for i := range req.Messages {
		if claudeContentHasThinking(req.Messages[i].Content) {
			return true
		}
	}
	return false
}

func claudeContentHasThinking(content any) bool {
	blocks, ok := claudeContentToBlocks(content)
	if !ok {
		return false
	}
	for _, block := range blocks {
		switch strings.ToLower(common.Interface2String(block["type"])) {
		case "thinking", "redacted_thinking":
			return true
		}
	}
	return false
}

func ChannelSupportsClaudeThinking(channel *model.Channel) bool {
	if channel == nil {
		return false
	}
	if configured := channel.GetSetting().SupportsClaudeThinking; configured != nil {
		return *configured
	}
	switch channel.Type {
	case constant.ChannelTypeAnthropic, constant.ChannelTypeAws, constant.ChannelTypeVertexAi:
		return true
	default:
		return false
	}
}

func SanitizeClaudeThinkingRequest(req *dto.ClaudeRequest, targetSupportsThinking bool) ClaudeThinkingSanitizeResult {
	var result ClaudeThinkingSanitizeResult
	if req == nil {
		return result
	}
	if !targetSupportsThinking && req.Thinking != nil {
		req.Thinking = nil
		result.Changed = true
		result.RemovedRequestThinking = true
	}
	for i := range req.Messages {
		newContent, changed, removedThinking, removedRedacted, removedInvalid := sanitizeClaudeThinkingContent(req.Messages[i].Content, !targetSupportsThinking)
		if changed {
			req.Messages[i].Content = newContent
			result.Changed = true
			result.RemovedThinkingBlocks += removedThinking
			result.RemovedRedactedThinking += removedRedacted
			result.RemovedInvalidThinkingBlock += removedInvalid
		}
	}
	return result
}

func sanitizeClaudeThinkingContent(content any, removeAllThinking bool) (any, bool, int, int, int) {
	blocks, ok := claudeContentToBlocks(content)
	if !ok {
		return content, false, 0, 0, 0
	}
	filtered := make([]map[string]any, 0, len(blocks))
	changed := false
	removedThinking := 0
	removedRedacted := 0
	removedInvalid := 0
	for _, block := range blocks {
		blockType := strings.ToLower(common.Interface2String(block["type"]))
		if removeAllThinking {
			switch blockType {
			case "thinking":
				changed = true
				removedThinking++
				continue
			case "redacted_thinking":
				changed = true
				removedRedacted++
				continue
			}
		}
		if blockType == "thinking" {
			if thinking, ok := block["thinking"].(string); !ok || strings.TrimSpace(thinking) == "" {
				changed = true
				removedInvalid++
				continue
			}
		}
		filtered = append(filtered, block)
	}
	if !changed {
		return content, false, 0, 0, 0
	}
	return filtered, true, removedThinking, removedRedacted, removedInvalid
}

func claudeContentToBlocks(content any) ([]map[string]any, bool) {
	if content == nil {
		return nil, false
	}
	if _, ok := content.(string); ok {
		return nil, false
	}
	raw, err := common.Marshal(content)
	if err != nil {
		return nil, false
	}
	var blocks []map[string]any
	if err := common.Unmarshal(raw, &blocks); err != nil || len(blocks) == 0 {
		return nil, false
	}
	return blocks, true
}
