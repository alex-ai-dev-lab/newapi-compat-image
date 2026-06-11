package service

import (
	"bytes"
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
)

type EncryptedReasoningRequestInfo struct {
	HasEncryptedReasoning bool
	HasReasoningItem      bool
	HasPreviousResponseID bool
}

type EncryptedReasoningScrubResult struct {
	Changed                 bool
	RemovedEncryptedFields  int
	RemovedReasoningItems   int
	RemovedIncludeEntries   int
	RemovedPreviousResponse bool
}

func AnalyzeEncryptedReasoningRequest(req *dto.OpenAIResponsesRequest) EncryptedReasoningRequestInfo {
	if req == nil {
		return EncryptedReasoningRequestInfo{}
	}
	info := EncryptedReasoningRequestInfo{
		HasPreviousResponseID: strings.TrimSpace(req.PreviousResponseID) != "",
	}
	if includeHasEncryptedReasoning(req.Include) {
		info.HasEncryptedReasoning = true
	}
	if hasEncryptedContentJSON(req.Input) {
		info.HasEncryptedReasoning = true
	}
	if hasReasoningItemJSON(req.Input) {
		info.HasReasoningItem = true
	}
	return info
}

func ShouldUseEncryptedReasoningCompat(req *dto.OpenAIResponsesRequest) bool {
	info := AnalyzeEncryptedReasoningRequest(req)
	return info.HasEncryptedReasoning || info.HasReasoningItem || info.HasPreviousResponseID
}

func ScrubEncryptedReasoningRequest(req *dto.OpenAIResponsesRequest) EncryptedReasoningScrubResult {
	if req == nil {
		return EncryptedReasoningScrubResult{}
	}
	var result EncryptedReasoningScrubResult
	req.Include, result.RemovedIncludeEntries = scrubEncryptedReasoningInclude(req.Include)
	if result.RemovedIncludeEntries > 0 {
		result.Changed = true
	}
	if strings.TrimSpace(req.PreviousResponseID) != "" {
		req.PreviousResponseID = ""
		result.RemovedPreviousResponse = true
		result.Changed = true
	}
	if len(req.Input) > 0 {
		nextInput, removedFields, removedItems, changed := scrubEncryptedReasoningJSON(req.Input)
		if changed {
			req.Input = nextInput
			result.Changed = true
			result.RemovedEncryptedFields += removedFields
			result.RemovedReasoningItems += removedItems
		}
	}
	return result
}

func ShouldFallbackEncryptedReasoningError(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	setting := operation_setting.GetEncryptedReasoningFallbackSetting()
	if setting != nil && strings.TrimSpace(setting.FallbackStatusCodes) != "" {
		ranges, parseErr := operation_setting.ParseHTTPStatusCodeRanges(setting.FallbackStatusCodes)
		if parseErr == nil && shouldMatchEncryptedReasoningStatusCode(ranges, err.StatusCode) {
			return true
		}
	}
	msg := strings.ToLower(err.Error())
	code := strings.ToLower(string(err.GetErrorCode()))
	for _, needle := range operation_setting.EncryptedReasoningFallbackErrorTexts() {
		if strings.Contains(msg, needle) || strings.Contains(code, needle) {
			return true
		}
	}
	return false
}

func IsInvalidEncryptedReasoningError(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	code := strings.ToLower(string(err.GetErrorCode()))
	return strings.Contains(msg, "invalid_encrypted_content") ||
		strings.Contains(code, "invalid_encrypted_content") ||
		strings.Contains(msg, "encrypted content could not be decrypted or parsed") ||
		strings.Contains(msg, "could not be decrypted")
}

func shouldMatchEncryptedReasoningStatusCode(ranges []operation_setting.StatusCodeRange, code int) bool {
	if code < 100 || code > 599 {
		return false
	}
	for _, r := range ranges {
		if code < r.Start {
			return false
		}
		if code <= r.End {
			return true
		}
	}
	return false
}

