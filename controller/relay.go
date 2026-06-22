package controller

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/compat"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/relay/antipoison"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func relayHandler(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	var err *types.NewAPIError
	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
		err = relay.ImageHelper(c, info)
	case relayconstant.RelayModeAudioSpeech:
		fallthrough
	case relayconstant.RelayModeAudioTranslation:
		fallthrough
	case relayconstant.RelayModeAudioTranscription:
		err = relay.AudioHelper(c, info)
	case relayconstant.RelayModeRerank:
		err = relay.RerankHelper(c, info)
	case relayconstant.RelayModeEmbeddings:
		err = relay.EmbeddingHelper(c, info)
	case relayconstant.RelayModeResponses, relayconstant.RelayModeResponsesCompact:
		err = relay.ResponsesHelper(c, info)
	default:
		err = relay.TextHelper(c, info)
	}
	return err
}

func geminiRelayHandler(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	var err *types.NewAPIError
	if strings.Contains(c.Request.URL.Path, "embed") {
		err = relay.GeminiEmbeddingHandler(c, info)
	} else {
		err = relay.GeminiHelper(c, info)
	}
	return err
}

func Relay(c *gin.Context, relayFormat types.RelayFormat) {

	requestId := c.GetString(common.RequestIdKey)
	//group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	//originalModel := common.GetContextKeyString(c, constant.ContextKeyOriginalModel)

	var (
		newAPIError *types.NewAPIError
		ws          *websocket.Conn
		relayInfo   *relaycommon.RelayInfo
	)

	if relayFormat == types.RelayFormatOpenAIRealtime {
		var err error
		ws, err = upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			helper.WssError(c, ws, types.NewError(err, types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry()).ToOpenAIError())
			return
		}
		defer ws.Close()
	}

	defer func() {
		if newAPIError != nil {
			logger.LogError(c, fmt.Sprintf("relay error: %s", common.LocalLogPreview(newAPIError.Error())))

			// Compat hook: OnClientResponseError (normalizes error for client)
			newAPIError = compat.Hooks().OnClientResponseError(c, relayInfo, newAPIError)

			newAPIError.SetMessage(common.MessageWithRequestId(newAPIError.Error(), requestId))
			switch relayFormat {
			case types.RelayFormatOpenAIRealtime:
				helper.WssError(c, ws, newAPIError.ToOpenAIError())
			case types.RelayFormatClaude:
				c.JSON(newAPIError.StatusCode, gin.H{
					"type":  "error",
					"error": newAPIError.ToClaudeError(),
				})
			default:
				c.JSON(newAPIError.StatusCode, gin.H{
					"error": newAPIError.ToOpenAIError(),
				})
			}
		}
	}()

	request, err := helper.GetAndValidateRequest(c, relayFormat)
	if err != nil {
		// Map "request body too large" to 413 so clients can handle it correctly
		if common.IsRequestBodyTooLargeError(err) || errors.Is(err, common.ErrRequestBodyTooLarge) {
			newAPIError = types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusRequestEntityTooLarge, types.ErrOptionWithSkipRetry())
		} else {
			newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest)
		}
		return
	}

	relayInfo, err = relaycommon.GenRelayInfo(c, relayFormat, request, ws)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeGenRelayInfoFailed)
		return
	}

	// Compat hook: OnInit (detects features like encrypted reasoning, claude thinking)
	if err := compat.Hooks().OnInit(c, relayInfo); err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeGenRelayInfoFailed)
		return
	}

	needSensitiveCheck := setting.ShouldCheckPromptSensitive()
	needCountToken := constant.CountToken
	// Avoid building huge CombineText (strings.Join) when token counting and sensitive check are both disabled.
	var meta *types.TokenCountMeta
	if needSensitiveCheck || needCountToken {
		meta = request.GetTokenCountMeta()
	} else {
		meta = fastTokenCountMetaForPricing(request)
	}

	if needSensitiveCheck && meta != nil {
		contains, words := service.CheckSensitiveText(meta.CombineText)
		if contains {
			logger.LogWarn(c, fmt.Sprintf("user sensitive words detected: %s", strings.Join(words, ", ")))
			newAPIError = types.NewError(err, types.ErrorCodeSensitiveWordsDetected)
			return
		}
	}

	tokens, err := service.EstimateRequestToken(c, meta, relayInfo)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeCountTokenFailed)
		return
	}
	if !checkTokenTPMLimit(c, tokens) {
		newAPIError = types.NewErrorWithStatusCode(
			fmt.Errorf("token TPM limit exceeded"),
			types.ErrorCodeRateLimitExceeded,
			http.StatusTooManyRequests,
			types.ErrOptionWithSkipRetry(),
			types.ErrOptionWithNoRecordErrorLog(),
		)
		return
	}

	relayInfo.SetEstimatePromptTokens(tokens)

	priceData, err := helper.ModelPriceHelper(c, relayInfo, tokens, meta)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithStatusCode(http.StatusBadRequest))
		return
	}

	// common.SetContextKey(c, constant.ContextKeyTokenCountMeta, meta)

	if priceData.FreeModel {
		logger.LogInfo(c, fmt.Sprintf("模型 %s 免费，跳过预扣费", relayInfo.OriginModelName))
	} else {
		newAPIError = service.PreConsumeBilling(c, priceData.QuotaToPreConsume, relayInfo)
		if newAPIError != nil {
			return
		}
	}

	defer func() {
		// Only return quota if downstream failed and quota was actually pre-consumed
		if newAPIError != nil {
			newAPIError = service.NormalizeViolationFeeError(newAPIError)
			if relayInfo.Billing != nil {
				relayInfo.Billing.Refund(c)
			}
			service.ChargeViolationFeeIfNeeded(c, relayInfo, newAPIError)
		}
	}()

	retryParam := &service.RetryParam{
		Ctx:                           c,
		TokenGroup:                    relayInfo.TokenGroup,
		ModelName:                     relayInfo.OriginModelName,
		Retry:                         common.GetPointer(0),
		ExcludedChannelIds:            make(map[int]bool),
		PreferredChannelId:            relayInfo.EncryptedReasoningAffinityChannelId,
		RequireClaudeThinkingSupport:  relayInfo.ClaudeThinkingPreferSupportedChannel,
		RequireOpenAIResponsesSupport: relayFormat == types.RelayFormatOpenAIResponses || relayFormat == types.RelayFormatOpenAIResponsesCompaction,
		ProviderRoutingPolicy:         getProviderRoutingPolicy(c),
	}
	relayInfo.RetryIndex = 0
	relayInfo.LastError = nil
	maxRetryTimes := compatRelayRetryBudget(relayInfo, relayFormat)

	// Compat hook: OnSelectRetryParam (populates ExcludedChannelIds, PreferredChannelId, etc.)
	compat.Hooks().OnSelectRetryParam(c, relayInfo, retryParam)

	fallbackModels := getFallbackModels(c, relayInfo.OriginModelName)
	for modelIndex, fallbackModel := range fallbackModels {
		if modelIndex > 0 {
			if switchErr := switchRelayFallbackModel(c, relayInfo, retryParam, fallbackModel, tokens, meta); switchErr != nil {
				newAPIError = switchErr
				break
			}
			maxRetryTimes = compatRelayRetryBudget(relayInfo, relayFormat)
			compat.Hooks().OnSelectRetryParam(c, relayInfo, retryParam)
		}
		for ; retryParam.GetRetry() <= maxRetryTimes; retryParam.IncreaseRetry() {
			relayInfo.RetryIndex = retryParam.GetRetry()
			service.SleepBeforeRouterRetry(c, relayInfo.RetryIndex)
			service.ApplyRouterCooldownFilter(relayInfo, retryParam)
			channel, channelErr := getChannel(c, relayInfo, retryParam)
			if channelErr != nil {
				if maybeFallbackClaudeThinkingToSanitized(c, relayInfo, retryParam) {
					retryParam.ResetRetryNextTry()
					continue
				}
				logger.LogError(c, channelErr.Error())
				newAPIError = channelErr
				break
			}

			addUsedChannel(c, channel.Id)

			// Compat hook: BeforeChannelCall (scrubs body for thinking/reasoning)
			if hookErr := compat.Hooks().BeforeChannelCall(c, relayInfo, channel, retryParam); hookErr != nil {
				newAPIError = hookErr
				break
			}

			// Legacy compat scrub functions (will be moved into hooks in next commits)
			if scrubErr := prepareClaudeThinkingRetryBody(c, relayInfo, retryParam, channel); scrubErr != nil {
				newAPIError = scrubErr
				break
			}
			if scrubErr := prepareEncryptedReasoningRetryBody(c, relayInfo, channel); scrubErr != nil {
				newAPIError = scrubErr
				break
			}

			bodyStorage, bodyErr := common.GetBodyStorage(c)
			if bodyErr != nil {
				if common.IsRequestBodyTooLargeError(bodyErr) || errors.Is(bodyErr, common.ErrRequestBodyTooLarge) {
					newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeReadRequestBodyFailed, http.StatusRequestEntityTooLarge, types.ErrOptionWithSkipRetry())
				} else {
					newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
				}
				break
			}
			c.Request.Body = io.NopCloser(bodyStorage)

			switch relayFormat {
			case types.RelayFormatOpenAIRealtime:
				newAPIError = relay.WssHelper(c, relayInfo)
			case types.RelayFormatClaude:
				newAPIError = relay.ClaudeHelper(c, relayInfo)
			case types.RelayFormatGemini:
				newAPIError = geminiRelayHandler(c, relayInfo)
			default:
				newAPIError = relayHandler(c, relayInfo)
			}

			if newAPIError == nil {
				newAPIError = compatStreamRetryError(relayInfo)
			}

			// Compat hook: AfterChannelCall (tracks failures)
			compat.Hooks().AfterChannelCall(c, relayInfo, channel, newAPIError)

			if newAPIError == nil {
				relayInfo.LastError = nil
				clearCompatChannelFailure(channel.Id, relayInfo)
				service.ClearRouterCooldown(channel.Id, relayInfo)
				firstByteLatency := relayInfo.FirstResponseTime.Sub(relayInfo.StartTime)
				if firstByteLatency < 0 {
					firstByteLatency = 0
				}
				service.RecordAntiPoisonSuccess(channel.Id, channel.GetSetting(), firstByteLatency, time.Since(relayInfo.StartTime))
				return
			}

			newAPIError = service.NormalizeViolationFeeError(newAPIError)
			relayInfo.LastError = newAPIError
			service.RecordRouterCooldownFailure(channel.Id, relayInfo, newAPIError)

			processChannelError(c, *types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()), newAPIError)
			if service.IsAntiPoisonValidationError(newAPIError) {
				if retryParam.ExcludedChannelIds == nil {
					retryParam.ExcludedChannelIds = make(map[int]bool)
				}
				retryParam.ExcludedChannelIds[channel.Id] = true
			}
			if isTruncationFallbackError(newAPIError) {
				service.ExcludeChannelForRetry(retryParam, channel.Id)
			}

			remainingRetries := maxRetryTimes - retryParam.GetRetry()
			shouldRetryResult := shouldRetry(c, newAPIError, remainingRetries)

			// Compat hook: OnRetryDecision (can override shouldRetry, adjust excludes/preferences)
			finalShouldRetry := compat.Hooks().OnRetryDecision(c, relayInfo, channel, newAPIError, retryParam, shouldRetryResult)

			if !finalShouldRetry {
				break
			}

			// Legacy compat retry functions (will be moved into hooks in next commits)
			disableChannelForCompatRetry(c, channel, relayInfo, newAPIError, remainingRetries)
			markChannelExcludedForCompatRetry(retryParam, channel, newAPIError)
			if relayInfo.EncryptedReasoningScrubFallback && service.ShouldFallbackEncryptedReasoningError(newAPIError) {
				logger.LogWarn(c, fmt.Sprintf(
					"encrypted reasoning fallback triggered: from_channel=%d reason=%s",
					channel.Id,
					common.LocalLogPreview(newAPIError.MaskSensitiveErrorWithStatusCode()),
				))
				retryParam.PreferredChannelId = 0
			}
		}
		if newAPIError == nil {
			break
		}
		if modelIndex < len(fallbackModels)-1 && shouldTryNextFallbackModel(c, newAPIError) {
			continue
		}
		break
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		logger.LogInfo(c, retryLogStr)
	}
	if newAPIError != nil {
		gopool.Go(func() {
			perfmetrics.RecordRelaySample(relayInfo, false, 0)
		})
	}
}

