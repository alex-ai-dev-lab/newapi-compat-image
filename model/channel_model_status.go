package model

import (
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	Probing    bool `json:"probing"`
}

type ChannelModelFailureUpdate struct {
	ChannelId           int
	Group               string
	ModelName           string
	LastError           string
	LastStatusCode      int
	LastRequestId       string
	LastEndpoint        string
	AutoDisableEligible bool
	ForceDisabled       bool
	FailureThreshold    int
	CooldownSeconds     int64
}

type ChannelModelSuccessUpdate struct {
	ChannelId     int
	Group         string
	ModelName     string
	LastRequestId string
	LastEndpoint  string
}

var channelModelStatusCache atomic.Pointer[sync.Map]

func channelModelStatusCacheMap() *sync.Map {
	if cache := channelModelStatusCache.Load(); cache != nil {
		return cache
	}
	fresh := &sync.Map{}
	if channelModelStatusCache.CompareAndSwap(nil, fresh) {
		return fresh
	}
	return channelModelStatusCache.Load()
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

func channelModelStatusCacheKey(channelID int, group, modelName string) string {
	return strconv.Itoa(channelID) + "\x00" + channelModelStatusKey(group, modelName)
}

func normalizeChannelModelStatusRecord(record ChannelModelStatus) ChannelModelStatus {
	record.Group = normalizeChannelModelStatusGroup(record.Group)
	record.ModelName = normalizeChannelModelStatusName(record.ModelName)
	if record.Status == common.ChannelStatusUnknown {
		record.Status = common.ChannelStatusEnabled
	}
	return record
}

func cacheStoreChannelModelStatus(record ChannelModelStatus) {
	record = normalizeChannelModelStatusRecord(record)
	if record.ChannelId <= 0 || record.ModelName == "" {
		return
	}
	channelModelStatusCacheMap().Store(channelModelStatusCacheKey(record.ChannelId, record.Group, record.ModelName), record)
}

func cacheDeleteChannelModelStatus(channelID int, group, modelName string) {
	channelModelStatusCacheMap().Delete(channelModelStatusCacheKey(channelID, group, modelName))
}

func ReloadChannelModelStatusCache() {
	var records []ChannelModelStatus
	if DB != nil {
		_ = DB.Find(&records).Error
	}
	next := &sync.Map{}
	for _, record := range records {
		record = normalizeChannelModelStatusRecord(record)
		if record.ChannelId <= 0 || record.ModelName == "" {
			continue
		}
		next.Store(channelModelStatusCacheKey(record.ChannelId, record.Group, record.ModelName), record)
	}
	channelModelStatusCache.Store(next)
}

func HasChannelModelStatusCached(channelID int, group, modelName string) bool {
	if !common.MemoryCacheEnabled {
		return false
	}
	_, ok := channelModelStatusCacheMap().Load(channelModelStatusCacheKey(channelID, group, modelName))
	return ok
}

func isChannelModelStatusDisabled(record ChannelModelStatus, now int64) bool {
	switch record.Status {
	case common.ChannelStatusManuallyDisabled:
		return true
	case common.ChannelStatusAutoDisabled:
		return record.DisabledUntil <= 0 || now < record.DisabledUntil
	default:
		return false
	}
}

func IsChannelModelDisabledForGroup(channelID int, group, modelName string) bool {
	if channelID <= 0 {
		return false
	}
	group = normalizeChannelModelStatusGroup(group)
	modelName = normalizeChannelModelStatusName(modelName)
	if modelName == "" {
		return false
	}
	now := common.GetTimestamp()
	if common.MemoryCacheEnabled {
		value, ok := channelModelStatusCacheMap().Load(channelModelStatusCacheKey(channelID, group, modelName))
		if !ok {
			return false
		}
		record, ok := value.(ChannelModelStatus)
		return ok && isChannelModelStatusDisabled(record, now)
	}
	if DB == nil {
		return false
	}
	var status ChannelModelStatus
	err := DB.Where("channel_id = ? AND "+commonGroupCol+" = ? AND model_name = ?", channelID, group, modelName).First(&status).Error
	if err != nil {
		return false
	}
	return isChannelModelStatusDisabled(status, now)
}

func FilterChannelIDsByModelStatus(channelIDs []int, group, modelName string) []int {
	if len(channelIDs) == 0 {
		return channelIDs
	}
	group = normalizeChannelModelStatusGroup(group)
	modelName = normalizeChannelModelStatusName(modelName)
	if modelName == "" {
		return channelIDs
	}
	now := common.GetTimestamp()
	disabled := make(map[int]struct{})
	if common.MemoryCacheEnabled {
		for _, channelID := range channelIDs {
			value, ok := channelModelStatusCacheMap().Load(channelModelStatusCacheKey(channelID, group, modelName))
			if !ok {
				continue
			}
			record, ok := value.(ChannelModelStatus)
			if ok && isChannelModelStatusDisabled(record, now) {
				disabled[channelID] = struct{}{}
			}
		}
	} else if DB != nil {
		var records []ChannelModelStatus
		err := DB.Where("channel_id IN ? AND "+commonGroupCol+" = ? AND model_name = ? AND status IN ?", channelIDs, group, modelName, []int{common.ChannelStatusAutoDisabled, common.ChannelStatusManuallyDisabled}).Find(&records).Error
		if err != nil {
			return channelIDs
		}
		for _, record := range records {
			if isChannelModelStatusDisabled(record, now) {
				disabled[record.ChannelId] = struct{}{}
			}
		}
	}
	if len(disabled) == 0 {
		return channelIDs
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
		record = normalizeChannelModelStatusRecord(record)
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
				Probing:            isChannelModelStatusProbing(record, now),
			})
		}
	}
	for _, record := range records {
		record = normalizeChannelModelStatusRecord(record)
		key := channelModelStatusKey(record.Group, record.ModelName)
		if _, ok := seen[key]; ok {
			continue
		}
		views = append(views, ChannelModelStatusView{
			ChannelModelStatus: record,
			Configured:         false,
			Probing:            isChannelModelStatusProbing(record, now),
		})
	}
	return views, nil
}

