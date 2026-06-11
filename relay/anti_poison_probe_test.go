package relay

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/antipoison"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func TestBuildAntiPoisonProbeContextMarksProbeRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("Authorization", "Bearer test")
	common.SetContextKey(ctx, constant.ContextKeyChannelId, 101)
	common.SetContextKey(ctx, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
	common.SetContextKey(ctx, constant.ContextKeyOriginalModel, "gpt-test")
	info := &relaycommon.RelayInfo{
		RequestId:       "req-1",
		OriginModelName: "gpt-test",
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RelayFormat:     types.RelayFormatOpenAI,
		IsStream:        true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:      101,
			ChannelSetting: dto.ChannelSettings{},
		},
	}

	probeReq := antipoison.BuildOpenAIProbeRequest("gpt-test")
	probeInfo, probeCtx, err := buildAntiPoisonProbeContext(ctx, info, probeReq, relayconstant.RelayModeChatCompletions, types.RelayFormatOpenAI)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := common.GetContextKeyString(ctx, constant.ContextKeyAntiPoisonProbeRequestID); got != "req-1-probe" {
		t.Fatalf("parent probe id=%q", got)
	}
	if probeInfo.RequestId != "req-1-probe" || !probeInfo.IsChannelTest || probeInfo.IsStream {
		t.Fatalf("bad probe info: id=%s test=%v stream=%v", probeInfo.RequestId, probeInfo.IsChannelTest, probeInfo.IsStream)
	}
	if probeCtx.Request.Header.Get("Authorization") != "Bearer test" {
		t.Fatalf("probe context did not copy headers")
	}
}
