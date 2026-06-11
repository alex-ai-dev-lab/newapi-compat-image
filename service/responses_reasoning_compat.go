package service

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

type ResponsesReasoningContentSanitizeResult struct {
	Changed                 bool
	RemovedReasoningContent int
}

func SanitizeResponsesReasoningContent(req *dto.OpenAIResponsesRequest) ResponsesReasoningContentSanitizeResult {
	if req == nil || len(req.Input) == 0 {
		return ResponsesReasoningContentSanitizeResult{}
	}
	nextInput, removed, changed := sanitizeResponsesReasoningContentJSON(req.Input)
	if !changed {
		return ResponsesReasoningContentSanitizeResult{}
	}
	req.Input = nextInput
	return ResponsesReasoningContentSanitizeResult{
		Changed:                 true,
		RemovedReasoningContent: removed,
	}
}

func sanitizeResponsesReasoningContentJSON(raw json.RawMessage) (json.RawMessage, int, bool) {
	var v any
	if err := common.Unmarshal(raw, &v); err != nil {
		return raw, 0, false
	}
	next, removed, changed := sanitizeResponsesReasoningContentValue(v, false)
	if !changed {
		return raw, 0, false
	}
	data, err := common.Marshal(next)
	if err != nil {
		return raw, 0, false
	}
	return data, removed, true
}

func sanitizeResponsesReasoningContentValue(v any, parentIsReasoning bool) (any, int, bool) {
	switch t := v.(type) {
	case []any:
		next := make([]any, 0, len(t))
		removed := 0
		changed := false
		for _, item := range t {
			cleaned, itemRemoved, itemChanged := sanitizeResponsesReasoningContentValue(item, false)
			removed += itemRemoved
			changed = changed || itemChanged
			next = append(next, cleaned)
		}
		return next, removed, changed
	case map[string]any:
		isReasoning := parentIsReasoning
		if typ, _ := t["type"].(string); typ == "reasoning" {
			isReasoning = true
		}
		next := make(map[string]any, len(t))
		removed := 0
		changed := false
		for key, value := range t {
			if isReasoning && key == "content" {
				if items, ok := value.([]any); ok && len(items) > 0 {
					removed++
					changed = true
					continue
				}
			}
			cleaned, itemRemoved, itemChanged := sanitizeResponsesReasoningContentValue(value, isReasoning)
			removed += itemRemoved
			changed = changed || itemChanged
			next[key] = cleaned
		}
		return next, removed, changed
	default:
		return v, 0, false
	}
}