var upgrader = websocket.Upgrader{
	Subprotocols: []string{"realtime"}, // WS 握手支持的协议，如果有使用 Sec-WebSocket-Protocol，则必须在此声明对应的 Protocol TODO add other protocol
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许跨域
	},
}

func addUsedChannel(c *gin.Context, channelId int) {
	useChannel := c.GetStringSlice("use_channel")
	useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
	c.Set("use_channel", useChannel)
}

func fastTokenCountMetaForPricing(request dto.Request) *types.TokenCountMeta {
	if request == nil {
		return &types.TokenCountMeta{}
	}
	meta := &types.TokenCountMeta{
		TokenType: types.TokenTypeTokenizer,
	}
	switch r := request.(type) {
	case *dto.GeneralOpenAIRequest:
		maxCompletionTokens := lo.FromPtrOr(r.MaxCompletionTokens, uint(0))
		maxTokens := lo.FromPtrOr(r.MaxTokens, uint(0))
		if maxCompletionTokens > maxTokens {
			meta.MaxTokens = int(maxCompletionTokens)
		} else {
			meta.MaxTokens = int(maxTokens)
		}
	case *dto.OpenAIResponsesRequest:
		meta.MaxTokens = int(lo.FromPtrOr(r.MaxOutputTokens, uint(0)))
	case *dto.ClaudeRequest:
		meta.MaxTokens = int(lo.FromPtr(r.MaxTokens))
	case *dto.ImageRequest:
		// Pricing for image requests depends on ImagePriceRatio; safe to compute even when CountToken is disabled.
		return r.GetTokenCountMeta()
	default:
		// Best-effort: leave CombineText empty to avoid large allocations.
	}
	return meta
}

