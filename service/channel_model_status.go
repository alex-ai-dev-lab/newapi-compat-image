package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

type ChannelModelFailureParams struct {
	ChannelId     int
	Group         string
	ModelName     string
	Endpoint      string
	RequestId     string
	Error         *types.NewAPIError
	AutoBan       bool
	ForceDisabled bool
}

func RecordChannelModelSuccess(channelID int, group, modelName, endpoint, requestID string) {
	modelName = strings.TrimSpace(modelName)
	if channelID <= 0 || modelName == "" {
		return
	}
	status, err := model.GetChannelModelStatus(channelID, group, modelName)
	if err != nil {
		return
	}
	status.SuccessCount++
	status.FailureCount = 0
	status.LastEndpoint = strings.TrimSpace(endpoint)
	status.LastRequestId = strings.TrimSpace(requestID)
	if status.Status == common.ChannelStatusAutoDisabled {
		status.Status = common.ChannelStatusEnabled
		status.LastError = ""
		status.LastStatusCode = 0
		status.DisabledUntil = 0
		status.LastDisabledBy = ""
	}
	_ = model.SaveChannelModelStatus(status)
}

func RecordChannelModelFailure(params ChannelModelFailureParams) {
	if params.ChannelId <= 0 || strings.TrimSpace(params.ModelName) == "" || params.Error == nil {
		return
	}
	if !IsModelScopedChannelFailureError(params.Error) {
		return
	}
	status, err := model.GetChannelModelStatus(params.ChannelId, params.Group, params.ModelName)
	if err != nil {
		status = &model.ChannelModelStatus{
			ChannelId: params.ChannelId,
			Group:     params.Group,
			ModelName: params.ModelName,
			Status:    common.ChannelStatusEnabled,
		}
	}
	status.FailureCount++
	status.LastError = params.Error.MaskSensitiveErrorWithStatusCode()
	status.LastStatusCode = params.Error.StatusCode
	status.LastRequestId = strings.TrimSpace(params.RequestId)
	status.LastEndpoint = strings.TrimSpace(params.Endpoint)
	if params.AutoBan && common.AutomaticDisableChannelEnabled {
		status.Status = common.ChannelStatusAutoDisabled
		status.LastDisabledAt = common.GetTimestamp()
		status.LastDisabledBy = "auto"
	}
	if params.ForceDisabled {
		status.Status = common.ChannelStatusAutoDisabled
		status.LastDisabledAt = common.GetTimestamp()
		status.LastDisabledBy = "auto"
	}
	_ = model.SaveChannelModelStatus(status)
}
