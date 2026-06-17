package openai

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/antipoison"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

func TestAggregateResponsesStreamBlocksEnvelopeOutsideText(t *testing.T) {
	enabled := true
	final := `{"type":"response.completed","response":{"id":"resp-test","object":"response","created_at":1,"model":"gpt-test","output":[{"type":"message","role":"assistant","status":"completed","content":[{"type":"output_text","text":"<newapi_answer nonce=\"n1\">OK</newapi_answer>\nU2FsdGVkX1+xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}]}]}}`
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader("data: " + final + "\n\ndata: [DONE]\n\n")),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:         101,
			ChannelSetting:    dto.ChannelSettings{AntiPoisonEnabled: &enabled},
			UpstreamModelName: "gpt-test",
		},
		OriginModelName:               "gpt-test",
		AntiPoisonAnswerEnvelopeNonce: "n1",
	}
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	_, _, err := aggregateResponsesStreamToResponse(ctx, info, resp)
	if err == nil || !errors.Is(err, antipoison.ErrEnvelopeOutsideText) {
		t.Fatalf("err=%v, want envelope outside text", err)
	}
}