func isChannelModelStatusProbing(record ChannelModelStatus, now int64) bool {
	return record.Status == common.ChannelStatusAutoDisabled &&
		record.DisabledUntil > 0 &&
		now >= record.DisabledUntil
}

func GetChannelModelStatus(channelID int, group, modelName string) (*ChannelModelStatus, error) {
	status := &ChannelModelStatus{}
	err := DB.Where("channel_id = ? AND "+commonGroupCol+" = ? AND model_name = ?", channelID, normalizeChannelModelStatusGroup(group), normalizeChannelModelStatusName(modelName)).First(status).Error
	if err != nil {
		return nil, err
	}
	*status = normalizeChannelModelStatusRecord(*status)
	return status, nil
}

func UpsertChannelModelFailure(update ChannelModelFailureUpdate) error {
	update.Group = normalizeChannelModelStatusGroup(update.Group)
	update.ModelName = normalizeChannelModelStatusName(update.ModelName)
	if update.ChannelId <= 0 || update.ModelName == "" {
		return nil
	}
	if update.FailureThreshold < 1 {
		update.FailureThreshold = 1
	}
	now := common.GetTimestamp()
	disabledUntil := int64(0)
	if update.CooldownSeconds > 0 {
		disabledUntil = now + update.CooldownSeconds
	}
	initialStatus := common.ChannelStatusEnabled
	initialDisabledAt := int64(0)
	initialDisabledBy := ""
	if update.ForceDisabled || (update.AutoDisableEligible && update.FailureThreshold <= 1) {
		initialStatus = common.ChannelStatusAutoDisabled
		initialDisabledAt = now
		initialDisabledBy = "auto"
	}
	record := ChannelModelStatus{
		ChannelId:      update.ChannelId,
		Group:          update.Group,
		ModelName:      update.ModelName,
		Status:         initialStatus,
		FailureCount:   1,
		LastError:      strings.TrimSpace(update.LastError),
		LastStatusCode: update.LastStatusCode,
		LastRequestId:  strings.TrimSpace(update.LastRequestId),
		LastEndpoint:   strings.TrimSpace(update.LastEndpoint),
		DisabledUntil:  disabledUntil,
		LastDisabledAt: initialDisabledAt,
		LastDisabledBy: initialDisabledBy,
		CreatedTime:    now,
		UpdatedTime:    now,
	}
	disableCondition := "CASE WHEN status = ? THEN status WHEN ? THEN ? WHEN ? AND failure_count + 1 >= ? THEN ? ELSE status END"
	disabledUntilExpr := "CASE WHEN status = ? THEN disabled_until WHEN ? OR (? AND failure_count + 1 >= ?) THEN ? ELSE disabled_until END"
	disabledAtExpr := "CASE WHEN status = ? THEN last_disabled_at WHEN ? OR (? AND failure_count + 1 >= ?) THEN ? ELSE last_disabled_at END"
	disabledByExpr := "CASE WHEN status = ? THEN last_disabled_by WHEN ? OR (? AND failure_count + 1 >= ?) THEN ? ELSE last_disabled_by END"
	assignments := map[string]interface{}{
		"failure_count":    gorm.Expr("failure_count + 1"),
		"last_error":       record.LastError,
		"last_status_code": record.LastStatusCode,
		"last_request_id":  record.LastRequestId,
		"last_endpoint":    record.LastEndpoint,
		"updated_time":     now,
		"status":           gorm.Expr(disableCondition, common.ChannelStatusManuallyDisabled, update.ForceDisabled, common.ChannelStatusAutoDisabled, update.AutoDisableEligible, update.FailureThreshold, common.ChannelStatusAutoDisabled),
		"disabled_until":   gorm.Expr(disabledUntilExpr, common.ChannelStatusManuallyDisabled, update.ForceDisabled, update.AutoDisableEligible, update.FailureThreshold, disabledUntil),
		"last_disabled_at": gorm.Expr(disabledAtExpr, common.ChannelStatusManuallyDisabled, update.ForceDisabled, update.AutoDisableEligible, update.FailureThreshold, now),
		"last_disabled_by": gorm.Expr(disabledByExpr, common.ChannelStatusManuallyDisabled, update.ForceDisabled, update.AutoDisableEligible, update.FailureThreshold, "auto"),
	}
	err := DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "channel_id"},
			{Name: "group"},
			{Name: "model_name"},
		},
		DoUpdates: clause.Assignments(assignments),
	}).Create(&record).Error
	if err != nil {
		return err
	}
	if refreshed, refreshErr := GetChannelModelStatus(update.ChannelId, update.Group, update.ModelName); refreshErr == nil {
		cacheStoreChannelModelStatus(*refreshed)
	}
	return nil
}

