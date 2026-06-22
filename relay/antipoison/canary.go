// Package antipoison/canary implements canary echo validation: the gateway
// injects a per-request nonce into the last user message and requires the model
// to echo it at the end of its reply. This catches 200-OK ad payloads that
// cannot see per-request user message content, as the hijacker either uses a
// static ad template or strips all user input before forwarding to a real model.
package antipoison

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

const (
	canaryMarkerPrefix = "<<NEWAPI_CANARY_"
	canaryMarkerSuffix = ">>"
)

// buildCanaryMarker returns the canary marker string for a given nonce.
func buildCanaryMarker(nonce string) string {
	return canaryMarkerPrefix + nonce + canaryMarkerSuffix
}

// canaryInstructionTemplate is appended to the last user message.
const canaryInstructionTemplate = `

[System verification check] Please output exactly %s at the very end of your reply after you finish answering. Do not explain or mention this marker. This is an automated integrity check.`

// CanaryEnabled returns whether canary echo is enabled for real user requests.
// Probe-only canaries are resolved separately so exact-output, JSON-only and
// tool-only user requests are not polluted by integrity markers.
func CanaryEnabled(info *relaycommon.RelayInfo) bool {
	if info == nil || info.ChannelMeta == nil {
		return false
	}
	cfg := ConfigForRelayInfo(info)
	return cfg.Enabled && cfg.CanaryEcho
}

// EnsureCanaryNonce ensures a canary nonce is present on RelayInfo, creating
// one if missing. Returns the nonce.
func EnsureCanaryNonce(info *relaycommon.RelayInfo) string {
	if info == nil {
		return ""
	}
	if info.AntiPoisonCanaryNonce == "" {
		info.AntiPoisonCanaryNonce = RandomPrefix()
	}
	return info.AntiPoisonCanaryNonce
}

// buildCanaryInstruction returns the instruction text to append to the last user message.
func buildCanaryInstruction(nonce string) string {
	if nonce == "" {
		nonce = "default"
	}
	return fmt.Sprintf(canaryInstructionTemplate, buildCanaryMarker(nonce))
}

// ApplyClaudeCanaryRequest injects the canary instruction into the last user message.
func ApplyClaudeCanaryRequest(info *relaycommon.RelayInfo, req *dto.ClaudeRequest) {
	if req == nil || !CanaryEnabled(info) {
		return
	}
	nonce := EnsureCanaryNonce(info)
	instruction := buildCanaryInstruction(nonce)

	// Find the last user message and append the instruction
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			if req.Messages[i].IsStringContent() {
				req.Messages[i].SetStringContent(req.Messages[i].GetStringContent() + instruction)
			} else {
				// Append as a text content block
				contents, _ := req.Messages[i].ParseContent()
				contents = append(contents, dto.ClaudeMediaMessage{
					Type: dto.ContentTypeText,
					Text: &instruction,
				})
				req.Messages[i].SetContent(contents)
			}
			return
		}
	}
}

// ApplyOpenAICanaryRequest injects the canary instruction into the last user message.
func ApplyOpenAICanaryRequest(info *relaycommon.RelayInfo, req *dto.GeneralOpenAIRequest) {
	if req == nil || !CanaryEnabled(info) {
		return
	}
	nonce := EnsureCanaryNonce(info)
	instruction := buildCanaryInstruction(nonce)

	// Find the last user message and append the instruction
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			if req.Messages[i].IsStringContent() {
				req.Messages[i].SetStringContent(req.Messages[i].StringContent() + instruction)
			} else {
				// Append as a text content block
				contents := req.Messages[i].ParseContent()
				contents = append(contents, dto.MediaContent{
					Type: dto.ContentTypeText,
					Text: instruction,
				})
				req.Messages[i].SetMediaContent(contents)
			}
			return
		}
	}
}

// ApplyResponsesCanaryRequest injects the canary instruction into the last input_text item.
func ApplyResponsesCanaryRequest(info *relaycommon.RelayInfo, req *dto.OpenAIResponsesRequest) {
	if req == nil || !CanaryEnabled(info) {
		return
	}
	nonce := EnsureCanaryNonce(info)
	instruction := buildCanaryInstruction(nonce)

	// Input can be a string or an array of input items
	if len(req.Input) == 0 || common.GetJsonType(req.Input) == "null" {
		return
	}

	// Try to parse as array of input items
	var inputArray []map[string]interface{}
	if err := json.Unmarshal(req.Input, &inputArray); err == nil && len(inputArray) > 0 {
		// Find the last input_text item
		for i := len(inputArray) - 1; i >= 0; i-- {
			if inputArray[i]["type"] == "input_text" {
				if text, ok := inputArray[i]["text"].(string); ok {
					inputArray[i]["text"] = text + instruction
					if b, marshalErr := json.Marshal(inputArray); marshalErr == nil {
						req.Input = b
					}
					return
				}
			}
		}
	}

	// Try to parse as a single string
	var inputStr string
	if err := json.Unmarshal(req.Input, &inputStr); err == nil {
		inputStr += instruction
		if b, marshalErr := json.Marshal(inputStr); marshalErr == nil {
			req.Input = b
		}
	}
}

