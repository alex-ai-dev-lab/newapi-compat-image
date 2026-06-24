package controller

import (
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
)

// channelTestTracker tracks per-channel test state for the independent-schedule
// test loop introduced by the per-channel auto-test feature.
type channelTestTracker struct {
	mu sync.Mutex
	// channelLastTest stores the last time each channel was tested.
	channelLastTest map[int]time.Time
	// channelFailCount stores consecutive failures per channel (key: channelId).
	channelFailCount map[int]int
}

var testTracking = &channelTestTracker{
	channelLastTest:  make(map[int]time.Time),
	channelFailCount: make(map[int]int),
}

func (t *channelTestTracker) recordTest(channelID int) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.channelLastTest[channelID] = time.Now()
}

func (t *channelTestTracker) recordSuccess(channelID int) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.channelFailCount[channelID] = 0
}

func (t *channelTestTracker) recordFailure(channelID int) int {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.channelFailCount[channelID]++
	return t.channelFailCount[channelID]
}

// lastTestSince returns how long ago the channel was last tested; if never, a
// very large duration is returned so the first test always runs.
func (t *channelTestTracker) lastTestSince(channelID int) time.Duration {
	t.mu.Lock()
	defer t.mu.Unlock()
	last, ok := t.channelLastTest[channelID]
	if !ok {
		return 365 * 24 * time.Hour
	}
	return time.Since(last)
}

func (t *channelTestTracker) failCount(channelID int) int {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.channelFailCount[channelID]
}

// GetChannelTestConfig resolves the effective test config for a channel.
// Channel-level settings override global defaults.
func getEffectiveTestConfig(channel *model.Channel) (interval time.Duration, retryCount int, retryThreshold int, timeWindowStart string, timeWindowEnd string, timezone string) {
	// Global defaults
	interval = time.Duration(math.Round(operation_setting.GetMonitorSetting().AutoTestChannelMinutes)) * time.Minute
	retryCount = 2
	retryThreshold = 2
	timeWindowStart = "08:00"
	timeWindowEnd = "18:00"
	timezone = "Asia/Taipei"

	// Channel overrides
	cs := channel.GetSetting()
	if cs.AutoTestInterval > 0 {
		interval = time.Duration(cs.AutoTestInterval) * time.Minute
	}
	if cs.AutoTestRetryCount > 0 {
		retryCount = cs.AutoTestRetryCount
	}
	if cs.AutoTestRetryThreshold > 0 {
		retryThreshold = cs.AutoTestRetryThreshold
	}
	if cs.AutoTestTimeWindowStart != "" {
		timeWindowStart = cs.AutoTestTimeWindowStart
	}
	if cs.AutoTestTimeWindowEnd != "" {
		timeWindowEnd = cs.AutoTestTimeWindowEnd
	}
	if cs.AutoTestTimezone != "" {
		timezone = cs.AutoTestTimezone
	}
	return
}

// isInTestWindow checks whether the current time falls within the channel's
// configured test window. An empty window means always allowed.
func isInTestWindow(timeWindowStart, timeWindowEnd string) bool {
	return isInTestWindowWithTimezone(timeWindowStart, timeWindowEnd, "")
}

func isInTestWindowWithTimezone(timeWindowStart, timeWindowEnd, timezone string) bool {
	if timeWindowStart == "" || timeWindowEnd == "" {
		return true
	}
	now := time.Now()
	if timezone != "" {
		if loc, err := time.LoadLocation(timezone); err == nil {
			now = now.In(loc)
		} else {
			common.SysLog("auto-test: invalid timezone " + timezone)
		}
	}
	nowTime := fmt.Sprintf("%02d:%02d", now.Hour(), now.Minute())
	return isClockInTestWindow(nowTime, timeWindowStart, timeWindowEnd)
}

func isClockInTestWindow(nowTime, timeWindowStart, timeWindowEnd string) bool {
	if timeWindowStart <= timeWindowEnd {
		return nowTime >= timeWindowStart && nowTime <= timeWindowEnd
	}
	// Window spans midnight, e.g. 22:00-06:00
	return nowTime >= timeWindowStart || nowTime <= timeWindowEnd
}

