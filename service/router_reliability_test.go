package service

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func resetRouterCooldownTrackerForTest() {
	routerCooldownTracker.Lock()
	defer routerCooldownTracker.Unlock()
	routerCooldownTracker.items = make(map[string]RouterCooldownState)
}

func TestRouterCooldownDisabledDoesNotExclude(t *testing.T) {
	t.Setenv("ROUTER_COOLDOWN_ENABLED", "false")
	resetRouterCooldownTrackerForTest()

	info := &relaycommon.RelayInfo{OriginModelName: "gpt-test", RelayMode: 1}
	err := types.NewOpenAIError(errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)
	RecordRouterCooldownFailure(10, info, err)
	RecordRouterCooldownFailure(10, info, err)

	param := &RetryParam{ExcludedChannelIds: map[int]bool{}}
	ApplyRouterCooldownFilter(info, param)
	require.False(t, param.ExcludedChannelIds[10])
}

func TestRouterCooldownExcludesAfterThresholdAndClears(t *testing.T) {
	t.Setenv("ROUTER_COOLDOWN_ENABLED", "true")
	t.Setenv("ROUTER_COOLDOWN_THRESHOLD", "2")
	t.Setenv("ROUTER_COOLDOWN_SECONDS", "60")
	resetRouterCooldownTrackerForTest()

	info := &relaycommon.RelayInfo{OriginModelName: "gpt-test", RelayMode: 1}
	err := types.NewOpenAIError(errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)

	param := &RetryParam{ExcludedChannelIds: map[int]bool{}}
	RecordRouterCooldownFailure(10, info, err)
	ApplyRouterCooldownFilter(info, param)
	require.False(t, param.ExcludedChannelIds[10])

	RecordRouterCooldownFailure(10, info, err)
	ApplyRouterCooldownFilter(info, param)
	require.True(t, param.ExcludedChannelIds[10])

	delete(param.ExcludedChannelIds, 10)
	ClearRouterCooldown(10, info)
	ApplyRouterCooldownFilter(info, param)
	require.False(t, param.ExcludedChannelIds[10])
}

func TestRouterRetryBackoffDelayRange(t *testing.T) {
	t.Setenv("ROUTER_RETRY_BACKOFF_BASE_MS", "100")
	t.Setenv("ROUTER_RETRY_BACKOFF_MAX_MS", "1000")
	oldRelayTimeout := common.RelayTimeout
	common.RelayTimeout = 0
	defer func() {
		common.RelayTimeout = oldRelayTimeout
	}()

	for i := 0; i < 20; i++ {
		delay := RouterRetryBackoffDelay(2)
		require.GreaterOrEqual(t, delay, 100*time.Millisecond)
		require.LessOrEqual(t, delay, 300*time.Millisecond)
	}
}