func RecordChannelModelSuccess(update ChannelModelSuccessUpdate) error {
	update.Group = normalizeChannelModelStatusGroup(update.Group)
	update.ModelName = normalizeChannelModelStatusName(update.ModelName)
	if update.ChannelId <= 0 || update.ModelName == "" {
		return nil
	}
	now := common.GetTimestamp()
	updates := map[string]interface{}{
		"success_count":   gorm.Expr("success_count + 1"),
		"failure_count":   0,
		"last_request_id": strings.TrimSpace(update.LastRequestId),
		"last_endpoint":   strings.TrimSpace(update.LastEndpoint),
		"updated_time":    now,
		"status":          gorm.Expr("CASE WHEN status = ? THEN ? ELSE status END", common.ChannelStatusAutoDisabled, common.ChannelStatusEnabled),
		"last_error":      gorm.Expr("CASE WHEN status = ? THEN ? ELSE last_error END", common.ChannelStatusAutoDisabled, ""),
		"last_status_code": gorm.Expr(
			"CASE WHEN status = ? THEN ? ELSE last_status_code END",
			common.ChannelStatusAutoDisabled,
			0,
		),
		"disabled_until": gorm.Expr("CASE WHEN status = ? THEN ? ELSE disabled_until END", common.ChannelStatusAutoDisabled, 0),
		"last_disabled_by": gorm.Expr(
			"CASE WHEN status = ? THEN ? ELSE last_disabled_by END",
			common.ChannelStatusAutoDisabled,
			"",
		),
	}
	tx := DB.Model(&ChannelModelStatus{}).
		Where("channel_id = ? AND "+commonGroupCol+" = ? AND model_name = ?", update.ChannelId, update.Group, update.ModelName).
		Updates(updates)
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return nil
	}
	if refreshed, refreshErr := GetChannelModelStatus(update.ChannelId, update.Group, update.ModelName); refreshErr == nil {
		cacheStoreChannelModelStatus(*refreshed)
	}
	return nil
}

func UpdateChannelModelStatus(channelID int, group, modelName string, status int, reason string, disabledBy string) error {
	group = normalizeChannelModelStatusGroup(group)
	modelName = normalizeChannelModelStatusName(modelName)
	if channelID <= 0 || modelName == "" {
		return nil
	}
	now := common.GetTimestamp()
	disabledAt := int64(0)
	disabledUntil := int64(0)
	disabledBy = strings.TrimSpace(disabledBy)
	if status == common.ChannelStatusAutoDisabled || status == common.ChannelStatusManuallyDisabled {
		disabledAt = now
		if disabledBy == "" {
			disabledBy = "manual"
		}
	}
	record := ChannelModelStatus{
		ChannelId:      channelID,
		Group:          group,
		ModelName:      modelName,
		Status:         status,
		LastError:      strings.TrimSpace(reason),
		DisabledUntil:  disabledUntil,
		LastDisabledAt: disabledAt,
		LastDisabledBy: disabledBy,
		CreatedTime:    now,
		UpdatedTime:    now,
	}
	assignments := map[string]interface{}{
		"status":           status,
		"last_error":       record.LastError,
		"disabled_until":   disabledUntil,
		"last_disabled_at": disabledAt,
		"last_disabled_by": disabledBy,
		"updated_time":     now,
	}
	if status == common.ChannelStatusEnabled {
		assignments["failure_count"] = 0
		assignments["last_status_code"] = 0
		assignments["last_error"] = ""
		assignments["last_disabled_at"] = int64(0)
		assignments["last_disabled_by"] = ""
	}
	err := DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "channel_id"},
			{Name: "group"},
			{Name: "model_name"},
		},
		DoUpdates: clause.Assignments(assignments),
	}).Create(&record).Error
	if err != nil {
		return err
	}
	if refreshed, refreshErr := GetChannelModelStatus(channelID, group, modelName); refreshErr == nil {
		cacheStoreChannelModelStatus(*refreshed)
	}
	return nil
}

func ClearChannelModelStatus(channelID int, group, modelName string) error {
	group = normalizeChannelModelStatusGroup(group)
	modelName = normalizeChannelModelStatusName(modelName)
	err := DB.Where("channel_id = ? AND "+commonGroupCol+" = ? AND model_name = ?", channelID, group, modelName).Delete(&ChannelModelStatus{}).Error
	if err == nil {
		cacheDeleteChannelModelStatus(channelID, group, modelName)
	}
	return err
}
