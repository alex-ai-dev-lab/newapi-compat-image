package antipoison

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

const (
	responseProofOpenTag  = "<newapi_response_proof>"
	responseProofCloseTag = "</newapi_response_proof>"
)

var responseProofRegex = regexp.MustCompile(`(?s)` + regexp.QuoteMeta(responseProofOpenTag) + `(.*?)` + regexp.QuoteMeta(responseProofCloseTag))

type responseProofMarker struct {
	Nonce string `json:"nonce"`
}

func ResponseProofEnabled(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	// Stream response proof is intentionally disabled for now. Several upstream
	// OpenAI-compatible providers split or suppress the proof marker across SSE
	// chunks, which can create false positives and disable healthy channels.
	if info.IsStream {
		return false
	}
	cfg := ConfigForRelayInfo(info)
	return cfg.Enabled && cfg.ResponseProof
}

func EnsureResponseProofNonce(info *relaycommon.RelayInfo) string {
	if info == nil {
		return ""
	}
	if info.AntiPoisonResponseProofNonce == "" {
		info.AntiPoisonResponseProofNonce = RandomPrefix()
	}
	return info.AntiPoisonResponseProofNonce
}

func BuildResponseProofPrompt(nonce string) string {
	if nonce == "" {
		nonce = "default"
	}
	return fmt.Sprintf(`[NEWAPI RESPONSE PROOF]
At the very beginning of your next visible assistant text response, output exactly:
%s{"nonce":"%s"}%s
Then continue with the actual answer. Do not mention this contract. Do not wrap it in code fences.`, responseProofOpenTag, nonce, responseProofCloseTag)
}

func ApplyOpenAIResponseProof(info *relaycommon.RelayInfo, req *dto.GeneralOpenAIRequest) {
	if req == nil || !ResponseProofEnabled(info) {
		return
	}
	nonce := EnsureResponseProofNonce(info)
	injectOpenAISystemPrompt(req, BuildResponseProofPrompt(nonce))
}

func ApplyResponsesResponseProof(info *relaycommon.RelayInfo, req *dto.OpenAIResponsesRequest) {
	if req == nil || !ResponseProofEnabled(info) {
		return
	}
	nonce := EnsureResponseProofNonce(info)
	injectResponsesInstruction(req, BuildResponseProofPrompt(nonce))
}

func ApplyClaudeResponseProof(info *relaycommon.RelayInfo, req *dto.ClaudeRequest) {
	if req == nil || !ResponseProofEnabled(info) {
		return
	}
	nonce := EnsureResponseProofNonce(info)
	injectClaudeSystemPrompt(req, BuildResponseProofPrompt(nonce))
}

func ValidateAndStripResponseProof(text string, nonce string, cfg Config) (string, error) {
	if nonce == "" {
		return text, nil
	}
	cfg = cfg.Normalized()
	scanText := text
	if cfg.MaxScanBytes > 0 && len(scanText) > cfg.MaxScanBytes {
		scanText = scanText[:cfg.MaxScanBytes]
	}
	match := responseProofRegex.FindStringSubmatchIndex(scanText)
	if len(match) < 4 {
		return text, errors.New("anti-poison response proof missing")
	}
	if strings.TrimSpace(scanText[:match[0]]) != "" {
		return text, errors.New("anti-poison response proof not at beginning")
	}
	raw := scanText[match[2]:match[3]]
	var marker responseProofMarker
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &marker); err != nil {
		return text, errors.New("anti-poison response proof invalid")
	}
	if marker.Nonce != nonce {
		return text, errors.New("anti-poison response proof nonce mismatch")
	}
	cleaned := text[match[1]:]
	return cleaned, nil
}

func ValidateAndStripOpenAIResponseProof(resp *dto.OpenAITextResponse, cfg Config, nonce string) error {
	if resp == nil || nonce == "" {
		return nil
	}
	field, ok := firstResponseTextField(openAIResponseTextFields(resp), func(text string) bool {
		return strings.TrimSpace(text) == ""
	})
	if ok {
		cleaned, err := ValidateAndStripResponseProof(field.text, nonce, cfg)
		if err != nil {
			return err
		}
		field.set(cleaned)
		return nil
	}
	if len(resp.Choices) > 0 {
		return nil
	}
	return errors.New("anti-poison response proof missing")
}