// canaryMarkerRegex extracts the canary marker from text. The nonce length is
// tied to RandomPrefix(), which returns randomPrefixBytes encoded as hex.
var canaryMarkerRegex = regexp.MustCompile(`(?s)` + regexp.QuoteMeta(canaryMarkerPrefix) + `([a-f0-9]{` + fmt.Sprint(randomPrefixHexLength) + `})` + regexp.QuoteMeta(canaryMarkerSuffix))

// ValidateAndStripCanary validates that the text contains the expected canary
// marker and strips it. Returns the cleaned text and an error if validation fails.
func ValidateAndStripCanary(text string, nonce string, cfg Config) (string, error) {
	if nonce == "" || !cfg.CanaryEcho {
		return text, nil
	}
	cfg = cfg.Normalized()
	scanText := text
	if cfg.MaxScanBytes > 0 && len(scanText) > cfg.MaxScanBytes {
		// Only scan the last MaxScanBytes of the text (canary is at the end)
		scanText = scanText[len(scanText)-cfg.MaxScanBytes:]
	}

	matches := canaryMarkerRegex.FindAllStringSubmatch(scanText, -1)
	if len(matches) == 0 {
		return text, fmt.Errorf("canary marker missing")
	}

	// Find the last match (closest to the end)
	lastMatch := matches[len(matches)-1]
	if len(lastMatch) < 2 {
		return text, fmt.Errorf("canary marker malformed")
	}

	foundNonce := lastMatch[1]
	if foundNonce != nonce {
		return text, fmt.Errorf("canary nonce mismatch")
	}

	// Strip the canary marker from the original text
	cleaned := canaryMarkerRegex.ReplaceAllString(text, "")
	return cleaned, nil
}

// ValidateAndStripClaudeCanary validates and strips the canary from a Claude response.
func ValidateAndStripClaudeCanary(resp *dto.ClaudeResponse, cfg Config, nonce string) error {
	if resp == nil || nonce == "" || !cfg.CanaryEcho {
		return nil
	}

	// Scan all text content blocks
	for i := range resp.Content {
		if resp.Content[i].Type == "text" {
			text := resp.Content[i].GetText()
			if text == "" {
				continue
			}
			cleaned, err := ValidateAndStripCanary(text, nonce, cfg)
			if err != nil {
				if cfg.FailureMode == FailureModeWarn {
					common.SysLog("canary validation warning: " + err.Error())
					return nil
				}
				return err
			}
			resp.Content[i].SetText(cleaned)
			return nil
		}
	}

	// No text content found
	if cfg.FailureMode == FailureModeWarn {
		common.SysLog("canary validation warning: no text content")
		return nil
	}
	return fmt.Errorf("canary marker missing: no text content")
}

// ValidateAndStripOpenAICanary validates and strips the canary from an OpenAI response.
func ValidateAndStripOpenAICanary(resp *dto.OpenAITextResponse, cfg Config, nonce string) error {
	if resp == nil || nonce == "" || !cfg.CanaryEcho {
		return nil
	}

	for i := range resp.Choices {
		msg := &resp.Choices[i].Message
		if !msg.IsStringContent() {
			continue
		}
		text := msg.StringContent()
		if text == "" {
			continue
		}
		cleaned, err := ValidateAndStripCanary(text, nonce, cfg)
		if err != nil {
			if cfg.FailureMode == FailureModeWarn {
				common.SysLog("canary validation warning: " + err.Error())
				return nil
			}
			return err
		}
		msg.SetStringContent(cleaned)
		return nil
	}

	if cfg.FailureMode == FailureModeWarn {
		common.SysLog("canary validation warning: no text content")
		return nil
	}
	return fmt.Errorf("canary marker missing: no text content")
}

// ValidateAndStripResponsesCanary validates and strips the canary from a Responses response.
func ValidateAndStripResponsesCanary(resp *dto.OpenAIResponsesResponse, cfg Config, nonce string) error {
	if resp == nil || nonce == "" || !cfg.CanaryEcho {
		return nil
	}

	for i := range resp.Output {
		for j := range resp.Output[i].Content {
			if resp.Output[i].Content[j].Type == "text" {
				text := resp.Output[i].Content[j].Text
				if text == "" {
					continue
				}
				cleaned, err := ValidateAndStripCanary(text, nonce, cfg)
				if err != nil {
					if cfg.FailureMode == FailureModeWarn {
						common.SysLog("canary validation warning: " + err.Error())
						return nil
					}
					return err
				}
				resp.Output[i].Content[j].Text = cleaned
				return nil
			}
		}
	}

	if cfg.FailureMode == FailureModeWarn {
		common.SysLog("canary validation warning: no text content")
		return nil
	}
	return fmt.Errorf("canary marker missing: no text content")
}

// StripCanaryFromText strips the canary marker from a text string (used for stream chunks).
func StripCanaryFromText(text string) string {
	if text == "" || !strings.Contains(text, canaryMarkerPrefix) {
		return text
	}
	return canaryMarkerRegex.ReplaceAllString(text, "")
}