func initEncryptedReasoningCompat(c *gin.Context, info *relaycommon.RelayInfo) {
	if c == nil || info == nil {
		return
	}
	setting := operation_setting.GetEncryptedReasoningFallbackSetting()
	if setting == nil || (!setting.AffinityEnabled && !setting.ScrubFallbackEnabled) {
		return
	}
	if info.RelayMode != relayconstant.RelayModeResponses &&
		info.RelayMode != relayconstant.RelayModeResponsesCompact {
		return
	}
	req, ok := info.Request.(*dto.OpenAIResponsesRequest)
	if !ok {
		return
	}
	reqInfo := service.AnalyzeEncryptedReasoningRequest(req)
	if !reqInfo.HasEncryptedReasoning && !reqInfo.HasReasoningItem && !reqInfo.HasPreviousResponseID {
		return
	}
	info.EncryptedReasoningAffinityEnabled = setting.AffinityEnabled
	info.EncryptedReasoningScrubFallback = setting.ScrubFallbackEnabled
	info.EncryptedReasoningOriginalChannelId = common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	if info.EncryptedReasoningOriginalChannelId > 0 && setting.AffinityEnabled {
		info.EncryptedReasoningAffinityChannelId = info.EncryptedReasoningOriginalChannelId
		logger.LogInfo(c, fmt.Sprintf("encrypted reasoning affinity hit: channel=%d", info.EncryptedReasoningOriginalChannelId))
	}
}

func initClaudeThinkingCompat(c *gin.Context, info *relaycommon.RelayInfo) {
	if c == nil || info == nil || info.RelayFormat != types.RelayFormatClaude {
		return
	}
	req, ok := info.Request.(*dto.ClaudeRequest)
	if !ok || !service.ClaudeRequestHasThinking(req) {
		return
	}
	info.ClaudeThinkingDetected = true
	info.ClaudeThinkingPreferSupportedChannel = true
	logger.LogInfo(c, "claude thinking detected: preferring thinking-compatible channel")
}

func maybeFallbackClaudeThinkingToSanitized(c *gin.Context, info *relaycommon.RelayInfo, retryParam *service.RetryParam) bool {
	if c == nil || info == nil || retryParam == nil {
		return false
	}
	if !info.ClaudeThinkingDetected || !info.ClaudeThinkingPreferSupportedChannel || info.ClaudeThinkingSanitizedFallback {
		return false
	}
	info.ClaudeThinkingPreferSupportedChannel = false
	info.ClaudeThinkingSanitizedFallback = true
	retryParam.RequireClaudeThinkingSupport = false
	retryParam.PreferredChannelId = 0
	logger.LogWarn(c, "no claude thinking-compatible channel available; retrying with sanitized request")
	return true
}

func prepareClaudeThinkingRetryBody(c *gin.Context, info *relaycommon.RelayInfo, retryParam *service.RetryParam, channel *model.Channel) *types.NewAPIError {
	if c == nil || info == nil || channel == nil || info.RelayFormat != types.RelayFormatClaude {
		return nil
	}
	req, ok := info.Request.(*dto.ClaudeRequest)
	if !ok {
		return nil
	}
	targetSupportsThinking := service.ChannelSupportsClaudeThinking(channel)
	result := service.SanitizeClaudeThinkingRequest(req, targetSupportsThinking)
	if !result.Changed {
		return nil
	}
	if !targetSupportsThinking && retryParam != nil {
		retryParam.RequireClaudeThinkingSupport = false
		info.ClaudeThinkingPreferSupportedChannel = false
		info.ClaudeThinkingSanitizedFallback = true
	}
	body, err := common.Marshal(req)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	newStorage, err := common.CreateBodyStorage(body)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if existing, ok := c.Get(common.KeyBodyStorage); ok {
		if oldStorage, ok := existing.(common.BodyStorage); ok {
			_ = oldStorage.Close()
		}
	}
	c.Set(common.KeyBodyStorage, newStorage)
	c.Request.ContentLength = int64(len(body))
	logger.LogWarn(c, fmt.Sprintf(
		"claude thinking sanitized before upstream send: channel=%d supports_thinking=%t removed_request_thinking=%t removed_thinking_blocks=%d removed_redacted_thinking=%d removed_invalid_thinking_blocks=%d",
		channel.Id,
		targetSupportsThinking,
		result.RemovedRequestThinking,
		result.RemovedThinkingBlocks,
		result.RemovedRedactedThinking,
		result.RemovedInvalidThinkingBlock,
	))
	return nil
}

