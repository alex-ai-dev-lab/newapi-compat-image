package antipoison

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// FromChannelSettings extracts the anti-poison config from channel settings.
// Channel settings override the global defaults only when explicitly set.
func FromChannelSettings(s dto.ChannelSettings) Config {
	return FromChannelSettingsForChannel(0, s)
}

func FromChannelSettingsForChannel(channelID int, s dto.ChannelSettings) Config {
	global := operation_setting.GetAntiPoisonSetting()
	profileName := strings.TrimSpace(s.AntiPoisonProfile)
	if profileName == "" && channelID > 0 && global.Channels != nil {
		if channelProfile, ok := global.Channels[strconv.Itoa(channelID)]; ok {
			profileName = strings.TrimSpace(channelProfile.Profile)
		}
	}
	if profileName == "" {
		profileName = operation_setting.AntiPoisonProfileUnknown
	}
	profile := resolveProfile(global, profileName)
	cfg := Config{
		Enabled:                      global.Enabled,
		Profile:                      profileName,
		StrictMode:                   global.ToolCallGuardStrict || profile.ToolCallGuard == operation_setting.AntiPoisonModeStrict || profile.ToolCallGuard == operation_setting.AntiPoisonModeStrictWhenTools,
		FailureMode:                  global.FailureMode,
		StripOutput:                  global.StripGuardOutput,
		MaxScanBytes:                 global.MaxGuardScanBytes,
		ResponseProof:                profile.ResponseProof == operation_setting.AntiPoisonModeRequired || profile.ResponseProof == operation_setting.AntiPoisonModeRequiredNonStream || (global.ResponseProofEnabled && profile.ResponseProof != operation_setting.AntiPoisonModeOff),
		CanaryEcho:                   global.CanaryEchoEnabled && profile.CanaryOnUserRequest,
		CanaryForProbeOnly:           profile.CanaryForProbeOnly,
		DisableOnSingleCanaryMissing: profile.DisableOnSingleCanaryMissing,
		ShapeCheck:                   profile.ShapeCheck || global.ShapeCheckEnabled,
		AnswerEnvelope:               profile.AnswerEnvelope,
		OpaqueScan:                   profile.OpaqueScan,
		ToolCallGuard:                profile.ToolCallGuard,
		ProbeTTLSeconds:              profile.ProbeTTLSeconds,
		ProbeBeforeEveryRequest:      profile.ProbeBeforeEveryRequest,
		ProductionRouting:            profile.ProductionRouting,
		ScheduledProbeOnly:           profile.ScheduledProbeOnly,
		StreamMode:                   profile.StreamMode,
		HardFailuresToQuarantine:     profile.HardFailuresToQuarantine,
		SoftFailuresToDegrade:        profile.SoftFailuresToDegrade,
	}
	if s.AntiPoisonEnabled != nil {
		cfg.Enabled = *s.AntiPoisonEnabled
	}
	if s.AntiPoisonAnswerEnvelope != "" {
		cfg.AnswerEnvelope = s.AntiPoisonAnswerEnvelope
	}
	if s.AntiPoisonResponseProof != "" {
		cfg.ResponseProof = s.AntiPoisonResponseProof == operation_setting.AntiPoisonModeRequired ||
			s.AntiPoisonResponseProof == operation_setting.AntiPoisonModeRequiredNonStream ||
			s.AntiPoisonResponseProof == operation_setting.AntiPoisonModeAuto
	}
	if s.AntiPoisonResponseProofEnabled != nil {
		cfg.ResponseProof = *s.AntiPoisonResponseProofEnabled
	}
	if s.AntiPoisonToolCallGuard != "" {
		cfg.ToolCallGuard = s.AntiPoisonToolCallGuard
		cfg.StrictMode = s.AntiPoisonToolCallGuard == operation_setting.AntiPoisonModeStrict ||
			s.AntiPoisonToolCallGuard == operation_setting.AntiPoisonModeStrictWhenTools
	}
	if s.AntiPoisonToolCallGuardStrict != nil {
		cfg.StrictMode = *s.AntiPoisonToolCallGuardStrict
	}
	if s.AntiPoisonOpaqueScan != "" {
		cfg.OpaqueScan = s.AntiPoisonOpaqueScan
	}
	if s.AntiPoisonProbeBeforeEveryRequest != nil {
		cfg.ProbeBeforeEveryRequest = *s.AntiPoisonProbeBeforeEveryRequest
	}
	if s.AntiPoisonStreamMode != "" {
		cfg.StreamMode = s.AntiPoisonStreamMode
	}
	if s.AntiPoisonHardFailuresToQuarantine > 0 {
		cfg.HardFailuresToQuarantine = s.AntiPoisonHardFailuresToQuarantine
	}
	if s.AntiPoisonSoftFailuresToDegrade > 0 {
		cfg.SoftFailuresToDegrade = s.AntiPoisonSoftFailuresToDegrade
	}
	if s.AntiPoisonFailureMode != "" {
		cfg.FailureMode = s.AntiPoisonFailureMode
	}
	if s.AntiPoisonCanaryEchoEnabled != nil {
		cfg.CanaryEcho = *s.AntiPoisonCanaryEchoEnabled && profile.CanaryOnUserRequest
	}
	if s.AntiPoisonShapeCheckEnabled != nil {
		cfg.ShapeCheck = *s.AntiPoisonShapeCheckEnabled
	}
	return cfg.Normalized()
}

