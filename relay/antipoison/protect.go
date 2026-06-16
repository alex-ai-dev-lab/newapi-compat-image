package antipoison

import (
	"regexp"
	"strings"
)

// Sensitive-value detectors for request-side string protection. These match
// high-confidence secret shapes so that, when string protection is enabled, the
// gateway can avoid forwarding raw secrets to a potentially-poisoned upstream.
//
// We intentionally keep the set conservative (low false-positive) and only
// redact the matched value, never surrounding context.
var sensitivePatterns = []*regexp.Regexp{
	// Bearer tokens in Authorization-like contexts.
	regexp.MustCompile(`(?i)\bBearer\s+[A-Za-z0-9._\-]{16,}`),
	// OpenAI-style keys.
	regexp.MustCompile(`\bsk-[A-Za-z0-9._\-]{16,}`),
	// Anthropic-style keys.
	regexp.MustCompile(`\bsk-ant-[A-Za-z0-9._\-]{16,}`),
	// GitHub PAT.
	regexp.MustCompile(`\bgh[pousr]_[A-Za-z0-9]{20,}`),
	// AWS access key id.
	regexp.MustCompile(`\bAKIA[0-9A-Z]{16}\b`),
	// PEM private key blocks.
	regexp.MustCompile(`(?s)-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----`),
	// Generic long hex/base64-ish secrets assigned to a key-like field.
	regexp.MustCompile(`(?i)("?(?:api[_-]?key|secret|token|password)"?\s*[:=]\s*"?)[A-Za-z0-9._\-]{20,}`),
}

const redactedPlaceholder = "__AAD_REDACTED__"

// ProtectSensitiveStrings replaces high-confidence secret values in text with a
// placeholder. It returns the protected text and whether any replacement was
// made. The transformation is one-way; placeholders are NOT restored, because
// the upstream model never needs the real secret to produce a correct answer.
//
// This is deliberately a pure function for cheap testing and is only invoked
// when the channel enables string protection.
//
// When userAskedHandling is true (user explicitly asked to handle/process keys),
// protection is skipped to avoid breaking legitimate requests like "decode this JWT".
func ProtectSensitiveStrings(text string, userAskedHandling bool) (protected string, changed bool) {
	if text == "" || userAskedHandling {
		return text, false
	}
	out := text
	for _, re := range sensitivePatterns {
		if !re.MatchString(out) {
			continue
		}
		changed = true
		out = re.ReplaceAllStringFunc(out, func(match string) string {
			// For key:value style matches, preserve the field prefix so the JSON
			// stays structurally valid; only the value is redacted.
			if idx := strings.IndexAny(match, ":="); idx >= 0 {
				// Find where the value starts (after optional quote/space).
				prefixEnd := idx + 1
				for prefixEnd < len(match) && (match[prefixEnd] == ' ' || match[prefixEnd] == '"') {
					prefixEnd++
				}
				return match[:prefixEnd] + redactedPlaceholder
			}
			return redactedPlaceholder
		})
	}
	return out, changed
}
