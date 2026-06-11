// Package compat provides metrics for all compatibility modules.
package compat

import (
	"sync/atomic"
)

// Metrics holds all compat module counters.
type Metrics struct {
	// Error normalization
	ErrorNormalizeTotal atomic.Int64
	ErrorNormalizeHit   atomic.Int64

	// Failover
	FailoverExcludeTotal atomic.Int64
	FailoverDisableTotal atomic.Int64

	// Claude thinking
	ThinkingDetectTotal   atomic.Int64
	ThinkingSanitizeTotal atomic.Int64
	ThinkingFallbackTotal atomic.Int64

	// Encrypted reasoning
	ReasoningAffinityTotal atomic.Int64
	ReasoningScrubTotal    atomic.Int64

	// Antipoison
	AntiPoisonScanTotal atomic.Int64
	AntiPoisonHitTotal  atomic.Int64
}

var globalMetrics = &Metrics{}

// GetMetrics returns global compat metrics.
func GetMetrics() *Metrics {
	return globalMetrics
}