func prepareEncryptedReasoningRetryBody(c *gin.Context, info *relaycommon.RelayInfo, channel *model.Channel) *types.NewAPIError {
	if c == nil || info == nil || channel == nil || !info.EncryptedReasoningScrubFallback {
		return nil
	}
	req, ok := info.Request.(*dto.OpenAIResponsesRequest)
	if !ok {
		return nil
	}
	if !service.ShouldUseEncryptedReasoningCompat(req) {
		return nil
	}
	originalChannelID := info.EncryptedReasoningOriginalChannelId
	if originalChannelID <= 0 || channel.Id == originalChannelID {
		logger.LogInfo(c, fmt.Sprintf("encrypted reasoning affinity route preserved: channel=%d", channel.Id))
		return nil
	}
	setting := operation_setting.GetEncryptedReasoningFallbackSetting()
	if setting != nil && setting.MaxFallbackTimes >= 0 && info.EncryptedReasoningFallbackCount >= setting.MaxFallbackTimes {
		return types.NewOpenAIError(
			fmt.Errorf("encrypted reasoning fallback limit reached"),
			types.ErrorCodeGetChannelFailed,
			http.StatusBadGateway,
		)
	}

	result := service.ScrubEncryptedReasoningRequest(req)
	if !result.Changed {
		return nil
	}
	info.EncryptedReasoningFallbackCount++
	body, err := common.Marshal(req)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	newStorage, err := common.CreateBodyStorage(body)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if existing, ok := c.Get(common.KeyBodyStorage); ok {
		if oldStorage, ok := existing.(common.BodyStorage); ok {
			_ = oldStorage.Close()
		}
	}
	c.Set(common.KeyBodyStorage, newStorage)
	c.Request.ContentLength = int64(len(body))
	logger.LogWarn(c, fmt.Sprintf(
		"encrypted reasoning scrubbed before cross-channel fallback: from_channel=%d to_channel=%d removed_include=%d removed_reasoning_items=%d removed_encrypted_fields=%d removed_previous_response_id=%t",
		originalChannelID,
		channel.Id,
		result.RemovedIncludeEntries,
		result.RemovedReasoningItems,
		result.RemovedEncryptedFields,
		result.RemovedPreviousResponse,
	))
	return nil
}

