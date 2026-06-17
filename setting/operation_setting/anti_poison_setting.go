package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

const (
	AntiPoisonProfileTrusted    = "trusted"
	AntiPoisonProfileUnknown    = "unknown"
	AntiPoisonProfileProbation  = "probation"
	AntiPoisonProfileQuarantine = "quarantine"

	AntiPoisonStreamDirectLightScan     = "direct_stream_light_scan"
	AntiPoisonStreamPreflightFirstBytes = "preflight_probe_first_bytes_buffer"
	AntiPoisonStreamAggregateThenReplay = "aggregate_then_replay"
	AntiPoisonStreamDisabled            = "disabled"
	AntiPoisonModeOff                   = "off"
	AntiPoisonModeWarn                  = "warn"
	AntiPoisonModeAuto                  = "auto"
	AntiPoisonModeRequired              = "required"
	AntiPoisonModeRequiredNonStream     = "required_non_stream"
	AntiPoisonModeScore                 = "score"
	AntiPoisonModeScoreStrict           = "score_strict"
	AntiPoisonModeStrict                = "strict"
	AntiPoisonModeStrictWhenTools       = "strict_when_tools"
)

type AntiPoisonProfileConfig struct {
	CanaryOnUserRequest          bool   `json:"canary_on_user_request"`
	CanaryForProbeOnly           bool   `json:"canary_for_probe_only"`
	DisableOnSingleCanaryMissing bool   `json:"disable_on_single_canary_missing"`
	AnswerEnvelope               string `json:"answer_envelope"`
	ResponseProof                string `json:"response_proof"`
	ShapeCheck                   bool   `json:"shape_check"`
	ToolCallGuard                string `json:"tool_call_guard"`
	OpaqueScan                   string `json:"opaque_scan"`
	ProbeTTLSeconds              int    `json:"probe_ttl_seconds"`
	ProbeBeforeEveryRequest      bool   `json:"probe_before_every_request"`
	QuarantineOnSingleFailure    bool   `json:"quarantine_on_single_failure"`
	QuarantineOnHardFailure      bool   `json:"quarantine_on_hard_failure"`
	ProductionRouting            bool   `json:"production_routing"`
	ScheduledProbeOnly           bool   `json:"scheduled_probe_only"`
	StreamMode                   string `json:"stream_mode"`
	HardFailuresToQuarantine     int    `json:"hard_failures_to_quarantine"`
	SoftFailuresToDegrade        int    `json:"soft_failures_to_degrade"`
}

type AntiPoisonChannelProfile struct {
	Profile string `json:"profile"`
}

type AntiPoisonSetting struct {
	Enabled                  bool   `json:"enabled"`
	ChannelTestNonceEnabled  bool   `json:"channel_test_nonce_enabled"`
	ResponseProofEnabled     bool   `json:"response_proof_enabled"`
	ToolCallGuardEnabled     bool   `json:"tool_call_guard_enabled"`
	ToolCallGuardStrict      bool   `json:"tool_call_guard_strict"`
	FailureMode              string `json:"failure_mode"`
	StripGuardOutput         bool   `json:"strip_guard_output"`
	SignedHeaderAuditEnabled bool   `json:"signed_header_audit_enabled"`
	SignedHeaderAuditSecret  string `json:"signed_header_audit_secret"`
	MaxGuardScanBytes        int    `json:"max_guard_scan_bytes"`
	DownstreamProofHeader    bool   `json:"downstream_proof_header"`
	// Canary echo: inject an invisible nonce into the last user message and
	// require the model to echo it at the end of its reply. Defaults to on.
	CanaryEchoEnabled bool `json:"canary_echo_enabled"`
	// Shape check: validate response id/model/object/finish_reason fingerprint
	// against the protocol's known shape. Defaults to on.
	ShapeCheckEnabled bool `json:"shape_check_enabled"`

	Profiles map[string]AntiPoisonProfileConfig  `json:"profiles"`
	Channels map[string]AntiPoisonChannelProfile `json:"channels"`
}

