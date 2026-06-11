package service

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/antipoison"
)

const (
	AntiPoisonCircuitClosed   = "closed"
	AntiPoisonCircuitOpen     = "open"
	AntiPoisonCircuitHalfOpen = "half-open"
)

type AntiPoisonHealthSnapshot struct {
	ChannelID              int       `json:"channel_id"`
	Profile                string    `json:"profile"`
	Circuit                string    `json:"circuit"`
	SuccessCount           int       `json:"success_count"`
	HardFailures           int       `json:"hard_failures"`
	SuspiciousFailures     int       `json:"suspicious_failures"`
	ConsecutiveHard        int       `json:"consecutive_hard"`
	ConsecutiveSuspicious  int       `json:"consecutive_suspicious"`
	LastRiskLevel          string    `json:"last_risk_level"`
	LastRiskSignal         string    `json:"last_risk_signal"`
	LastProbeOK            bool      `json:"last_probe_ok"`
	LastProbeAt            time.Time `json:"last_probe_at,omitempty"`
	LastFirstByteLatencyMs int64     `json:"last_first_byte_latency_ms"`
	LastTotalLatencyMs     int64     `json:"last_total_latency_ms"`
	OpenedAt               time.Time `json:"opened_at,omitempty"`
}

type antiPoisonHealthState struct {
	AntiPoisonHealthSnapshot
	halfOpenAfter time.Duration
}

var antiPoisonHealth = struct {
	sync.Mutex
	channels map[int]*antiPoisonHealthState
}{
	channels: make(map[int]*antiPoisonHealthState),
}

func RecordAntiPoisonSuccess(channelID int, setting dto.ChannelSettings, firstByteLatency, totalLatency time.Duration) {
	if channelID <= 0 {
		return
	}
	cfg := antipoison.FromChannelSettingsForChannel(channelID, setting)
	antiPoisonHealth.Lock()
	defer antiPoisonHealth.Unlock()
	st := antiPoisonStateLocked(channelID, cfg)
	st.Profile = cfg.Profile
	st.Circuit = AntiPoisonCircuitClosed
	st.SuccessCount++
	st.ConsecutiveHard = 0
	st.ConsecutiveSuspicious = 0
	st.LastRiskLevel = ""
	st.LastRiskSignal = ""
	st.LastFirstByteLatencyMs = firstByteLatency.Milliseconds()
	st.LastTotalLatencyMs = totalLatency.Milliseconds()
}

func RecordAntiPoisonProbeResult(channelID int, setting dto.ChannelSettings, ok bool) {
	if channelID <= 0 {
		return
	}
	cfg := antipoison.FromChannelSettingsForChannel(channelID, setting)
	antiPoisonHealth.Lock()
	defer antiPoisonHealth.Unlock()
	st := antiPoisonStateLocked(channelID, cfg)
	st.Profile = cfg.Profile
	st.LastProbeOK = ok
	st.LastProbeAt = time.Now()
	if ok && st.Circuit == AntiPoisonCircuitHalfOpen {
		st.Circuit = AntiPoisonCircuitClosed
		st.ConsecutiveHard = 0
		st.ConsecutiveSuspicious = 0
	}
}

func AntiPoisonProbeFresh(channelID int, setting dto.ChannelSettings) bool {
	if channelID <= 0 {
		return false
	}
	cfg := antipoison.FromChannelSettingsForChannel(channelID, setting)
	ttl := time.Duration(cfg.ProbeTTLSeconds) * time.Second
	if ttl <= 0 {
		return false
	}
	antiPoisonHealth.Lock()
	defer antiPoisonHealth.Unlock()
	st := antiPoisonStateLocked(channelID, cfg)
	return st.LastProbeOK && !st.LastProbeAt.IsZero() && time.Since(st.LastProbeAt) < ttl
}

func RecordAntiPoisonRisk(channelID int, setting dto.ChannelSettings, riskLevel, riskSignal string) AntiPoisonHealthSnapshot {
	if channelID <= 0 {
		return AntiPoisonHealthSnapshot{}
	}
	cfg := antipoison.FromChannelSettingsForChannel(channelID, setting)
	antiPoisonHealth.Lock()
	defer antiPoisonHealth.Unlock()
	st := antiPoisonStateLocked(channelID, cfg)
	st.Profile = cfg.Profile
	st.LastRiskLevel = riskLevel
	st.LastRiskSignal = riskSignal
	switch riskLevel {
	case antipoison.RiskHard:
		st.HardFailures++
		st.ConsecutiveHard++
		st.ConsecutiveSuspicious = 0
	case antipoison.RiskSuspicious:
		st.SuspiciousFailures++
		st.ConsecutiveSuspicious++
	case antipoison.RiskSoft:
		st.SuspiciousFailures++
	}
	if shouldOpenAntiPoisonCircuit(cfg, st) {
		st.Circuit = AntiPoisonCircuitOpen
		st.OpenedAt = time.Now()
	}
	return st.AntiPoisonHealthSnapshot
}