func getChannel(c *gin.Context, info *relaycommon.RelayInfo, retryParam *service.RetryParam) (*model.Channel, *types.NewAPIError) {
	if info.ChannelMeta == nil {
		autoBan := c.GetBool("auto_ban")
		autoBanInt := 1
		if !autoBan {
			autoBanInt = 0
		}
		return &model.Channel{
			Id:      c.GetInt("channel_id"),
			Type:    c.GetInt("channel_type"),
			Name:    c.GetString("channel_name"),
			AutoBan: &autoBanInt,
		}, nil
	}
	channel, selectGroup, err := service.CacheGetRandomSatisfiedChannel(retryParam)

	info.PriceData.GroupRatioInfo = helper.HandleGroupRatio(c, info)

	if err != nil {
		return nil, types.NewError(fmt.Errorf("获取分组 %s 下模型 %s 的可用渠道失败（retry）: %s", selectGroup, info.OriginModelName, err.Error()), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if channel == nil {
		return nil, types.NewError(fmt.Errorf("分组 %s 下模型 %s 的可用渠道不存在（retry）", selectGroup, info.OriginModelName), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}

	newAPIError := middleware.SetupContextForSelectedChannel(c, channel, info.OriginModelName)
	if newAPIError != nil {
		return nil, newAPIError
	}
	return channel, nil
}

func shouldRetry(c *gin.Context, openaiErr *types.NewAPIError, retryTimes int) bool {
	if openaiErr == nil {
		return false
	}
	if service.ShouldSkipRetryAfterChannelAffinityFailure(c) && !service.ShouldFallbackEncryptedReasoningError(openaiErr) {
		return false
	}
	if types.IsChannelError(openaiErr) {
		return true
	}
	if types.IsSkipRetryError(openaiErr) {
		return false
	}
	if retryTimes <= 0 {
		return false
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return false
	}
	code := openaiErr.StatusCode
	if code >= 200 && code < 300 {
		return false
	}
	if code < 100 || code > 599 {
		return true
	}
	if shouldCompatRetryByError(openaiErr) {
		return true
	}
	if operation_setting.IsAlwaysSkipRetryCode(openaiErr.GetErrorCode()) {
		return false
	}
	return operation_setting.ShouldRetryByStatusCode(code)
}

func compatStreamRetryError(info *relaycommon.RelayInfo) *types.NewAPIError {
	if info == nil || !info.IsStream || info.StreamStatus == nil {
		return nil
	}
	switch info.StreamStatus.EndReason {
	case relaycommon.StreamEndReasonDone, relaycommon.StreamEndReasonEOF:
		if info.RelayFormat == types.RelayFormatClaude &&
			info.ClaudeConvertInfo != nil &&
			!info.ClaudeConvertInfo.HasOutput &&
			info.StreamStatus.HasErrors() {
			return types.NewOpenAIError(
				fmt.Errorf("empty claude assistant stream from upstream"),
				types.ErrorCodeEmptyResponse,
				http.StatusBadGateway,
			)
		}
		return nil
	case relaycommon.StreamEndReasonHandlerStop:
		if info.ReceivedResponseCount == 0 && info.StreamStatus.HasErrors() {
			return types.NewOpenAIError(
				fmt.Errorf("stream stopped before first response: %s", info.StreamStatus.Summary()),
				types.ErrorCodeBadResponseBody,
				http.StatusBadGateway,
			)
		}
		// Once visible stream data has been sent, a fully transparent channel switch
		// would corrupt the client-visible SSE sequence. At that point we only record
		// the upstream issue and let the existing stream lifecycle finish best-effort.
		return nil
	case relaycommon.StreamEndReasonFirstByteTimeout:
		return types.NewOpenAIError(
			fmt.Errorf("first byte timeout after %ds", common.RelayFirstByteTimeout),
			types.ErrorCodeChannelResponseTimeExceeded,
			http.StatusRequestTimeout,
		)
	case relaycommon.StreamEndReasonTimeout:
		if info.ReceivedResponseCount == 0 {
			return types.NewOpenAIError(
				fmt.Errorf("stream timeout before first response"),
				types.ErrorCodeChannelResponseTimeExceeded,
				http.StatusRequestTimeout,
			)
		}
	}
	return nil
}

func markChannelExcludedForCompatRetry(retryParam *service.RetryParam, channel *model.Channel, openaiErr *types.NewAPIError) {
	if retryParam == nil || channel == nil || openaiErr == nil {
		return
	}
	if !shouldCompatExcludeChannelForRetry(openaiErr) {
		return
	}
	if retryParam.ExcludedChannelIds == nil {
		retryParam.ExcludedChannelIds = make(map[int]bool)
	}
	retryParam.ExcludedChannelIds[channel.Id] = true
}

func getProviderRoutingPolicy(c *gin.Context) *service.ProviderRoutingPolicy {
	policy, ok := common.GetContextKeyType[*service.ProviderRoutingPolicy](c, constant.ContextKeyProviderRoutingPolicy)
	if !ok || policy == nil || policy.Empty() {
		return nil
	}
	return policy
}

func checkTokenTPMLimit(c *gin.Context, tokens int) bool {
	limit := common.GetContextKeyInt(c, constant.ContextKeyTokenTPMLimit)
	if limit <= 0 {
		return true
	}
	tokenID := common.GetContextKeyInt(c, constant.ContextKeyTokenId)
	return service.CheckAndRecordTokenTPM(tokenID, limit, tokens)
}

func getFallbackModels(c *gin.Context, primaryModel string) []string {
	models := common.GetContextKeyStringSlice(c, constant.ContextKeyFallbackModels)
	if len(models) == 0 {
		return []string{primaryModel}
	}
	if models[0] != primaryModel && primaryModel != "" {
		models = append([]string{primaryModel}, models...)
	}
	return dedupeRelayModels(models)
}

func dedupeRelayModels(models []string) []string {
	deduped := make([]string, 0, len(models))
	seen := make(map[string]struct{}, len(models))
	for _, modelName := range models {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" {
			continue
		}
		key := strings.ToLower(modelName)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		deduped = append(deduped, modelName)
	}
	if len(deduped) == 0 && strings.TrimSpace(models[0]) != "" {
		return []string{strings.TrimSpace(models[0])}
	}
	return deduped
}

func switchRelayFallbackModel(c *gin.Context, info *relaycommon.RelayInfo, retryParam *service.RetryParam, modelName string, promptTokens int, meta *types.TokenCountMeta) *types.NewAPIError {
	if c == nil || info == nil || retryParam == nil || modelName == "" || modelName == info.OriginModelName {
		return nil
	}
	if !tokenAllowsRelayModel(c, modelName) {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("fallback model %s is not allowed by token model limit", modelName),
			types.ErrorCodeModelNotFound,
			http.StatusForbidden,
			types.ErrOptionWithSkipRetry(),
			types.ErrOptionWithNoRecordErrorLog(),
		)
	}

	info.OriginModelName = modelName
	info.LastError = nil
	info.RetryIndex = 0
	if info.Request != nil {
		info.Request.SetModelName(modelName)
	}
	common.SetContextKey(c, constant.ContextKeyOriginalModel, modelName)
	retryParam.ModelName = modelName
	retryParam.SetRetry(0)
	retryParam.ExcludedChannelIds = make(map[int]bool)
	retryParam.PreferredChannelId = 0
	retryParam.LastSelectedChannelId = 0

	priceData, err := helper.ModelPriceHelper(c, info, promptTokens, meta)
	if err != nil {
		return types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithStatusCode(http.StatusBadRequest))
	}
	if !priceData.FreeModel && info.Billing != nil {
		if err := info.Billing.Reserve(priceData.QuotaToPreConsume); err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodePreConsumeTokenQuotaFailed, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
	}
	logger.LogInfo(c, fmt.Sprintf("models fallback switched to model %s", modelName))
	return nil
}

func tokenAllowsRelayModel(c *gin.Context, modelName string) bool {
	if !common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled) {
		return true
	}
	raw, ok := common.GetContextKey(c, constant.ContextKeyTokenModelLimit)
	if !ok {
		return false
	}
	limits, ok := raw.(map[string]bool)
	if !ok {
		return false
	}
	matchName := ratio_setting.FormatMatchingModelName(modelName)
	return limits[matchName]
}

func shouldTryNextFallbackModel(c *gin.Context, err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	return shouldRetry(c, err, 1)
}

func isTruncationFallbackError(err *types.NewAPIError) bool {
	return err != nil && err.GetErrorCode() == types.ErrorCodeTruncatedResponse
}

func compatRelayRetryBudget(info *relaycommon.RelayInfo, relayFormat types.RelayFormat) int {
	if info == nil || relayFormat == types.RelayFormatOpenAIRealtime {
		return common.RetryTimes
	}
	switch info.RelayMode {
	case relayconstant.RelayModeChatCompletions,
		relayconstant.RelayModeCompletions,
		relayconstant.RelayModeResponses,
		relayconstant.RelayModeResponsesCompact:
		return maxInt(common.RetryTimes, 10)
	}
	switch relayFormat {
	case types.RelayFormatClaude, types.RelayFormatGemini:
		return maxInt(common.RetryTimes, 10)
	default:
		return common.RetryTimes
	}
}

func shouldCompatRetryByError(openaiErr *types.NewAPIError) bool {
	if openaiErr == nil {
		return false
	}
	if service.ShouldFallbackEncryptedReasoningError(openaiErr) {
		return true
	}
	switch openaiErr.StatusCode {
	case http.StatusTooManyRequests, http.StatusPaymentRequired,
		http.StatusRequestTimeout, http.StatusInternalServerError,
		http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return true
	case http.StatusUnauthorized, http.StatusForbidden:
		return true
	default:
		if openaiErr.GetErrorCode() == types.ErrorCodeDoRequestFailed ||
			openaiErr.GetErrorCode() == types.ErrorCodeChannelResponseTimeExceeded {
			return true
		}
		return false
	}
}

