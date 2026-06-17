package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/antipoison"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func TestAntiPoisonProbationDoesNotDisableOnSingleSuspicious(t *testing.T) {
	ResetAntiPoisonHealthForTest()
	enabled := true
	setting := dto.ChannelSettings{AntiPoisonEnabled: &enabled}
	snap := RecordAntiPoisonRisk(101, setting, antipoison.RiskSuspicious, "answer_envelope_missing")
	if snap.Circuit != AntiPoisonCircuitClosed {
		t.Fatalf("circuit=%s, want closed before soft threshold", snap.Circuit)
	}
	if ShouldDisableChannelForAntiPoisonRisk(101, setting, antipoison.RiskSuspicious) {
		t.Fatalf("suspicious risk must not disable channel 101")
	}
}

func TestAntiPoisonProbationDisablesAfterHardThreshold(t *testing.T) {
	ResetAntiPoisonHealthForTest()
	enabled := true
	setting := dto.ChannelSettings{AntiPoisonEnabled: &enabled}
	RecordAntiPoisonRisk(101, setting, antipoison.RiskHard, "answer_envelope_nonce_mismatch")
	if ShouldDisableChannelForAntiPoisonRisk(101, setting, antipoison.RiskHard) {
		t.Fatalf("first hard risk must not disable channel 101")
	}
	snap := RecordAntiPoisonRisk(101, setting, antipoison.RiskHard, "answer_envelope_nonce_mismatch")
	if snap.Circuit != AntiPoisonCircuitOpen {
		t.Fatalf("circuit=%s, want open", snap.Circuit)
	}
	if !ShouldDisableChannelForAntiPoisonRisk(101, setting, antipoison.RiskHard) {
		t.Fatalf("second consecutive hard risk should disable channel 101")
	}
}

func TestAntiPoisonTrustedDoesNotDisableOnHardRisk(t *testing.T) {
	ResetAntiPoisonHealthForTest()
	enabled := true
	setting := dto.ChannelSettings{
		AntiPoisonEnabled: &enabled,
		AntiPoisonProfile: operation_setting.AntiPoisonProfileTrusted,
	}
	RecordAntiPoisonRisk(77, setting, antipoison.RiskHard, "response_proof")
	if ShouldDisableChannelForAntiPoisonRisk(77, setting, antipoison.RiskHard) {
		t.Fatalf("trusted channel must not be disabled by anti-poison hard risk threshold")
	}
	channel := &model.Channel{Id: 77}
	channel.SetSetting(setting)
	if !ChannelAllowedForProduction(channel) {
		t.Fatalf("trusted channel should remain production routable")
	}
}

func TestAntiPoisonQuarantineNotProductionRoutable(t *testing.T) {
	ResetAntiPoisonHealthForTest()
	enabled := true
	channel := &model.Channel{Id: 94}
	channel.SetSetting(dto.ChannelSettings{AntiPoisonEnabled: &enabled})
	if ChannelAllowedForProduction(channel) {
		t.Fatalf("default channel 94 quarantine must not be production routable")
	}
}
