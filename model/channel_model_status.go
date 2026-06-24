package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

type ChannelModelStatus struct {
	ChannelId      int    `json:"channel_id" gorm:"primaryKey;autoIncrement:false;index"`
	Group          string `json:"group" gorm:"type:varchar(64);primaryKey;autoIncrement:false;default:'default'"`
	ModelName      string `json:"model_name" gorm:"type:varchar(255);primaryKey;autoIncrement:false;index"`
	Status         int    `json:"status" gorm:"default:1;index"`
	FailureCount   int    `json:"failure_count" gorm:"default:0"`
	SuccessCount   int    `json:"success_count" gorm:"default:0"`
	LastError      string `json:"last_error" gorm:"type:text"`
	LastStatusCode int    `json:"last_status_code" gorm:"default:0"`
	LastRequestId  string `json:"last_request_id" gorm:"type:varchar(128)"`
	LastEndpoint   string `json:"last_endpoint" gorm:"type:varchar(64)"`
	DisabledUntil  int64  `json:"disabled_until" gorm:"bigint;default:0"`
	LastDisabledAt int64  `json:"last_disabled_at" gorm:"bigint;default:0"`
	LastDisabledBy string `json:"last_disabled_by" gorm:"type:varchar(32)"`
	CreatedTime    int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime    int64  `json:"updated_time" gorm:"bigint;index"`
}

type ChannelModelStatusView struct {
	ChannelModelStatus
	Configured bool `json:"configured"`
}

func normalizeChannelModelStatusGroup(group string) string {
	group = strings.TrimSpace(group)
	if group == "" || strings.EqualFold(group, "auto") {
		return "default"
	}
	return group
}

func normalizeChannelModelStatusName(modelName string) string {
	return strings.TrimSpace(modelName)
}

func channelModelStatusKey(group, modelName string) string {
	return normalizeChannelModelStatusGroup(group) + "\x00" + normalizeChannelModelStatusName(modelName)
}

func IsChannelModelDisabledForGroup(channelID int, group, modelName string) bool {
	if DB == nil || channelID <= 0 {
		return false
	}
	group = normalizeChannelModelStatusGroup(group)
	modelName = normalizeChannelModelStatusName(modelName)
	if modelName == "" {
		return false
	}
	var status ChannelModelStatus
	err := DB.Where("channel_id = ? AND "+commonGroupCol+" = ? AND model_name = ?", channelID, group, modelName).First(&status).Error
	if err != nil {
		return false
	}
	return status.Status == common.ChannelStatusAutoDisabled || status.Status == common.ChannelStatusManuallyDisabled
}

func FilterChannelIDsByModelStatus(channelIDs []int, group, modelName string) []int {
	if DB == nil || len(channelIDs) == 0 {
		return channelIDs
	}
	group = normalizeChannelModelStatusGroup(group)
	modelName = normalizeChannelModelStatusName(modelName)
	if modelName == "" {
		return channelIDs
	}
	var disabledIDs []int
	err := DB.Model(&ChannelModelStatus{}).
		Where("channel_id IN ? AND "+commonGroupCol+" = ? AND model_name = ? AND status IN ?", channelIDs, group, modelName, []int{common.ChannelStatusAutoDisabled, common.ChannelStatusManuallyDisabled}).
		Pluck("channel_id", &disabledIDs).Error
	if err != nil || len(disabledIDs) == 0 {
		return channelIDs
	}
	disabled := make(map[int]struct{}, len(disabledIDs))
	for _, id := range disabledIDs {
		disabled[id] = struct{}{}
	}
	filtered := make([]int, 0, len(channelIDs))
	for _, id := range channelIDs {
		if _, ok := disabled[id]; ok {
			continue
		}
		filtered = append(filtered, id)
	}
	return filtered
}