func disableChannelForCompatRetry(c *gin.Context, channel *model.Channel, relayInfo *relaycommon.RelayInfo, openaiErr *types.NewAPIError, remainingRetries int) {
	if remainingRetries <= 0 || channel == nil || openaiErr == nil {
		return
	}
	if !shouldCompatRetryByError(openaiErr) {
		return
	}
	shouldDisable := shouldCompatDisableChannel(openaiErr)
	if !shouldDisable && shouldTrackCompatUpstream5xxFailure(openaiErr) {
		failures := recordCompatChannelFailure(channel.Id, relayInfo)
		shouldDisable = failures >= compatUpstream5xxFailureThreshold
	}
	if !shouldDisable {
		return
	}
	channelError := *types.NewChannelError(
		channel.Id,
		channel.Type,
		channel.Name,
		channel.ChannelInfo.IsMultiKey,
		common.GetContextKeyString(c, constant.ContextKeyChannelKey),
		channel.GetAutoBan(),
	)
	service.DisableChannel(channelError, openaiErr.ErrorWithStatusCode())
}

func shouldCompatExcludeChannelForRetry(openaiErr *types.NewAPIError) bool {
	if openaiErr == nil {
		return false
	}
	if service.ShouldFallbackEncryptedReasoningError(openaiErr) {
		return true
	}
	if shouldCompatDisableChannel(openaiErr) {
		return true
	}
	switch openaiErr.StatusCode {
	case http.StatusRequestTimeout, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return true
	case http.StatusInternalServerError:
		return openaiErr.GetErrorCode() == types.ErrorCodeDoRequestFailed
	default:
		return openaiErr.GetErrorCode() == types.ErrorCodeDoRequestFailed ||
			openaiErr.GetErrorCode() == types.ErrorCodeChannelResponseTimeExceeded
	}
}

func shouldCompatDisableChannel(openaiErr *types.NewAPIError) bool {
	if openaiErr == nil {
		return false
	}
	if service.IsInvalidEncryptedReasoningError(openaiErr) {
		return false
	}
	switch openaiErr.StatusCode {
	case http.StatusUnauthorized, http.StatusForbidden, http.StatusTooManyRequests, http.StatusPaymentRequired:
		return true
	case http.StatusRequestTimeout:
		return true
	default:
		return openaiErr.GetErrorCode() == types.ErrorCodeChannelResponseTimeExceeded ||
			isQuotaOrRateLimitError(openaiErr)
	}
}

func isQuotaOrRateLimitError(openaiErr *types.NewAPIError) bool {
	if openaiErr == nil {
		return false
	}
	msg := strings.ToLower(openaiErr.Error())
	keywords := []string{
		"quota",
		"credit",
		"balance",
		"billing",
		"insufficient",
		"rate limit",
		"rate_limit",
		"too many requests",
		"exceeded",
		"额度",
		"余额",
		"限流",
		"账单",
	}
	for _, keyword := range keywords {
		if strings.Contains(msg, keyword) {
			return true
		}
	}
	return false
}

