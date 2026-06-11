package antipoison

import (
	"errors"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestValidateToolCallsAgainstPolicyBlocksUndeclaredTools(t *testing.T) {
	info := &relaycommon.RelayInfo{}
	err := ValidateToolCallsAgainstPolicy(info, []string{"show_ad"}, []string{`{}`})
	if !errors.Is(err, ErrToolCallNotDeclared) {
		t.Fatalf("err=%v, want undeclared tools", err)
	}
}

func TestValidateToolCallsAgainstPolicyBlocksNameMismatch(t *testing.T) {
	info := &relaycommon.RelayInfo{
		AntiPoisonToolsDeclared: true,
		AntiPoisonAllowedTools:  map[string]bool{"Read": true},
	}
	err := ValidateToolCallsAgainstPolicy(info, []string{"Write"}, []string{`{}`})
	if !errors.Is(err, ErrToolCallNameDenied) {
		t.Fatalf("err=%v, want denied tool name", err)
	}
}

func TestValidateToolCallsAgainstPolicyBlocksBadArguments(t *testing.T) {
	info := &relaycommon.RelayInfo{
		AntiPoisonToolsDeclared: true,
		AntiPoisonAllowedTools:  map[string]bool{"Read": true},
	}
	for _, args := range []string{`not-json`, `["not","object"]`} {
		err := ValidateToolCallsAgainstPolicy(info, []string{"Read"}, []string{args})
		if !errors.Is(err, ErrToolCallBadArgs) {
			t.Fatalf("args=%s err=%v, want bad args", args, err)
		}
	}
}
