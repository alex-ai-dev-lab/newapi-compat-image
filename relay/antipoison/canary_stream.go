package antipoison

import (
	"fmt"
	"strings"
)

// CanaryStreamValidator buffers the tail of a streaming response to locate and
// validate the canary marker, which is expected at the end. It holds back the
// last N bytes to ensure the canary can be stripped cleanly even when split
// across SSE chunks.
type CanaryStreamValidator struct {
	nonce      string
	cfg        Config
	buffer     strings.Builder
	tailHold   int // bytes to hold back before emitting
	verified   bool
	seenText   bool
	totalBytes int
}

// NewCanaryStreamValidator creates a new canary stream validator.
// tailHold specifies how many bytes to buffer at the end before emitting.
// A reasonable default is 256 bytes (enough to hold the canary marker + instruction).
func NewCanaryStreamValidator(nonce string, cfg Config, tailHold int) *CanaryStreamValidator {
	if nonce == "" || !cfg.CanaryEcho {
		return nil
	}
	if tailHold <= 0 {
		tailHold = 256
	}
	return &CanaryStreamValidator{
		nonce:    nonce,
		cfg:      cfg.Normalized(),
		tailHold: tailHold,
	}
}

// Verified returns whether the canary has been validated.
func (v *CanaryStreamValidator) Verified() bool {
	return v != nil && v.verified
}

// ProcessText processes a text delta from the stream. It buffers the tail and
// returns the portion that can be safely emitted. When the canary is found, it
// is stripped and verified flag is set.
//
// Returns:
//   - emit: the text that can be sent to the client now
//   - hold: whether to hold this chunk (not emit yet)
//   - err: validation error if the canary is malformed or mismatched
func (v *CanaryStreamValidator) ProcessText(delta string) (emit string, hold bool, err error) {
	if v == nil || v.nonce == "" || v.verified {
		return delta, false, nil
	}

	if delta == "" {
		return "", false, nil
	}

	v.seenText = true
	v.buffer.WriteString(delta)
	v.totalBytes += len(delta)

	accumulated := v.buffer.String()

	// Check if the canary marker is present
	if strings.Contains(accumulated, canaryMarkerPrefix) {
		cleaned, err := ValidateAndStripCanary(accumulated, v.nonce, v.cfg)
		if err != nil {
			return "", true, err
		}
		v.verified = true
		// Emit all buffered content with canary stripped
		return cleaned, false, nil
	}

	// Not found yet. If we have more than tailHold bytes, emit the excess.
	if len(accumulated) > v.tailHold {
		emitLen := len(accumulated) - v.tailHold
		emit = accumulated[:emitLen]
		// Keep only the tail in the buffer
		v.buffer.Reset()
		v.buffer.WriteString(accumulated[emitLen:])
		return emit, false, nil
	}

	// Not enough accumulated yet, hold everything
	return "", true, nil
}

// Finalize is called at the end of the stream to validate that the canary was
// found. If not, it returns an error.
func (v *CanaryStreamValidator) Finalize() error {
	if v == nil || v.nonce == "" || v.verified {
		return nil
	}
	if !v.seenText {
		// No text content at all, treat as pass (e.g., tool-only response)
		return nil
	}

	// Check one last time in the buffered tail
	accumulated := v.buffer.String()
	if strings.Contains(accumulated, canaryMarkerPrefix) {
		_, err := ValidateAndStripCanary(accumulated, v.nonce, v.cfg)
		if err != nil {
			if v.cfg.FailureMode == FailureModeWarn {
				// Warn and pass
				return nil
			}
			return err
		}
		v.verified = true
		return nil
	}

	if v.cfg.FailureMode == FailureModeWarn {
		return nil
	}
	return fmt.Errorf("canary marker missing at stream end")
}

// Flush returns any remaining buffered text that was held back. Call this after
// Finalize() succeeds to emit the final tail (with canary stripped).
func (v *CanaryStreamValidator) Flush() string {
	if v == nil {
		return ""
	}
	tail := v.buffer.String()
	v.buffer.Reset()
	// Strip any remaining canary marker
	return StripCanaryFromText(tail)
}