func isTransportFailureError(openaiErr *types.NewAPIError) bool {
	if openaiErr == nil {
		return false
	}
	if openaiErr.GetErrorCode() == types.ErrorCodeDoRequestFailed {
		return true
	}
	msg := strings.ToLower(openaiErr.Error())
	keywords := []string{
		"do request failed",
		"unexpected eof",
		"connection reset",
		"handshake failure",
		"failed to verify certificate",
		"no such host",
		"proxyconnect",
		"context deadline exceeded",
	}
	for _, keyword := range keywords {
		if strings.Contains(msg, keyword) {
			return true
		}
	}
	return false
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func processChannelError(c *gin.Context, channelError types.ChannelError, err *types.NewAPIError) {
	logger.LogError(c, fmt.Sprintf("channel error (channel #%d, status code: %d): %s", channelError.ChannelId, err.StatusCode, common.LocalLogPreview(err.Error())))
	// 不要使用context获取渠道信息，异步处理时可能会出现渠道信息不一致的情况
	// do not use context to get channel info, there may be inconsistent channel info when processing asynchronously
	antiPoisonRisk := service.IsAntiPoisonValidationError(err)
	antiPoisonEvidencePath := ""
	if antiPoisonRisk {
		antiPoisonEvidencePath = persistAntiPoisonEvidence(c, channelError, err)
	}
	if antiPoisonRisk {
		channelSetting, _ := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
		riskLevel := common.GetContextKeyString(c, constant.ContextKeyAntiPoisonRiskLevel)
		if riskLevel == "" {
			riskLevel = antipoisonRiskLevelFromError(err)
			common.SetContextKey(c, constant.ContextKeyAntiPoisonRiskLevel, riskLevel)
		}
		riskSignal := common.GetContextKeyString(c, constant.ContextKeyAntiPoisonRiskSignal)
		if riskSignal == "" {
			riskSignal = "anti_poison_validation"
			common.SetContextKey(c, constant.ContextKeyAntiPoisonRiskSignal, riskSignal)
		}
		if common.GetContextKeyString(c, constant.ContextKeyAntiPoisonActionTaken) == "" {
			action := "retry"
			if riskLevel == antipoison.RiskHard {
				action = "block"
			}
			common.SetContextKey(c, constant.ContextKeyAntiPoisonActionTaken, action)
		}
		service.RecordAntiPoisonRisk(channelError.ChannelId, channelSetting, riskLevel, riskSignal)
		if service.ShouldDisableChannelForAntiPoisonRisk(channelError.ChannelId, channelSetting, riskLevel) {
			gopool.Go(func() {
				service.DisableChannelForAntiPoisonRisk(channelError, err.ErrorWithStatusCode())
			})
		}
	} else if service.ShouldDisableChannel(err) && channelError.AutoBan {
		gopool.Go(func() {
			service.DisableChannel(channelError, err.ErrorWithStatusCode())
		})
	}

	if (constant.ErrorLogEnabled || antiPoisonRisk) && types.IsRecordErrorLog(err) {
		// 保存错误日志到mysql中
		userId := c.GetInt("id")
		tokenName := c.GetString("token_name")
		modelName := c.GetString("original_model")
		tokenId := c.GetInt("token_id")
		userGroup := c.GetString("group")
		channelId := c.GetInt("channel_id")
		other := make(map[string]interface{})
		if c.Request != nil && c.Request.URL != nil {
			other["request_path"] = c.Request.URL.Path
		}
		other["error_type"] = err.GetErrorType()
		other["error_code"] = err.GetErrorCode()
		other["status_code"] = err.StatusCode
		other["channel_id"] = channelId
		other["channel_name"] = c.GetString("channel_name")
		other["channel_type"] = c.GetInt("channel_type")
		if antiPoisonRisk {
			other["anti_poison_risk"] = true
			other["admin_action"] = common.GetContextKeyString(c, constant.ContextKeyAntiPoisonActionTaken)
			other["risk_reason"] = err.MaskSensitiveErrorWithStatusCode()
			if antiPoisonEvidencePath != "" {
				other["anti_poison_evidence_path"] = antiPoisonEvidencePath
			}
		}
		adminInfo := make(map[string]interface{})
		adminInfo["use_channel"] = c.GetStringSlice("use_channel")
		if antiPoisonRisk {
			adminInfo["anti_poison_risk"] = true
			adminInfo["risk_channel"] = channelError.ChannelId
			adminInfo["risk_level"] = common.GetContextKeyString(c, constant.ContextKeyAntiPoisonRiskLevel)
			adminInfo["risk_signal"] = common.GetContextKeyString(c, constant.ContextKeyAntiPoisonRiskSignal)
			adminInfo["risk_action"] = common.GetContextKeyString(c, constant.ContextKeyAntiPoisonActionTaken)
			if antiPoisonEvidencePath != "" {
				adminInfo["anti_poison_evidence_path"] = antiPoisonEvidencePath
			}
		}
		isMultiKey := common.GetContextKeyBool(c, constant.ContextKeyChannelIsMultiKey)
		if isMultiKey {
			adminInfo["is_multi_key"] = true
			adminInfo["multi_key_index"] = common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex)
		}
		service.AppendChannelAffinityAdminInfo(c, adminInfo)
		other["admin_info"] = adminInfo
		startTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
		if startTime.IsZero() {
			startTime = time.Now()
		}
		useTimeSeconds := int(time.Since(startTime).Seconds())
		model.RecordErrorLog(c, userId, channelId, modelName, tokenName, err.MaskSensitiveErrorWithStatusCode(), tokenId, useTimeSeconds, common.GetContextKeyBool(c, constant.ContextKeyIsStream), userGroup, other)
	}

}

func antipoisonRiskLevelFromError(err *types.NewAPIError) string {
	if err == nil {
		return antipoison.RiskSuspicious
	}
	lower := strings.ToLower(err.Error())
	switch {
	case strings.Contains(lower, "nonce mismatch"),
		strings.Contains(lower, "outside text"),
		strings.Contains(lower, "malformed"),
		strings.Contains(lower, "tool"),
		strings.Contains(lower, "opaque payload"),
		strings.Contains(lower, "shape"):
		return antipoison.RiskHard
	default:
		return antipoison.RiskSuspicious
	}
}

func RelayMidjourney(c *gin.Context) {
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatMjProxy, nil, nil)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"description": fmt.Sprintf("failed to generate relay info: %s", err.Error()),
			"type":        "upstream_error",
			"code":        4,
		})
		return
	}

	var mjErr *dto.MidjourneyResponse
	switch relayInfo.RelayMode {
	case relayconstant.RelayModeMidjourneyNotify:
		mjErr = relay.RelayMidjourneyNotify(c)
	case relayconstant.RelayModeMidjourneyTaskFetch, relayconstant.RelayModeMidjourneyTaskFetchByCondition:
		mjErr = relay.RelayMidjourneyTask(c, relayInfo.RelayMode)
	case relayconstant.RelayModeMidjourneyTaskImageSeed:
		mjErr = relay.RelayMidjourneyTaskImageSeed(c)
	case relayconstant.RelayModeSwapFace:
		mjErr = relay.RelaySwapFace(c, relayInfo)
	default:
		mjErr = relay.RelayMidjourneySubmit(c, relayInfo)
	}
	//err = relayMidjourneySubmit(c, relayMode)
	log.Println(mjErr)
	if mjErr != nil {
		statusCode := http.StatusBadRequest
		if mjErr.Code == 30 {
			mjErr.Result = "当前分组负载已饱和，请稍后再试，或升级账户以提升服务质量。"
			statusCode = http.StatusTooManyRequests
		}
		c.JSON(statusCode, gin.H{
			"description": fmt.Sprintf("%s %s", mjErr.Description, mjErr.Result),
			"type":        "upstream_error",
			"code":        mjErr.Code,
		})
		channelId := c.GetInt("channel_id")
		logger.LogError(c, fmt.Sprintf("relay error (channel #%d, status code %d): %s", channelId, statusCode, fmt.Sprintf("%s %s", mjErr.Description, mjErr.Result)))
	}
}

func RelayNotImplemented(c *gin.Context) {
	err := types.OpenAIError{
		Message: "API not implemented",
		Type:    "new_api_error",
		Param:   "",
		Code:    "api_not_implemented",
	}
	c.JSON(http.StatusNotImplemented, gin.H{
		"error": err,
	})
}

func RelayNotFound(c *gin.Context) {
	err := types.OpenAIError{
		Message: fmt.Sprintf("Invalid URL (%s %s)", c.Request.Method, c.Request.URL.Path),
		Type:    "invalid_request_error",
		Param:   "",
		Code:    "",
	}
	c.JSON(http.StatusNotFound, gin.H{
		"error": err,
	})
}

