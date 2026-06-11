package antipoison

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestResponseProofEnabledDisabledForStreamRequests(t *testing.T) {
	enabled := true
	info := &relaycommon.RelayInfo{
		IsStream: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{
				AntiPoisonEnabled:              &enabled,
				AntiPoisonResponseProofEnabled: &enabled,
			},
		},
	}

	if ResponseProofEnabled(info) {
		t.Fatal("ResponseProofEnabled = true for stream request, want false")
	}
}

func TestResponseProofEnabledAllowsNonStreamChannelOverride(t *testing.T) {
	enabled := true
	info := &relaycommon.RelayInfo{
		IsStream: false,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{
				AntiPoisonEnabled:              &enabled,
				AntiPoisonResponseProofEnabled: &enabled,
			},
		},
	}

	if !ResponseProofEnabled(info) {
		t.Fatal("ResponseProofEnabled = false for non-stream channel override, want true")
	}
}