func ListChannelModelStatuses(channel *Channel) ([]ChannelModelStatusView, error) {
	if channel == nil {
		return nil, gorm.ErrRecordNotFound
	}
	var records []ChannelModelStatus
	if err := DB.Where("channel_id = ?", channel.Id).Find(&records).Error; err != nil {
		return nil, err
	}
	byKey := make(map[string]ChannelModelStatus, len(records))
	for _, record := range records {
		record.Group = normalizeChannelModelStatusGroup(record.Group)
		record.ModelName = normalizeChannelModelStatusName(record.ModelName)
		byKey[channelModelStatusKey(record.Group, record.ModelName)] = record
	}

	now := common.GetTimestamp()
	views := make([]ChannelModelStatusView, 0, len(records)+len(channel.GetGroups())*len(channel.GetModels()))
	seen := make(map[string]struct{}, len(records))
	for _, group := range channel.GetGroups() {
		group = normalizeChannelModelStatusGroup(group)
		for _, modelName := range channel.GetModels() {
			modelName = normalizeChannelModelStatusName(modelName)
			if modelName == "" {
				continue
			}
			key := channelModelStatusKey(group, modelName)
			seen[key] = struct{}{}
			record, ok := byKey[key]
			if !ok {
				record = ChannelModelStatus{
					ChannelId:   channel.Id,
					Group:       group,
					ModelName:   modelName,
					Status:      common.ChannelStatusEnabled,
					CreatedTime: now,
					UpdatedTime: now,
				}
			}
			views = append(views, ChannelModelStatusView{
				ChannelModelStatus: record,
				Configured:         true,
			})
		}
	}
	for _, record := range records {
		key := channelModelStatusKey(record.Group, record.ModelName)
		if _, ok := seen[key]; ok {
			continue
		}
		views = append(views, ChannelModelStatusView{
			ChannelModelStatus: record,
			Configured:         false,
		})
	}
	return views, nil
}

func SaveChannelModelStatus(status *ChannelModelStatus) error {
	if status == nil {
		return nil
	}
	now := common.GetTimestamp()
	status.Group = normalizeChannelModelStatusGroup(status.Group)
	status.ModelName = normalizeChannelModelStatusName(status.ModelName)
	if status.ModelName == "" || status.ChannelId <= 0 {
		return nil
	}
	existing := ChannelModelStatus{}
	err := DB.Where("channel_id = ? AND "+commonGroupCol+" = ? AND model_name = ?", status.ChannelId, status.Group, status.ModelName).First(&existing).Error
	if err != nil {
		if err != gorm.ErrRecordNotFound {
			return err
		}
		if status.CreatedTime == 0 {
			status.CreatedTime = now
		}
		status.UpdatedTime = now
		return DB.Create(status).Error
	}
	status.CreatedTime = existing.CreatedTime
	status.UpdatedTime = now
	return DB.Save(status).Error
}

func GetChannelModelStatus(channelID int, group, modelName string) (*ChannelModelStatus, error) {
	status := &ChannelModelStatus{}
	err := DB.Where("channel_id = ? AND "+commonGroupCol+" = ? AND model_name = ?", channelID, normalizeChannelModelStatusGroup(group), normalizeChannelModelStatusName(modelName)).First(status).Error
	if err != nil {
		return nil, err
	}
	return status, nil
}

func UpdateChannelModelStatus(channelID int, group, modelName string, status int, reason string, disabledBy string) error {
	group = normalizeChannelModelStatusGroup(group)
	modelName = normalizeChannelModelStatusName(modelName)
	if channelID <= 0 || modelName == "" {
		return nil
	}
	record, err := GetChannelModelStatus(channelID, group, modelName)
	if err != nil {
		if err != gorm.ErrRecordNotFound {
			return err
		}
		now := common.GetTimestamp()
		record = &ChannelModelStatus{
			ChannelId:   channelID,
			Group:       group,
			ModelName:   modelName,
			Status:      common.ChannelStatusEnabled,
			CreatedTime: now,
			UpdatedTime: now,
		}
	}
	now := common.GetTimestamp()
	record.Status = status
	record.LastError = strings.TrimSpace(reason)
	record.UpdatedTime = now
	if status == common.ChannelStatusAutoDisabled || status == common.ChannelStatusManuallyDisabled {
		record.LastDisabledAt = now
		record.LastDisabledBy = strings.TrimSpace(disabledBy)
	} else {
		record.DisabledUntil = 0
		record.LastDisabledBy = ""
	}
	return SaveChannelModelStatus(record)
}

func ClearChannelModelStatus(channelID int, group, modelName string) error {
	return DB.Where("channel_id = ? AND "+commonGroupCol+" = ? AND model_name = ?", channelID, normalizeChannelModelStatusGroup(group), normalizeChannelModelStatusName(modelName)).Delete(&ChannelModelStatus{}).Error
}