func RelayTaskFetch(c *gin.Context) {
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatTask, nil, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, &dto.TaskError{
			Code:       "gen_relay_info_failed",
			Message:    err.Error(),
			StatusCode: http.StatusInternalServerError,
		})
		return
	}
	if taskErr := relay.RelayTaskFetch(c, relayInfo.RelayMode); taskErr != nil {
		respondTaskError(c, taskErr)
	}
}

func RelayTask(c *gin.Context) {
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatTask, nil, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, &dto.TaskError{
			Code:       "gen_relay_info_failed",
			Message:    err.Error(),
			StatusCode: http.StatusInternalServerError,
		})
		return
	}

	if taskErr := relay.ResolveOriginTask(c, relayInfo); taskErr != nil {
		respondTaskError(c, taskErr)
		return
	}

	var result *relay.TaskSubmitResult
	var taskErr *dto.TaskError
	defer func() {
		if taskErr != nil && relayInfo.Billing != nil {
			relayInfo.Billing.Refund(c)
		}
	}()

	retryParam := &service.RetryParam{
		Ctx:                   c,
		TokenGroup:            relayInfo.TokenGroup,
		ModelName:             relayInfo.OriginModelName,
		Retry:                 common.GetPointer(0),
		ProviderRoutingPolicy: getProviderRoutingPolicy(c),
	}

	for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
		var channel *model.Channel

		if lockedCh, ok := relayInfo.LockedChannel.(*model.Channel); ok && lockedCh != nil {
			channel = lockedCh
			if retryParam.GetRetry() > 0 {
				if setupErr := middleware.SetupContextForSelectedChannel(c, channel, relayInfo.OriginModelName); setupErr != nil {
					taskErr = service.TaskErrorWrapperLocal(setupErr.Err, "setup_locked_channel_failed", http.StatusInternalServerError)
					break
				}
			}
		} else {
			var channelErr *types.NewAPIError
			channel, channelErr = getChannel(c, relayInfo, retryParam)
			if channelErr != nil {
				logger.LogError(c, channelErr.Error())
				taskErr = service.TaskErrorWrapperLocal(channelErr.Err, "get_channel_failed", http.StatusInternalServerError)
				break
			}
		}

		addUsedChannel(c, channel.Id)
		bodyStorage, bodyErr := common.GetBodyStorage(c)
		if bodyErr != nil {
			if common.IsRequestBodyTooLargeError(bodyErr) || errors.Is(bodyErr, common.ErrRequestBodyTooLarge) {
				taskErr = service.TaskErrorWrapperLocal(bodyErr, "read_request_body_failed", http.StatusRequestEntityTooLarge)
			} else {
				taskErr = service.TaskErrorWrapperLocal(bodyErr, "read_request_body_failed", http.StatusBadRequest)
			}
			break
		}
		c.Request.Body = io.NopCloser(bodyStorage)

		result, taskErr = relay.RelayTaskSubmit(c, relayInfo)
		if taskErr == nil {
			break
		}

		if !taskErr.LocalError {
			processChannelError(c,
				*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey,
					common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()),
				types.NewOpenAIError(taskErr.Error, types.ErrorCodeBadResponseStatusCode, taskErr.StatusCode))
		}

		if !shouldRetryTaskRelay(c, channel.Id, taskErr, common.RetryTimes-retryParam.GetRetry()) {
			break
		}
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		logger.LogInfo(c, retryLogStr)
	}

	// ── 成功：结算 + 日志 + 插入任务 ──
	if taskErr == nil {
		if settleErr := service.SettleBilling(c, relayInfo, result.Quota); settleErr != nil {
			common.SysError("settle task billing error: " + settleErr.Error())
		}
		service.LogTaskConsumption(c, relayInfo)

		task := model.InitTask(result.Platform, relayInfo)
		task.PrivateData.UpstreamTaskID = result.UpstreamTaskID
		task.PrivateData.BillingSource = relayInfo.BillingSource
		task.PrivateData.SubscriptionId = relayInfo.SubscriptionId
		task.PrivateData.TokenId = relayInfo.TokenId
		task.PrivateData.BillingContext = &model.TaskBillingContext{
			ModelPrice:      relayInfo.PriceData.ModelPrice,
			GroupRatio:      relayInfo.PriceData.GroupRatioInfo.GroupRatio,
			ModelRatio:      relayInfo.PriceData.ModelRatio,
			OtherRatios:     relayInfo.PriceData.OtherRatios,
			OriginModelName: relayInfo.OriginModelName,
			PerCallBilling:  common.StringsContains(constant.TaskPricePatches, relayInfo.OriginModelName) || relayInfo.PriceData.UsePrice,
		}
		task.Quota = result.Quota
		task.Data = result.TaskData
		task.Action = relayInfo.Action
		if insertErr := task.Insert(); insertErr != nil {
			common.SysError("insert task error: " + insertErr.Error())
		}
	}

	if taskErr != nil {
		respondTaskError(c, taskErr)
	}
}

// respondTaskError 统一输出 Task 错误响应（含 429 限流提示改写）
func respondTaskError(c *gin.Context, taskErr *dto.TaskError) {
	if taskErr.StatusCode == http.StatusTooManyRequests {
		taskErr.Message = "当前分组上游负载已饱和，请稍后再试"
	}
	c.JSON(taskErr.StatusCode, taskErr)
}

func shouldRetryTaskRelay(c *gin.Context, channelId int, taskErr *dto.TaskError, retryTimes int) bool {
	if taskErr == nil {
		return false
	}
	if service.ShouldSkipRetryAfterChannelAffinityFailure(c) {
		return false
	}
	if retryTimes <= 0 {
		return false
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return false
	}
	if taskErr.StatusCode == http.StatusTooManyRequests {
		return true
	}
	if taskErr.StatusCode == 307 {
		return true
	}
	if taskErr.StatusCode/100 == 5 {
		// 超时不重试
		if operation_setting.IsAlwaysSkipRetryStatusCode(taskErr.StatusCode) {
			return false
		}
		return true
	}
	if taskErr.StatusCode == http.StatusBadRequest {
		return false
	}
	if taskErr.StatusCode == 408 {
		// azure处理超时不重试
		return false
	}
	if taskErr.LocalError {
		return false
	}
	if taskErr.StatusCode/100 == 2 {
		return false
	}
	return true
}