func testSingleChannelWithRetries(channel *model.Channel, testUserID int, retryCount int, retryThreshold int) {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("recovered panic testing channel %d: %v", channel.Id, r))
		}
	}()
	if retryCount < 1 {
		retryCount = 1
	}
	if retryThreshold < 1 {
		retryThreshold = 1
	}
	isChannelEnabled := channel.Status == common.ChannelStatusEnabled

	// One test cycle: retry up to retryCount times to confirm a failure before
	// counting this cycle as failed. A single success at any attempt counts the
	// whole cycle as a success.
	var lastResult testResult
	var lastElapsed int64
	var succeeded bool
	for attempt := 0; attempt < retryCount; attempt++ {
		tStart := time.Now()
		lastResult = testChannel(channel, testUserID, "", "", shouldUseStreamForAutomaticChannelTest(channel))
		elapsed := time.Since(tStart).Milliseconds()
		lastElapsed = elapsed

		if lastResult.newAPIError == nil {
			succeeded = true
			service.RecordChannelModelSuccess(channel.Id,
				common.GetContextKeyString(lastResult.context, constant.ContextKeyUsingGroup),
				common.GetContextKeyString(lastResult.context, constant.ContextKeyOriginalModel),
				"",
				common.GetContextKeyString(lastResult.context, common.RequestIdKey))
			channel.UpdateResponseTime(elapsed)
			break
		}
		service.RecordChannelModelFailure(service.ChannelModelFailureParams{
			ChannelId: channel.Id,
			Group:     common.GetContextKeyString(lastResult.context, constant.ContextKeyUsingGroup),
			ModelName: common.GetContextKeyString(lastResult.context, constant.ContextKeyOriginalModel),
			RequestId: common.GetContextKeyString(lastResult.context, common.RequestIdKey),
			Error:     lastResult.newAPIError,
			AutoBan:   channel.GetAutoBan(),
		})
		// Only meaningful disable-worthy errors justify another retry attempt.
		if attempt < retryCount-1 {
			time.Sleep(500 * time.Millisecond)
		}
	}

	if succeeded {
		// Reset consecutive failure counter; re-enable if previously auto-disabled.
		testTracking.recordSuccess(channel.Id)
		if !isChannelEnabled && service.ShouldEnableChannel(nil, channel.Status) {
			service.EnableChannel(channel.Id,
				common.GetContextKeyString(lastResult.context, constant.ContextKeyChannelKey),
				channel.Name)
		}
		return
	}

	// Failed cycles still count as a completed test. Persisting test_time makes
	// the channel test UI reflect that the scheduler actually ran.
	channel.UpdateResponseTime(lastElapsed)

	// Cycle failed. Decide whether to disable based on consecutive-failure threshold.
	if isChannelEnabled && (service.IsAntiPoisonValidationError(lastResult.newAPIError) || service.ShouldDisableChannel(lastResult.newAPIError)) {
		failures := testTracking.recordFailure(channel.Id)
		logger.LogInfo(nil, fmt.Sprintf("channel %d (%s) auto-test failed (%d/%d consecutive)",
			channel.Id, channel.Name, failures, retryThreshold))
		antiPoisonRisk := service.IsAntiPoisonValidationError(lastResult.newAPIError)
		if antiPoisonRisk || (failures >= retryThreshold && channel.GetAutoBan()) {
			processChannelError(lastResult.context,
				*types.NewChannelError(channel.Id, channel.Type, channel.Name,
					channel.ChannelInfo.IsMultiKey,
					common.GetContextKeyString(lastResult.context, constant.ContextKeyChannelKey),
					channel.GetAutoBan()),
				lastResult.newAPIError)
			// Reset counter after disabling so re-enable logic starts fresh.
			testTracking.recordSuccess(channel.Id)
		}
	}
}

// runIndependentChannelTest is called by the global auto-test loop. It tests
// channels that are due according to their individual schedules.
func runIndependentChannelTest() {
	if !operation_setting.GetMonitorSetting().AutoTestChannelEnabled {
		return
	}

	testUserID, err := resolveChannelTestUserID(nil)
	if err != nil {
		common.SysLog("auto-test: failed to resolve test user: " + err.Error())
		return
	}

	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		common.SysLog("auto-test: failed to get channels: " + err.Error())
		return
	}

	for _, channel := range channels {
		// Skip channels that are disabled (not auto-disabled)
		if channel.Status != common.ChannelStatusEnabled &&
			channel.Status != common.ChannelStatusAutoDisabled {
			continue
		}

		// Respect the "allow auto test & recover" flag
		if !channel.AllowAutoTestAndRecover() {
			continue
		}

		// Check per-channel schedule
		interval, retryCount, retryThreshold, twStart, twEnd, timezone := getEffectiveTestConfig(channel)
		since := testTracking.lastTestSince(channel.Id)
		if since < interval {
			continue // Not due yet
		}

		// Check time window
		if !isInTestWindowWithTimezone(twStart, twEnd, timezone) {
			continue
		}

		// Test this channel
		testTracking.recordTest(channel.Id)
		go testSingleChannelWithRetries(channel, testUserID, retryCount, retryThreshold)

		// Stagger tests to avoid thundering herd
		time.Sleep(100 * time.Millisecond)
	}
}

// AutomaticallyTestChannelsWithIndependentSchedule replaces the original
// AutomaticallyTestChannels with per-channel scheduling support.
func startIndependentAutoTest() {
	if !common.IsMasterNode {
		return
	}

	// Scan frequency: every 30 seconds, check if any channels are due
	scanInterval := 30 * time.Second

	go func() {
		for {
			if !operation_setting.GetMonitorSetting().AutoTestChannelEnabled {
				time.Sleep(1 * time.Minute)
				continue
			}
			for {
				runIndependentChannelTest()
				time.Sleep(scanInterval)
				if !operation_setting.GetMonitorSetting().AutoTestChannelEnabled {
					break
				}
			}
		}
	}()
}
