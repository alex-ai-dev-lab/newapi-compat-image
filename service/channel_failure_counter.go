package service

import (
	"strconv"
	"sync"
	"time"
)

// ChannelConsecutiveDisableThreshold is the number of consecutive failures on the
// same channel+model that must accumulate before the channel is auto-disabled.
// Unified to 3 so that a single transient upstream error no longer hard-disables
// a channel.
const ChannelConsecutiveDisableThreshold = 3

const channelConsecutiveFailureTTL = 10 * time.Minute

type channelConsecutiveFailureState struct {
	count       int
	lastFailure time.Time
}

var channelConsecutiveFailureTracker = struct {
	sync.Mutex
	items map[string]channelConsecutiveFailureState
}{
	items: make(map[string]channelConsecutiveFailureState),
}

func channelConsecutiveFailureKey(channelID int, model string) string {
	return strconv.Itoa(channelID) + "|" + model
}

// RecordChannelConsecutiveFailure increments and returns the consecutive failure
// count for the given channel+model. Counts older than the TTL are reset first so
// that intermittent, widely-spaced failures do not accumulate forever.
func RecordChannelConsecutiveFailure(channelID int, model string) int {
	if channelID <= 0 {
		return 0
	}
	now := time.Now()
	key := channelConsecutiveFailureKey(channelID, model)

	channelConsecutiveFailureTracker.Lock()
	defer channelConsecutiveFailureTracker.Unlock()

	state := channelConsecutiveFailureTracker.items[key]
	if !state.lastFailure.IsZero() && now.Sub(state.lastFailure) > channelConsecutiveFailureTTL {
		state.count = 0
	}
	state.count++
	state.lastFailure = now
	channelConsecutiveFailureTracker.items[key] = state
	return state.count
}

// PeekChannelConsecutiveFailure returns the current consecutive failure count
// without mutating it. Counts older than the TTL are treated as zero.
func PeekChannelConsecutiveFailure(channelID int, model string) int {
	if channelID <= 0 {
		return 0
	}
	channelConsecutiveFailureTracker.Lock()
	defer channelConsecutiveFailureTracker.Unlock()
	state := channelConsecutiveFailureTracker.items[channelConsecutiveFailureKey(channelID, model)]
	if !state.lastFailure.IsZero() && time.Since(state.lastFailure) > channelConsecutiveFailureTTL {
		return 0
	}
	return state.count
}

// ClearChannelConsecutiveFailure resets the consecutive failure counter for the
// given channel+model, typically after a successful request.
func ClearChannelConsecutiveFailure(channelID int, model string) {
	if channelID <= 0 {
		return
	}
	channelConsecutiveFailureTracker.Lock()
	defer channelConsecutiveFailureTracker.Unlock()
	delete(channelConsecutiveFailureTracker.items, channelConsecutiveFailureKey(channelID, model))
}
