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
	ErrOpaquePayloadBlocked    = errors.New("opaque payload risk blocked")
	ErrOpaquePayloadSuspicious = errors.New("opaque payload suspicious")

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
	cfg = cfg.Normalized()
	if cfg.MaxScanBytes > 0 && len(text) > cfg.MaxScanBytes {
		text = text[:safeUTF8PrefixLen(text, cfg.MaxScanBytes)]
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
		score += 25
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
	return OpaqueScanError(result)
}

func ScanOpenAIOpaquePayload(resp *dto.OpenAITextResponse, cfg Config, userPrompt string) error {
	result := ScanOpenAIOpaquePayloadResult(resp, cfg, userPrompt)
	return OpaqueScanError(result)
}

func ScanOpenAIOpaquePayloadResult(resp *dto.OpenAITextResponse, cfg Config, userPrompt string) OpaqueScanResult {
	out := OpaqueScanResult{Action: OpaqueActionAllow}
	if resp == nil || !OpaqueScanEnabled(cfg) {
		return out
	}
	for _, choice := range resp.Choices {
		if choice.Message.IsStringContent() {
			result := ScanOpaquePayload(choice.Message.StringContent(), cfg, userPrompt)
			out = mergeOpaqueResult(out, result)
			if result.Action == OpaqueActionBlock {
				return out
			}
		}
	}
	return out
}

func ScanResponsesOpaquePayload(resp *dto.OpenAIResponsesResponse, cfg Config, userPrompt string) error {
	result := ScanResponsesOpaquePayloadResult(resp, cfg, userPrompt)
	return OpaqueScanError(result)
}

func ScanResponsesOpaquePayloadResult(resp *dto.OpenAIResponsesResponse, cfg Config, userPrompt string) OpaqueScanResult {
	out := OpaqueScanResult{Action: OpaqueActionAllow}
	if resp == nil || !OpaqueScanEnabled(cfg) {
		return out
	}
	for _, output := range resp.Output {
		for _, content := range output.Content {
			result := ScanOpaquePayload(content.Text, cfg, userPrompt)
			out = mergeOpaqueResult(out, result)
			if result.Action == OpaqueActionBlock {
				return out
			}
		}
	}
	return out
}

func ScanClaudeOpaquePayload(resp *dto.ClaudeResponse, cfg Config, userPrompt string) error {
	result := ScanClaudeOpaquePayloadResult(resp, cfg, userPrompt)
	return OpaqueScanError(result)
}

func OpaqueScanError(result OpaqueScanResult) error {
	switch result.Action {
	case OpaqueActionBlock:
		return ErrOpaquePayloadBlocked
	case OpaqueActionRetry:
		return ErrOpaquePayloadSuspicious
	default:
		return nil
	}
}

func ScanClaudeOpaquePayloadResult(resp *dto.ClaudeResponse, cfg Config, userPrompt string) OpaqueScanResult {
	out := OpaqueScanResult{Action: OpaqueActionAllow}
	if resp == nil || !OpaqueScanEnabled(cfg) {
		return out
	}
	for _, content := range resp.Content {
		if content.Type == "text" {
			result := ScanOpaquePayload(content.GetText(), cfg, userPrompt)
			out = mergeOpaqueResult(out, result)
			if result.Action == OpaqueActionBlock {
				return out
			}
		}
	}
	return out
}

func mergeOpaqueResult(a, b OpaqueScanResult) OpaqueScanResult {
	if b.Score > a.Score {
		a.Score = b.Score
	}
	if actionRank(b.Action) > actionRank(a.Action) {
		a.Action = b.Action
	}
	seen := map[string]bool{}
	for _, signal := range a.Signals {
		seen[signal] = true
	}
	for _, signal := range b.Signals {
		if !seen[signal] {
			a.Signals = append(a.Signals, signal)
			seen[signal] = true
		}
	}
	if a.Action == "" {
		a.Action = OpaqueActionAllow
	}
	return a
}

func actionRank(action string) int {
	switch action {
	case OpaqueActionBlock:
		return 3
	case OpaqueActionRetry:
		return 2
	case OpaqueActionAllow:
		return 1
	default:
		return 0
	}
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
		candidate := strings.Trim(match, "=")
		if len(candidate) < 80 {
			continue
		}
		for _, decoded := range decodeBase64Candidates(candidate) {
			lower := strings.ToLower(string(decoded))
			if strings.Contains(lower, "http://") || strings.Contains(lower, "https://") ||
				strings.Contains(lower, "<script") || strings.Contains(lower, "javascript:") {
				return true
			}
		}
	}
	return false
}

func decodeBase64Candidates(candidate string) [][]byte {
	decoders := []struct {
		encoding *base64.Encoding
		padded   bool
	}{
		{base64.StdEncoding, true},
		{base64.RawStdEncoding, false},
		{base64.URLEncoding, true},
		{base64.RawURLEncoding, false},
	}
	results := make([][]byte, 0, len(decoders))
	for _, decoder := range decoders {
		input := candidate
		if decoder.padded {
			input = padBase64(candidate)
		}
		decoded, err := decoder.encoding.DecodeString(input)
		if err == nil {
			results = append(results, decoded)
		}
	}
	return results
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
	var counts [256]int
	for i := 0; i < len(s); i++ {
		counts[s[i]]++
	}
	total := float64(len(s))
	var h float64
	for _, count := range counts {
		if count == 0 {
			continue
		}
		p := float64(count) / total
		h -= p * math.Log2(p)
	}
	return h
}