func ShouldDisableChannelForAntiPoisonRisk(channelID int, setting dto.ChannelSettings, riskLevel string) bool {
	if channelID <= 0 {
		return false
	}
	cfg := antipoison.FromChannelSettingsForChannel(channelID, setting)
	if !cfg.Enabled {
		return false
	}
	if cfg.Profile == "trusted" {
		return false
	}
	if riskLevel != antipoison.RiskHard {
		return false
	}
	if cfg.Profile == "quarantine" {
		return true
	}
	antiPoisonHealth.Lock()
	defer antiPoisonHealth.Unlock()
	st := antiPoisonStateLocked(channelID, cfg)
	threshold := cfg.HardFailuresToQuarantine
	if threshold <= 0 {
		threshold = 2
	}
	return st.ConsecutiveHard >= threshold
}

func ChannelAntiPoisonCircuitAllowsProduction(channelID int, setting dto.ChannelSettings) bool {
	if channelID <= 0 {
		return true
	}
	cfg := antipoison.FromChannelSettingsForChannel(channelID, setting)
	if !cfg.Enabled {
		return true
	}
	if !cfg.ProductionRouting || cfg.ScheduledProbeOnly {
		return false
	}
	antiPoisonHealth.Lock()
	defer antiPoisonHealth.Unlock()
	st := antiPoisonStateLocked(channelID, cfg)
	if st.Circuit == "" {
		st.Circuit = AntiPoisonCircuitClosed
	}
	if st.Circuit == AntiPoisonCircuitOpen {
		if st.OpenedAt.IsZero() || time.Since(st.OpenedAt) >= st.halfOpenAfter {
			st.Circuit = AntiPoisonCircuitHalfOpen
			return true
		}
		return false
	}
	return true
}

func GetAntiPoisonHealthSnapshot(channelID int, setting dto.ChannelSettings) AntiPoisonHealthSnapshot {
	if channelID <= 0 {
		return AntiPoisonHealthSnapshot{}
	}
	cfg := antipoison.FromChannelSettingsForChannel(channelID, setting)
	antiPoisonHealth.Lock()
	defer antiPoisonHealth.Unlock()
	st := antiPoisonStateLocked(channelID, cfg)
	return st.AntiPoisonHealthSnapshot
}

func ResetAntiPoisonHealthForTest() {
	antiPoisonHealth.Lock()
	defer antiPoisonHealth.Unlock()
	antiPoisonHealth.channels = make(map[int]*antiPoisonHealthState)
}

func antiPoisonStateLocked(channelID int, cfg antipoison.Config) *antiPoisonHealthState {
	st := antiPoisonHealth.channels[channelID]
	if st == nil {
		st = &antiPoisonHealthState{
			AntiPoisonHealthSnapshot: AntiPoisonHealthSnapshot{
				ChannelID: channelID,
				Profile:   cfg.Profile,
				Circuit:   AntiPoisonCircuitClosed,
			},
			halfOpenAfter: antiPoisonHalfOpenAfter(cfg),
		}
		antiPoisonHealth.channels[channelID] = st
	}
	if st.halfOpenAfter <= 0 {
		st.halfOpenAfter = antiPoisonHalfOpenAfter(cfg)
	}
	return st
}

func shouldOpenAntiPoisonCircuit(cfg antipoison.Config, st *antiPoisonHealthState) bool {
	if cfg.Profile == "trusted" {
		return false
	}
	if cfg.Profile == "quarantine" {
		return true
	}
	if cfg.HardFailuresToQuarantine > 0 && st.ConsecutiveHard >= cfg.HardFailuresToQuarantine {
		return true
	}
	if cfg.SoftFailuresToDegrade > 0 && st.ConsecutiveSuspicious >= cfg.SoftFailuresToDegrade {
		return true
	}
	return false
}

func antiPoisonHalfOpenAfter(cfg antipoison.Config) time.Duration {
	if cfg.ProbeTTLSeconds > 0 {
		return time.Duration(cfg.ProbeTTLSeconds) * time.Second
	}
	return 30 * time.Second
}