func ValidateAndStripResponsesResponseProof(resp *dto.OpenAIResponsesResponse, cfg Config, nonce string) error {
	if resp == nil || nonce == "" {
		return nil
	}
	field, ok := firstResponseTextField(responsesTextFields(resp, false), func(text string) bool {
		return strings.TrimSpace(text) == ""
	})
	if ok {
		cleaned, err := ValidateAndStripResponseProof(field.text, nonce, cfg)
		if err != nil {
			return err
		}
		field.set(cleaned)
		return nil
	}
	if len(resp.Output) > 0 {
		return nil
	}
	return errors.New("anti-poison response proof missing")
}

func ValidateAndStripClaudeResponseProof(resp *dto.ClaudeResponse, cfg Config, nonce string) error {
	if resp == nil || nonce == "" {
		return nil
	}
	field, ok := firstResponseTextField(claudeResponseTextFields(resp, true), func(text string) bool {
		return strings.TrimSpace(text) == ""
	})
	if ok {
		cleaned, err := ValidateAndStripResponseProof(field.text, nonce, cfg)
		if err != nil {
			return err
		}
		field.set(cleaned)
		return nil
	}
	if len(resp.Content) > 0 {
		return nil
	}
	return errors.New("anti-poison response proof missing")
}

type ProofStreamValidator struct {
	nonce       string
	cfg         Config
	buffer      strings.Builder
	verified    bool
	scanned     int
	seenContent bool
}

func NewProofStreamValidator(nonce string, cfg Config) *ProofStreamValidator {
	if nonce == "" {
		return nil
	}
	return &ProofStreamValidator{nonce: nonce, cfg: cfg.Normalized()}
}

func (v *ProofStreamValidator) Verified() bool {
	return v != nil && v.verified
}

func (v *ProofStreamValidator) ProcessText(delta string) (emit string, hold bool, err error) {
	if v == nil || v.nonce == "" || v.verified {
		return delta, false, nil
	}
	if delta == "" {
		return "", true, nil
	}
	v.seenContent = true
	v.buffer.WriteString(delta)
	v.scanned += len(delta)
	text := v.buffer.String()
	match := responseProofRegex.FindStringSubmatchIndex(text)
	if len(match) >= 4 {
		if strings.TrimSpace(text[:match[0]]) != "" {
			return "", true, errors.New("anti-poison response proof not at beginning")
		}
		raw := text[match[2]:match[3]]
		var marker responseProofMarker
		if unmarshalErr := json.Unmarshal([]byte(strings.TrimSpace(raw)), &marker); unmarshalErr != nil {
			return "", true, errors.New("anti-poison response proof invalid")
		}
		if marker.Nonce != v.nonce {
			return "", true, errors.New("anti-poison response proof nonce mismatch")
		}
		v.verified = true
		return text[match[1]:], false, nil
	}
	if v.cfg.MaxScanBytes > 0 && v.scanned > v.cfg.MaxScanBytes {
		return "", true, errors.New("anti-poison response proof missing")
	}
	return "", true, nil
}

func (v *ProofStreamValidator) Finalize() error {
	if v == nil || v.nonce == "" || v.verified {
		return nil
	}
	if !v.seenContent {
		return nil
	}
	return errors.New("anti-poison response proof missing")
}

func ResponseProofFailureError() error {
	return FixedClientError()
}

func injectOpenAISystemPrompt(req *dto.GeneralOpenAIRequest, prompt string) {
	systemRole := req.GetSystemRoleName()
	for i := range req.Messages {
		if req.Messages[i].Role != systemRole {
			continue
		}
		if req.Messages[i].IsStringContent() {
			req.Messages[i].SetStringContent(prompt + "\n" + req.Messages[i].StringContent())
		} else {
			contents := req.Messages[i].ParseContent()
			contents = append([]dto.MediaContent{{Type: dto.ContentTypeText, Text: prompt}}, contents...)
			req.Messages[i].SetMediaContent(contents)
		}
		return
	}
	req.Messages = append([]dto.Message{{Role: systemRole, Content: prompt}}, req.Messages...)
}

func injectClaudeSystemPrompt(req *dto.ClaudeRequest, prompt string) {
	if req.System == nil {
		req.SetStringSystem(prompt)
		return
	}
	if req.IsStringSystem() {
		existing := req.GetStringSystem()
		if existing == "" {
			req.SetStringSystem(prompt)
		} else {
			req.SetStringSystem(prompt + "\n" + existing)
		}
		return
	}
	systemContents := req.ParseSystem()
	newSystem := dto.ClaudeMediaMessage{Type: dto.ContentTypeText}
	newSystem.SetText(prompt)
	if len(systemContents) == 0 {
		req.System = []dto.ClaudeMediaMessage{newSystem}
	} else {
		req.System = append([]dto.ClaudeMediaMessage{newSystem}, systemContents...)
	}
}