func includeHasEncryptedReasoning(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	var items []string
	if err := common.Unmarshal(raw, &items); err != nil {
		return bytes.Contains(bytes.ToLower(raw), []byte(`reasoning.encrypted_content`))
	}
	for _, item := range items {
		if item == "reasoning.encrypted_content" {
			return true
		}
	}
	return false
}

func scrubEncryptedReasoningInclude(raw json.RawMessage) (json.RawMessage, int) {
	if len(raw) == 0 {
		return raw, 0
	}
	var items []string
	if err := common.Unmarshal(raw, &items); err != nil {
		return raw, 0
	}
	next := items[:0]
	removed := 0
	for _, item := range items {
		if item == "reasoning.encrypted_content" {
			removed++
			continue
		}
		next = append(next, item)
	}
	if removed == 0 {
		return raw, 0
	}
	if len(next) == 0 {
		return nil, removed
	}
	data, err := common.Marshal(next)
	if err != nil {
		return raw, 0
	}
	return data, removed
}

func hasEncryptedContentJSON(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	var v any
	if err := common.Unmarshal(raw, &v); err != nil {
		return bytes.Contains(bytes.ToLower(raw), []byte(`encrypted_content`))
	}
	return hasEncryptedContentValue(v)
}

func hasReasoningItemJSON(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	var v any
	if err := common.Unmarshal(raw, &v); err != nil {
		return bytes.Contains(bytes.ToLower(raw), []byte(`"type":"reasoning"`)) ||
			bytes.Contains(bytes.ToLower(raw), []byte(`"type": "reasoning"`))
	}
	return hasReasoningItemValue(v)
}

func scrubEncryptedReasoningJSON(raw json.RawMessage) (json.RawMessage, int, int, bool) {
	var v any
	if err := common.Unmarshal(raw, &v); err != nil {
		return raw, 0, 0, false
	}
	next, removedFields, removedItems, changed := scrubEncryptedReasoningValue(v)
	if !changed {
		return raw, 0, 0, false
	}
	data, err := common.Marshal(next)
	if err != nil {
		return raw, 0, 0, false
	}
	return data, removedFields, removedItems, true
}

func hasEncryptedContentValue(v any) bool {
	switch t := v.(type) {
	case map[string]any:
		if _, ok := t["encrypted_content"]; ok {
			return true
		}
		for _, value := range t {
			if hasEncryptedContentValue(value) {
				return true
			}
		}
	case []any:
		for _, item := range t {
			if hasEncryptedContentValue(item) {
				return true
			}
		}
	}
	return false
}

func hasReasoningItemValue(v any) bool {
	switch t := v.(type) {
	case map[string]any:
		if typ, _ := t["type"].(string); typ == "reasoning" {
			return true
		}
		for _, value := range t {
			if hasReasoningItemValue(value) {
				return true
			}
		}
	case []any:
		for _, item := range t {
			if hasReasoningItemValue(item) {
				return true
			}
		}
	}
	return false
}

func scrubEncryptedReasoningValue(v any) (any, int, int, bool) {
	switch t := v.(type) {
	case []any:
		next := make([]any, 0, len(t))
		removedFields := 0
		removedItems := 0
		changed := false
		for _, item := range t {
			if m, ok := item.(map[string]any); ok {
				if typ, _ := m["type"].(string); typ == "reasoning" {
					removedItems++
					changed = true
					continue
				}
			}
			cleaned, fields, items, itemChanged := scrubEncryptedReasoningValue(item)
			removedFields += fields
			removedItems += items
			changed = changed || itemChanged
			next = append(next, cleaned)
		}
		return next, removedFields, removedItems, changed
	case map[string]any:
		next := make(map[string]any, len(t))
		removedFields := 0
		removedItems := 0
		changed := false
		for key, value := range t {
			if key == "encrypted_content" {
				removedFields++
				changed = true
				continue
			}
			cleaned, fields, items, itemChanged := scrubEncryptedReasoningValue(value)
			removedFields += fields
			removedItems += items
			changed = changed || itemChanged
			next[key] = cleaned
		}
		return next, removedFields, removedItems, changed
	default:
		return v, 0, 0, false
	}
}