func GlobalConfig() Config {
	return FromChannelSettingsForChannel(0, dto.ChannelSettings{})
}

func resolveProfile(global *operation_setting.AntiPoisonSetting, profileName string) operation_setting.AntiPoisonProfileConfig {
	if global != nil && global.Profiles != nil {
		if profile, ok := global.Profiles[profileName]; ok {
			return normalizeProfile(profileName, profile)
		}
		if profile, ok := global.Profiles[operation_setting.AntiPoisonProfileUnknown]; ok {
			return normalizeProfile(operation_setting.AntiPoisonProfileUnknown, profile)
		}
	}
	return normalizeProfile(operation_setting.AntiPoisonProfileUnknown, operation_setting.AntiPoisonProfileConfig{})
}

func normalizeProfile(profileName string, profile operation_setting.AntiPoisonProfileConfig) operation_setting.AntiPoisonProfileConfig {
	if profile.AnswerEnvelope == "" {
		if profileName == operation_setting.AntiPoisonProfileProbation || profileName == operation_setting.AntiPoisonProfileQuarantine {
			profile.AnswerEnvelope = operation_setting.AntiPoisonModeRequired
		} else {
			profile.AnswerEnvelope = operation_setting.AntiPoisonModeOff
		}
	}
	if profile.ResponseProof == "" {
		profile.ResponseProof = operation_setting.AntiPoisonModeOff
	}
	if profile.ToolCallGuard == "" {
		profile.ToolCallGuard = operation_setting.AntiPoisonModeAuto
	}
	if profile.OpaqueScan == "" {
		profile.OpaqueScan = operation_setting.AntiPoisonModeOff
	}
	if profile.StreamMode == "" {
		profile.StreamMode = operation_setting.AntiPoisonStreamDirectLightScan
	}
	if profileName != operation_setting.AntiPoisonProfileQuarantine && !profile.ScheduledProbeOnly {
		profile.ProductionRouting = true
	}
	return profile
}

func ProductionRoutingAllowed(channelID int, s dto.ChannelSettings) bool {
	cfg := FromChannelSettingsForChannel(channelID, s)
	return !cfg.Enabled || cfg.ProductionRouting
}

func EnvelopeRequired(cfg Config, stream bool) bool {
	cfg = cfg.Normalized()
	if !cfg.Enabled {
		return false
	}
	switch cfg.AnswerEnvelope {
	case operation_setting.AntiPoisonModeRequired:
		return true
	case operation_setting.AntiPoisonModeRequiredNonStream:
		return !stream
	case operation_setting.AntiPoisonModeAuto:
		return !stream && cfg.Profile != operation_setting.AntiPoisonProfileTrusted
	default:
		return false
	}
}

func OpaqueScanEnabled(cfg Config) bool {
	cfg = cfg.Normalized()
	if !cfg.Enabled {
		return false
	}
	return cfg.OpaqueScan != "" && cfg.OpaqueScan != operation_setting.AntiPoisonModeOff
}

func OpaqueScanStrict(cfg Config) bool {
	cfg = cfg.Normalized()
	return cfg.OpaqueScan == operation_setting.AntiPoisonModeScoreStrict || cfg.Profile == operation_setting.AntiPoisonProfileProbation || cfg.Profile == operation_setting.AntiPoisonProfileQuarantine
}

func StreamModeForConfig(cfg Config) string {
	return cfg.Normalized().StreamMode
}

func LegacyGlobalConfig() Config {
	global := operation_setting.GetAntiPoisonSetting()
	return Config{
		Enabled:       global.Enabled,
		StrictMode:    global.ToolCallGuardStrict,
		FailureMode:   global.FailureMode,
		StripOutput:   global.StripGuardOutput,
		MaxScanBytes:  global.MaxGuardScanBytes,
		ResponseProof: global.ResponseProofEnabled,
		CanaryEcho:    global.CanaryEchoEnabled,
		ShapeCheck:    global.ShapeCheckEnabled,
	}.Normalized()
}
