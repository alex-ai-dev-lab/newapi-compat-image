// Package compat provides compatibility layer for NewAPI patches.
// All compat modules register here and hook into the relay pipeline.
package compat

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// RelayHook is implemented by compat modules that hook into the relay pipeline.
// All methods must be idempotent and safe to call multiple times.
type RelayHook interface {
	Name() string

	// OnInit fires once after relayInfo is built, before channel selection.
	OnInit(c *gin.Context, info *relaycommon.RelayInfo) error

	// OnSelectRetryParam fires once before the retry loop starts.
	OnSelectRetryParam(c *gin.Context, info *relaycommon.RelayInfo, p *service.RetryParam)

	// BeforeChannelCall fires once per retry, after channel is picked but before upstream call.
	BeforeChannelCall(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, p *service.RetryParam) *types.NewAPIError

	// AfterChannelCall fires after each upstream call, before shouldRetry.
	AfterChannelCall(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, err *types.NewAPIError)

	// OnRetryDecision fires after shouldRetry() but before next iteration.
	// shouldRetryResult is the upstream shouldRetry() decision.
	// Return true to force retry, false to stop, or pass through shouldRetryResult.
	OnRetryDecision(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, err *types.NewAPIError, p *service.RetryParam, shouldRetryResult bool) bool

	// OnClientResponseError fires inside defer block before error serialization.
	OnClientResponseError(c *gin.Context, info *relaycommon.RelayInfo, err *types.NewAPIError) *types.NewAPIError
}

// NoOpRelayHook provides default no-op implementation.
type NoOpRelayHook struct{}

func (NoOpRelayHook) Name() string                                             { return "noop" }
func (NoOpRelayHook) OnInit(c *gin.Context, info *relaycommon.RelayInfo) error { return nil }
func (NoOpRelayHook) OnSelectRetryParam(c *gin.Context, info *relaycommon.RelayInfo, p *service.RetryParam) {
}
func (NoOpRelayHook) BeforeChannelCall(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, p *service.RetryParam) *types.NewAPIError {
	return nil
}
func (NoOpRelayHook) AfterChannelCall(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, err *types.NewAPIError) {
}
func (NoOpRelayHook) OnRetryDecision(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, err *types.NewAPIError, p *service.RetryParam, shouldRetryResult bool) bool {
	return shouldRetryResult
}
func (NoOpRelayHook) OnClientResponseError(c *gin.Context, info *relaycommon.RelayInfo, err *types.NewAPIError) *types.NewAPIError {
	return err
}

// HookChain orchestrates multiple RelayHooks in registration order.
type HookChain struct {
	hooks []RelayHook
	mu    sync.RWMutex
}

func NewHookChain() *HookChain {
	return &HookChain{hooks: []RelayHook{}}
}

func (hc *HookChain) Register(h RelayHook) {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	hc.hooks = append(hc.hooks, h)
	common.SysLog("compat: registered hook: " + h.Name())
}

func (hc *HookChain) OnInit(c *gin.Context, info *relaycommon.RelayInfo) error {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	for _, h := range hc.hooks {
		if err := h.OnInit(c, info); err != nil {
			return err
		}
	}
	return nil
}

func (hc *HookChain) OnSelectRetryParam(c *gin.Context, info *relaycommon.RelayInfo, p *service.RetryParam) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	for _, h := range hc.hooks {
		h.OnSelectRetryParam(c, info, p)
	}
}

func (hc *HookChain) BeforeChannelCall(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, p *service.RetryParam) *types.NewAPIError {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	for _, h := range hc.hooks {
		if err := h.BeforeChannelCall(c, info, ch, p); err != nil {
			return err
		}
	}
	return nil
}

func (hc *HookChain) AfterChannelCall(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, err *types.NewAPIError) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	for _, h := range hc.hooks {
		h.AfterChannelCall(c, info, ch, err)
	}
}

func (hc *HookChain) OnRetryDecision(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, err *types.NewAPIError, p *service.RetryParam, shouldRetryResult bool) bool {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	result := shouldRetryResult
	for _, h := range hc.hooks {
		result = h.OnRetryDecision(c, info, ch, err, p, result)
	}
	return result
}

func (hc *HookChain) OnClientResponseError(c *gin.Context, info *relaycommon.RelayInfo, err *types.NewAPIError) *types.NewAPIError {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	for _, h := range hc.hooks {
		err = h.OnClientResponseError(c, info, err)
	}
	return err
}

var globalHookChain = NewHookChain()

// Hooks returns the global hook chain.
func Hooks() *HookChain {
	return globalHookChain
}

// Register registers a hook to the global chain.
func Register(h RelayHook) {
	globalHookChain.Register(h)
}