var antiPoisonSetting = AntiPoisonSetting{
	Enabled:                  false,
	ChannelTestNonceEnabled:  true,
	ResponseProofEnabled:     false,
	ToolCallGuardEnabled:     true,
	ToolCallGuardStrict:      true,
	FailureMode:              "warn",
	StripGuardOutput:         true,
	MaxGuardScanBytes:        65536,
	DownstreamProofHeader:    false,
	SignedHeaderAuditEnabled: false,
	CanaryEchoEnabled:        false,
	ShapeCheckEnabled:        true,
	Profiles: map[string]AntiPoisonProfileConfig{
		AntiPoisonProfileTrusted: {
			CanaryOnUserRequest:          false,
			CanaryForProbeOnly:           true,
			DisableOnSingleCanaryMissing: false,
			AnswerEnvelope:               AntiPoisonModeOff,
			ResponseProof:                AntiPoisonModeWarn,
			ShapeCheck:                   true,
			ToolCallGuard:                AntiPoisonModeAuto,
			OpaqueScan:                   AntiPoisonModeWarn,
			ProductionRouting:            true,
			StreamMode:                   AntiPoisonStreamDirectLightScan,
		},
		AntiPoisonProfileUnknown: {
			CanaryOnUserRequest:          false,
			CanaryForProbeOnly:           true,
			DisableOnSingleCanaryMissing: false,
			AnswerEnvelope:               AntiPoisonModeAuto,
			ResponseProof:                AntiPoisonModeAuto,
			ShapeCheck:                   true,
			ToolCallGuard:                AntiPoisonModeStrictWhenTools,
			OpaqueScan:                   AntiPoisonModeScore,
			ProbeTTLSeconds:              60,
			QuarantineOnHardFailure:      true,
			ProductionRouting:            true,
			StreamMode:                   AntiPoisonStreamPreflightFirstBytes,
		},
		AntiPoisonProfileProbation: {
			CanaryOnUserRequest:          false,
			CanaryForProbeOnly:           true,
			DisableOnSingleCanaryMissing: false,
			AnswerEnvelope:               AntiPoisonModeRequired,
			ResponseProof:                AntiPoisonModeRequiredNonStream,
			ShapeCheck:                   true,
			ToolCallGuard:                AntiPoisonModeStrict,
			OpaqueScan:                   AntiPoisonModeScoreStrict,
			ProbeBeforeEveryRequest:      true,
			QuarantineOnHardFailure:      true,
			ProductionRouting:            true,
			StreamMode:                   AntiPoisonStreamAggregateThenReplay,
			HardFailuresToQuarantine:     2,
			SoftFailuresToDegrade:        3,
		},
		AntiPoisonProfileQuarantine: {
			CanaryOnUserRequest:          false,
			CanaryForProbeOnly:           true,
			DisableOnSingleCanaryMissing: false,
			AnswerEnvelope:               AntiPoisonModeRequired,
			ResponseProof:                AntiPoisonModeRequiredNonStream,
			ShapeCheck:                   true,
			ToolCallGuard:                AntiPoisonModeStrict,
			OpaqueScan:                   AntiPoisonModeScoreStrict,
			ProductionRouting:            false,
			ScheduledProbeOnly:           true,
			StreamMode:                   AntiPoisonStreamDisabled,
		},
	},
	Channels: map[string]AntiPoisonChannelProfile{
		"77":  {Profile: AntiPoisonProfileTrusted},
		"101": {Profile: AntiPoisonProfileProbation},
		"94":  {Profile: AntiPoisonProfileQuarantine},
	},
}

func init() {
	config.GlobalConfig.Register("anti_poison_setting", &antiPoisonSetting)
}

func GetAntiPoisonSetting() *AntiPoisonSetting {
	return &antiPoisonSetting
}
