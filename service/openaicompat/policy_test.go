package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestShouldChatCompletionsUseResponsesForChannel_CodexBaseURL(t *testing.T) {
	if !ShouldChatCompletionsUseResponsesForChannel(77, constant.ChannelTypeOpenAI, "https://new.sharedchat.cc/codex", "gpt-5.5") {
		t.Fatal("expected /codex OpenAI-compatible upstream to use Responses mode")
	}
}

func TestShouldChatCompletionsUseResponsesForChannel_NormalOpenAIChat(t *testing.T) {
	if ShouldChatCompletionsUseResponsesForChannel(1, constant.ChannelTypeOpenAI, "https://api.openai.com", "gpt-4o-mini") {
		t.Fatal("regular OpenAI chat channel should not be forced into Responses mode")
	}
}
