package mock

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const ChannelName = "Mock"

var ModelList = []string{"mock-ok", "mock-error"}

type Adaptor struct{}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return "mock://local", nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("mock adaptor: audio requests are not supported")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	settings := info.ChannelOtherSettings
	latency := settings.MockLatencyMs
	if latency < 0 {
		latency = 0
	}
	if latency > 5000 {
		latency = 5000
	}
	if latency > 0 {
		time.Sleep(time.Duration(latency) * time.Millisecond)
	}

	statusCode := settings.MockStatusCode
	if statusCode == 0 {
		statusCode = http.StatusOK
	}
	body := mockBody(info, statusCode, settings.MockContent)
	return &http.Response{
		StatusCode: statusCode,
		Status:     strconv.Itoa(statusCode) + " " + http.StatusText(statusCode),
		Header: http.Header{
			"Content-Type": []string{"application/json"},
		},
		Body:          io.NopCloser(bytes.NewReader(body)),
		ContentLength: int64(len(body)),
		Request:       c.Request,
	}, nil
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	openaiAdaptor := &openai.Adaptor{}
	openaiAdaptor.Init(info)
	return openaiAdaptor.DoResponse(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

func mockBody(info *relaycommon.RelayInfo, statusCode int, content string) []byte {
	if statusCode < 200 || statusCode >= 300 {
		payload := map[string]any{
			"error": map[string]any{
				"message": fmt.Sprintf("mock upstream error %d", statusCode),
				"type":    "mock_error",
				"code":    statusCode,
			},
		}
		data, _ := json.Marshal(payload)
		return data
	}
	if strings.TrimSpace(content) == "" {
		content = "mock response"
	}
	model := info.UpstreamModelName
	if model == "" {
		model = info.OriginModelName
	}
	if model == "" {
		model = "mock-ok"
	}
	switch info.RelayMode {
	case relayconstant.RelayModeResponses, relayconstant.RelayModeResponsesCompact:
		return marshalMockBody(map[string]any{
			"id":      "resp_mock",
			"object":  "response",
			"created_at": time.Now().Unix(),
			"model":   model,
			"output": []map[string]any{
				{
					"type":   "message",
					"id":     "msg_mock",
					"status": "completed",
					"role":   "assistant",
					"content": []map[string]any{
						{"type": "output_text", "text": content, "annotations": []any{}},
					},
				},
			},
			"usage": map[string]any{
				"input_tokens":  0,
				"output_tokens": 0,
				"total_tokens":  0,
			},
		})
	default:
		return marshalMockBody(dto.OpenAITextResponse{
			Id:      "chatcmpl_mock",
			Object:  "chat.completion",
			Created: time.Now().Unix(),
			Model:   model,
			Choices: []dto.OpenAITextResponseChoice{
				{
					Index: 0,
					Message: dto.Message{
						Role:    "assistant",
						Content: content,
					},
					FinishReason: "stop",
				},
			},
			Usage: dto.Usage{
				PromptTokens:     0,
				CompletionTokens: 0,
				TotalTokens:      0,
			},
		})
	}
}

func marshalMockBody(value any) []byte {
	data, err := common.Marshal(value)
	if err != nil {
		return []byte(`{"error":{"message":"failed to build mock response","type":"mock_error","code":"mock_marshal_failed"}}`)
	}
	return data
}
