package antipoison

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/dto"
)

var (
	ErrEnvelopeMissing       = errors.New("answer envelope missing")
	ErrEnvelopeNonceMismatch = errors.New("answer envelope nonce mismatch")
	ErrEnvelopeOutsideText   = errors.New("answer envelope outside text")
	ErrEnvelopeMalformed     = errors.New("answer envelope malformed")
)

var answerEnvelopeRegex = regexp.MustCompile(`(?s)<newapi_answer\s+nonce="([^"]+)">(.*)</newapi_answer>`)

type answerEnvelopeJSON struct {
	Nonce  string `json:"newapi_nonce"`
	Answer string `json:"answer"`
}

func BuildAnswerEnvelopePrompt(nonce string) string {
	if nonce == "" {
		nonce = RandomPrefix()
	}
	return `Return the final answer inside this exact envelope and do not output any text outside it:
<newapi_answer nonce="` + nonce + `">
actual answer
</newapi_answer>
For JSON-only responses, return {"newapi_nonce":"` + nonce + `","answer":"actual answer"} with no surrounding text.`
}

func ValidateAndExtractAnswerEnvelope(text string, nonce string, cfg Config) (string, error) {
	if !EnvelopeRequired(cfg, false) || nonce == "" {
		return text, nil
	}
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return text, ErrEnvelopeMissing
	}
	if strings.HasPrefix(trimmed, "{") {
		return validateJSONEnvelope(trimmed, nonce)
	}
	matches := answerEnvelopeRegex.FindAllStringSubmatch(trimmed, -1)
	if len(matches) == 0 {
		return text, ErrEnvelopeMissing
	}
	if len(matches) != 1 {
		return text, ErrEnvelopeMalformed
	}
	full := matches[0][0]
	if strings.TrimSpace(strings.Replace(trimmed, full, "", 1)) != "" {
		return text, ErrEnvelopeOutsideText
	}
	if matches[0][1] != nonce {
		return text, ErrEnvelopeNonceMismatch
	}
	return matches[0][2], nil
}

func validateJSONEnvelope(text string, nonce string) (string, error) {
	var env answerEnvelopeJSON
	if err := json.Unmarshal([]byte(text), &env); err != nil {
		return text, ErrEnvelopeMalformed
	}
	if env.Nonce == "" || env.Answer == "" {
		return text, ErrEnvelopeMalformed
	}
	if env.Nonce != nonce {
		return text, ErrEnvelopeNonceMismatch
	}
	return env.Answer, nil
}

func ValidateAndStripOpenAIAnswerEnvelope(resp *dto.OpenAITextResponse, nonce string, cfg Config) error {
	if resp == nil || !EnvelopeRequired(cfg, false) {
		return nil
	}
	for i := range resp.Choices {
		msg := &resp.Choices[i].Message
		if !msg.IsStringContent() {
			continue
		}
		cleaned, err := ValidateAndExtractAnswerEnvelope(msg.StringContent(), nonce, cfg)
		if err != nil {
			return err
		}
		msg.SetStringContent(cleaned)
		return nil
	}
	return ErrEnvelopeMissing
}

func ValidateAndStripResponsesAnswerEnvelope(resp *dto.OpenAIResponsesResponse, nonce string, cfg Config) error {
	if resp == nil || !EnvelopeRequired(cfg, false) {
		return nil
	}
	for i := range resp.Output {
		for j := range resp.Output[i].Content {
			if strings.TrimSpace(resp.Output[i].Content[j].Text) == "" {
				continue
			}
			cleaned, err := ValidateAndExtractAnswerEnvelope(resp.Output[i].Content[j].Text, nonce, cfg)
			if err != nil {
				return err
			}
			resp.Output[i].Content[j].Text = cleaned
			return nil
		}
	}
	return ErrEnvelopeMissing
}

func ValidateAndStripClaudeAnswerEnvelope(resp *dto.ClaudeResponse, nonce string, cfg Config) error {
	if resp == nil || !EnvelopeRequired(cfg, false) {
		return nil
	}
	for i := range resp.Content {
		if resp.Content[i].Type != "text" || strings.TrimSpace(resp.Content[i].GetText()) == "" {
			continue
		}
		cleaned, err := ValidateAndExtractAnswerEnvelope(resp.Content[i].GetText(), nonce, cfg)
		if err != nil {
			return err
		}
		resp.Content[i].SetText(cleaned)
		return nil
	}
	return ErrEnvelopeMissing
}
