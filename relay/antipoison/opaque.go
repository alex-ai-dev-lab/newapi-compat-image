package antipoison

import (
	"encoding/base64"
	"errors"
	"math"
	"regexp"
	"strings"
	"unicode"

	"github.com/QuantumNous/new-api/dto"
)

const (
	OpaqueActionAllow = "allow"
	OpaqueActionRetry = "retry"
	OpaqueActionBlock = "block"
)

type OpaqueScanResult struct {
	Score   int      `json:"score"`
	Action  string   `json:"action"`
	Signals []string `json:"signals"`
}

var (
	ErrOpaquePayloadBlocked = errors.New("opaque payload risk blocked")

	zeroWidthRe      = regexp.MustCompile(`[\x{200B}-\x{200F}\x{FEFF}]`)
	bidiOverrideRe   = regexp.MustCompile(`[\x{202A}-\x{202E}\x{2066}-\x{2069}]`)
	longBase64LikeRe = regexp.MustCompile(`[A-Za-z0-9+/=_-]{80,}`)
	longHexRe        = regexp.MustCompile(`(?i)\b[0-9a-f]{96,}\b`)
	percentDenseRe   = regexp.MustCompile(`(?:%[0-9a-fA-F]{2}){16,}`)
)

func ScanOpaquePayload(text string, cfg Config, userPrompt string) OpaqueScanResult {
	result := OpaqueScanResult{Action: OpaqueActionAllow}
	if !OpaqueScanEnabled(cfg) || strings.TrimSpace(text) == "" {
		return result
	}
	score := 0
	lowerPrompt := strings.ToLower(userPrompt)
	userAskedEncoding := strings.Contains(lowerPrompt, "base64") ||
		strings.Contains(lowerPrompt, "jwt") ||
		strings.Contains(lowerPrompt, "hash") ||
		strings.Contains(lowerPrompt, "hex") ||
		strings.Contains(lowerPrompt, "url encode") ||
		strings.Contains(lowerPrompt, "crypto") ||
		strings.Contains(lowerPrompt, "encrypt")

	if zeroWidthRe.MatchString(text) {
		score += 70
		result.Signals = append(result.Signals, "zero_width")
	}
	if bidiOverrideRe.MatchString(text) {
		score += 70
		result.Signals = append(result.Signals, "bidi_override")
	}
	if hasControlChars(text) {
		score += 50
		result.Signals = append(result.Signals, "control_chars")
	}
	if percentDenseRe.MatchString(text) {
		score += 25
		result.Signals = append(result.Signals, "dense_percent_encoding")
	}
	if longHexRe.MatchString(text) {
		score += 20
		result.Signals = append(result.Signals, "long_hex")
	}
	if matches := longBase64LikeRe.FindAllString(text, -1); len(matches) > 0 {
		score += 25
		result.Signals = append(result.Signals, "long_base64")
		if decodedLooksRisky(matches) {
			score += 30
			result.Signals = append(result.Signals, "decoded_contains_url_or_script_like")
		}
	}
	if highEntropySegment(text) {
		score += 25
		result.Signals = append(result.Signals, "high_entropy_segment")
	}
	if strings.Contains(text, "```") {
		score -= 20
	}
	if userAskedEncoding {
		score -= 40
	}
	if cfg.Profile == "trusted" {
		score -= 30
	}
	if OpaqueScanStrict(cfg) {
		score += 20
	}
	if score < 0 {
		score = 0
	}
	result.Score = score
	switch {
	case score >= 80:
		result.Action = OpaqueActionBlock
	case score >= 50:
		result.Action = OpaqueActionRetry
	default:
		result.Action = OpaqueActionAllow
	}
	return result
}

func ValidateOpaquePayload(text string, cfg Config, userPrompt string) error {
	result := ScanOpaquePayload(text, cfg, userPrompt)
	if result.Action == OpaqueActionBlock {
		return ErrOpaquePayloadBlocked
	}
	return nil
}

func ScanOpenAIOpaquePayload(resp *dto.OpenAITextResponse, cfg Config, userPrompt string) error {
	if resp == nil || !OpaqueScanEnabled(cfg) {
		return nil
	}
	for _, choice := range resp.Choices {
		if choice.Message.IsStringContent() {
			if err := ValidateOpaquePayload(choice.Message.StringContent(), cfg, userPrompt); err != nil {
				return err
			}
		}
	}
	return nil
}

func ScanResponsesOpaquePayload(resp *dto.OpenAIResponsesResponse, cfg Config, userPrompt string) error {
	if resp == nil || !OpaqueScanEnabled(cfg) {
		return nil
	}
	for _, output := range resp.Output {
		for _, content := range output.Content {
			if err := ValidateOpaquePayload(content.Text, cfg, userPrompt); err != nil {
				return err
			}
		}
	}
	return nil
}

func ScanClaudeOpaquePayload(resp *dto.ClaudeResponse, cfg Config, userPrompt string) error {
	if resp == nil || !OpaqueScanEnabled(cfg) {
		return nil
	}
	for _, content := range resp.Content {
		if content.Type == "text" {
			if err := ValidateOpaquePayload(content.GetText(), cfg, userPrompt); err != nil {
				return err
			}
		}
	}
	return nil
}

func hasControlChars(text string) bool {
	for _, r := range text {
		if unicode.IsControl(r) && r != '\n' && r != '\r' && r != '\t' {
			return true
		}
	}
	return false
}

func decodedLooksRisky(matches []string) bool {
	for _, match := range matches {
		candidate := strings.Trim(match, "=_-")
		if len(candidate) < 80 {
			continue
		}
		decoded, err := base64.StdEncoding.DecodeString(padBase64(candidate))
		if err != nil {
			decoded, err = base64.RawStdEncoding.DecodeString(candidate)
		}
		if err != nil {
			continue
		}
		lower := strings.ToLower(string(decoded))
		if strings.Contains(lower, "http://") || strings.Contains(lower, "https://") ||
			strings.Contains(lower, "<script") || strings.Contains(lower, "javascript:") {
			return true
		}
	}
	return false
}

func padBase64(s string) string {
	switch len(s) % 4 {
	case 2:
		return s + "=="
	case 3:
		return s + "="
	default:
		return s
	}
}

func highEntropySegment(text string) bool {
	for _, field := range strings.Fields(text) {
		if len(field) < 80 {
			continue
		}
		if entropy(field) >= 4.5 {
			return true
		}
	}
	return false
}

func entropy(s string) float64 {
	if s == "" {
		return 0
	}
	counts := make(map[rune]int)
	for _, r := range s {
		counts[r]++
	}
	total := float64(len([]rune(s)))
	var h float64
	for _, count := range counts {
		p := float64(count) / total
		h -= p * math.Log2(p)
	}
	return h
}
