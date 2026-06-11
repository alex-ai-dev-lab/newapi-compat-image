package model

import (
	"database/sql"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// OverviewStats is the high-level dashboard payload.
type OverviewStats struct {
	TotalRequests     int64         `json:"total_requests"`
	SuccessRequests   int64         `json:"success_requests"`
	FailedRequests    int64         `json:"failed_requests"`
	SuccessRate       float64       `json:"success_rate"`
	ErrorRate         float64       `json:"error_rate"`
	RequestsPerMinute float64       `json:"requests_per_minute"`
	AvgFirstTokenTime float64       `json:"avg_first_token_time"`
	AvgUseTime        float64       `json:"avg_use_time"`
	TotalCost         float64       `json:"total_cost"`
	TotalPromptTokens int64         `json:"total_prompt_tokens"`
	TotalOutputTokens int64         `json:"total_output_tokens"`
	ActiveChannels    int64         `json:"active_channels"`
	ActiveUsers       int64         `json:"active_users"`
	Trend             []TrendPoint  `json:"trend"`
	TopChannels       []ChannelStat `json:"top_channels"`
	TopFailChannels   []ChannelStat `json:"top_failing_channels"`
	SlowestChannels   []ChannelStat `json:"slowest_channels"`
	TopModels         []ModelStat   `json:"top_models"`
	TopCostUsers      []UserStat    `json:"top_cost_users"`
}

type TrendPoint struct {
	Timestamp         int64   `json:"timestamp"`
	Requests          int64   `json:"requests"`
	Success           int64   `json:"success"`
	Failure           int64   `json:"failure"`
	SuccessRate       float64 `json:"success_rate"`
	ErrorRate         float64 `json:"error_rate"`
	AvgFirstToken     float64 `json:"avg_first_token"`
	AvgUseTime        float64 `json:"avg_use_time"`
	TotalCost         float64 `json:"total_cost"`
	TotalPromptTokens int64   `json:"total_prompt_tokens"`
	TotalOutputTokens int64   `json:"total_output_tokens"`
}

type ChannelStat struct {
	ChannelID         int     `json:"channel_id"`
	ChannelName       string  `json:"channel_name"`
	TotalRequests     int64   `json:"total_requests"`
	SuccessRequests   int64   `json:"success_requests"`
	FailedRequests    int64   `json:"failed_requests"`
	SuccessRate       float64 `json:"success_rate"`
	ErrorRate         float64 `json:"error_rate"`
	AvgFirstToken     float64 `json:"avg_first_token"`
	AvgUseTime        float64 `json:"avg_use_time"`
	TotalCost         float64 `json:"total_cost"`
	TotalPromptTokens int64   `json:"total_prompt_tokens"`
	TotalOutputTokens int64   `json:"total_output_tokens"`
}

type ModelStat struct {
	ModelName         string  `json:"model_name"`
	TotalRequests     int64   `json:"total_requests"`
	SuccessRequests   int64   `json:"success_requests"`
	FailedRequests    int64   `json:"failed_requests"`
	SuccessRate       float64 `json:"success_rate"`
	ErrorRate         float64 `json:"error_rate"`
	AvgFirstToken     float64 `json:"avg_first_token"`
	AvgUseTime        float64 `json:"avg_use_time"`
	TotalCost         float64 `json:"total_cost"`
	TotalPromptTokens int64   `json:"total_prompt_tokens"`
	TotalOutputTokens int64   `json:"total_output_tokens"`
}

type UserStat struct {
	UserID            int     `json:"user_id"`
	Username          string  `json:"username"`
	TotalRequests     int64   `json:"total_requests"`
	SuccessRequests   int64   `json:"success_requests"`
	FailedRequests    int64   `json:"failed_requests"`
	SuccessRate       float64 `json:"success_rate"`
	ErrorRate         float64 `json:"error_rate"`
	AvgFirstToken     float64 `json:"avg_first_token"`
	AvgUseTime        float64 `json:"avg_use_time"`
	TotalCost         float64 `json:"total_cost"`
	TotalPromptTokens int64   `json:"total_prompt_tokens"`
	TotalOutputTokens int64   `json:"total_output_tokens"`
	TopChannelID      int     `json:"top_channel_id"`
	TopChannelName    string  `json:"top_channel_name"`
}

type ChannelUserStat struct {
	ChannelID         int     `json:"channel_id"`
	ChannelName       string  `json:"channel_name"`
	UserID            int     `json:"user_id"`
	Username          string  `json:"username"`
	TotalRequests     int64   `json:"total_requests"`
	SuccessRequests   int64   `json:"success_requests"`
	FailedRequests    int64   `json:"failed_requests"`
	SuccessRate       float64 `json:"success_rate"`
	ErrorRate         float64 `json:"error_rate"`
	AvgFirstToken     float64 `json:"avg_first_token"`
	AvgUseTime        float64 `json:"avg_use_time"`
	TotalCost         float64 `json:"total_cost"`
	TotalPromptTokens int64   `json:"total_prompt_tokens"`
	TotalOutputTokens int64   `json:"total_output_tokens"`
}

func GetOverviewStats(startTime time.Time) (*OverviewStats, error) {
	stats := &OverviewStats{}

	query := `
		SELECT
			COUNT(*) AS total_requests,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success_requests,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS failed_requests,
			AVG(` + frtExpr() + `) AS avg_first_token,
			AVG(use_time) AS avg_use_time,
			COALESCE(SUM(quota), 0) AS total_quota,
			COALESCE(SUM(prompt_tokens), 0) AS total_prompt_tokens,
			COALESCE(SUM(completion_tokens), 0) AS total_output_tokens,
			COUNT(DISTINCT CASE WHEN channel_id > 0 THEN channel_id END) AS active_channels,
			COUNT(DISTINCT CASE WHEN user_id > 0 THEN user_id END) AS active_users
		FROM logs
		WHERE type IN (?, ?)
	`
	args := []interface{}{LogTypeConsume, LogTypeError, LogTypeConsume, LogTypeError}
	if !startTime.IsZero() {
		query += " AND created_at >= ?"
		args = append(args, startTime.Unix())
	}

	var avgFirstToken sql.NullFloat64
	var avgUseTime sql.NullFloat64
	var totalQuota int64
	if err := LOG_DB.Raw(query, args...).Row().Scan(
		&stats.TotalRequests,
		&stats.SuccessRequests,
		&stats.FailedRequests,
		&avgFirstToken,
		&avgUseTime,
		&totalQuota,
		&stats.TotalPromptTokens,
		&stats.TotalOutputTokens,
		&stats.ActiveChannels,
		&stats.ActiveUsers,
	); err != nil {
		return nil, err
	}
	stats.SuccessRate = percent(stats.SuccessRequests, stats.TotalRequests)
	stats.ErrorRate = percent(stats.FailedRequests, stats.TotalRequests)
	stats.TotalCost = quotaToUSD(totalQuota)
	stats.RequestsPerMinute = requestsPerMinute(stats.TotalRequests, startTime)
	if avgFirstToken.Valid {
		stats.AvgFirstTokenTime = avgFirstToken.Float64
	}
	if avgUseTime.Valid {
		stats.AvgUseTime = avgUseTime.Float64
	}

	stats.Trend = getTrendData(startTime)
	stats.TopChannels = getTopChannels(startTime, 10)
	stats.TopFailChannels = getChannelsBy(startTime, 8, "error_rate DESC, total_requests DESC")
	stats.SlowestChannels = getChannelsBy(startTime, 8, "avg_first_token DESC, total_requests DESC")
	stats.TopModels = getTopModels(startTime, 10)
	stats.TopCostUsers = getUsersBy(startTime, 8, "total_quota DESC, total_requests DESC")
	return stats, nil
}

func GetChannelStats(startTime time.Time) ([]ChannelStat, error) {
	return getTopChannels(startTime, 50), nil
}

func GetModelStats(startTime time.Time) ([]ModelStat, error) {
	return getTopModels(startTime, 50), nil
}

func GetUserStats(startTime time.Time) ([]UserStat, error) {
	return getUsersBy(startTime, 50, "total_quota DESC, total_requests DESC"), nil
}

func GetChannelUserStats(startTime time.Time, channelID int) ([]ChannelUserStat, error) {
	if channelID <= 0 {
		return []ChannelUserStat{}, nil
	}

	var stats []ChannelUserStat
	query := `
		SELECT
			channel_id,
			user_id,
			COALESCE(NULLIF(MAX(username), ''), 'Unknown') AS username,
			COUNT(*) AS total_requests,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success_requests,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS failed_requests,
			CAST(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS REAL) * 100.0 / COUNT(*) AS success_rate,
			CAST(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS REAL) * 100.0 / COUNT(*) AS error_rate,
			AVG(` + frtExpr() + `) AS avg_first_token,
			AVG(use_time) AS avg_use_time,
			COALESCE(SUM(quota), 0) AS total_quota,
			COALESCE(SUM(prompt_tokens), 0) AS total_prompt_tokens,
			COALESCE(SUM(completion_tokens), 0) AS total_output_tokens
		FROM logs
		WHERE channel_id = ?
	`
	args := []interface{}{LogTypeConsume, LogTypeError, LogTypeConsume, LogTypeError, channelID}
	if !startTime.IsZero() {
		query += " AND created_at >= ?"
		args = append(args, startTime.Unix())
	}
	query += " GROUP BY channel_id, user_id ORDER BY total_quota DESC, total_requests DESC LIMIT 100"

	rows, err := LOG_DB.Raw(query, args...).Rows()
	if err != nil {
		return stats, nil
	}

	for rows.Next() {
		var stat ChannelUserStat
		var avgFirstToken sql.NullFloat64
		var avgUseTime sql.NullFloat64
		var totalQuota int64
		if err := rows.Scan(
			&stat.ChannelID,
			&stat.UserID,
			&stat.Username,
			&stat.TotalRequests,
			&stat.SuccessRequests,
			&stat.FailedRequests,
			&stat.SuccessRate,
			&stat.ErrorRate,
			&avgFirstToken,
			&avgUseTime,
			&totalQuota,
			&stat.TotalPromptTokens,
			&stat.TotalOutputTokens,
		); err != nil {
			continue
		}
		if avgFirstToken.Valid {
			stat.AvgFirstToken = avgFirstToken.Float64
		}
		if avgUseTime.Valid {
			stat.AvgUseTime = avgUseTime.Float64
		}
		stat.TotalCost = quotaToUSD(totalQuota)
		stats = append(stats, stat)
	}
	_ = rows.Close()

	channelNames := getChannelNameMap([]int{channelID})
	for i := range stats {
		stats[i].ChannelName = channelNameOrUnknown(channelNames, stats[i].ChannelID)
	}
	return stats, nil
}

func GetChannelTrendStats(startTime time.Time, channelID int) ([]TrendPoint, error) {
	if channelID <= 0 {
		return []TrendPoint{}, nil
	}
	return getTrendDataFiltered(startTime, channelID, "", 0), nil
}

func GetModelTrendStats(startTime time.Time, modelName string) ([]TrendPoint, error) {
	if modelName == "" {
		return []TrendPoint{}, nil
	}
	return getTrendDataFiltered(startTime, 0, modelName, 0), nil
}

func GetUserTrendStats(startTime time.Time, userID int) ([]TrendPoint, error) {
	if userID <= 0 {
		return []TrendPoint{}, nil
	}
	return getTrendDataFiltered(startTime, 0, "", userID), nil
}

func getUsersBy(startTime time.Time, limit int, orderBy string) []UserStat {
	var stats []UserStat
	query := `
		SELECT
			user_id,
			COALESCE(NULLIF(MAX(username), ''), 'Unknown') AS username,
			COUNT(*) AS total_requests,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success_requests,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS failed_requests,
			CAST(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS REAL) * 100.0 / COUNT(*) AS success_rate,
			CAST(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS REAL) * 100.0 / COUNT(*) AS error_rate,
			AVG(` + frtExpr() + `) AS avg_first_token,
			AVG(use_time) AS avg_use_time,
			COALESCE(SUM(quota), 0) AS total_quota,
			COALESCE(SUM(prompt_tokens), 0) AS total_prompt_tokens,
			COALESCE(SUM(completion_tokens), 0) AS total_output_tokens
		FROM logs
	`

	args := []interface{}{LogTypeConsume, LogTypeError, LogTypeConsume, LogTypeError}
	if !startTime.IsZero() {
		query += " WHERE created_at >= ?"
		args = append(args, startTime.Unix())
	}
	query += " GROUP BY user_id ORDER BY " + orderBy + " LIMIT ?"
	args = append(args, limit)

	rows, err := LOG_DB.Raw(query, args...).Rows()
	if err != nil {
		return stats
	}

	for rows.Next() {
		var stat UserStat
		var avgFirstToken sql.NullFloat64
		var avgUseTime sql.NullFloat64
		var totalQuota int64
		if err := rows.Scan(
			&stat.UserID,
			&stat.Username,
			&stat.TotalRequests,
			&stat.SuccessRequests,
			&stat.FailedRequests,
			&stat.SuccessRate,
			&stat.ErrorRate,
			&avgFirstToken,
			&avgUseTime,
			&totalQuota,
			&stat.TotalPromptTokens,
			&stat.TotalOutputTokens,
		); err != nil {
			continue
		}
		if avgFirstToken.Valid {
			stat.AvgFirstToken = avgFirstToken.Float64
		}
		if avgUseTime.Valid {
			stat.AvgUseTime = avgUseTime.Float64
		}
		stat.TotalCost = quotaToUSD(totalQuota)
		stats = append(stats, stat)
	}
	_ = rows.Close()

	for i := range stats {
		stats[i].TopChannelID = getUserTopChannelID(startTime, stats[i].UserID)
	}
	channelIDs := make([]int, 0, len(stats))
	for _, stat := range stats {
		if stat.TopChannelID > 0 {
			channelIDs = append(channelIDs, stat.TopChannelID)
		}
	}
	channelNames := getChannelNameMap(channelIDs)
	for i := range stats {
		stats[i].TopChannelName = channelNameOrUnknown(channelNames, stats[i].TopChannelID)
	}
	return stats
}

func getTrendData(startTime time.Time) []TrendPoint {
	return getTrendDataFiltered(startTime, 0, "", 0)
}

func getTrendDataFiltered(startTime time.Time, channelID int, modelName string, userID int) []TrendPoint {
	var trend []TrendPoint
	interval := trendIntervalSeconds(startTime)
	query := `
		SELECT
			(created_at / ?) * ? AS timestamp,
			COUNT(*) AS requests,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS failure,
			AVG(` + frtExpr() + `) AS avg_first_token,
			AVG(use_time) AS avg_use_time,
			COALESCE(SUM(quota), 0) AS total_quota,
			COALESCE(SUM(prompt_tokens), 0) AS total_prompt_tokens,
			COALESCE(SUM(completion_tokens), 0) AS total_output_tokens
		FROM logs
		WHERE type IN (?, ?)
	`
	args := []interface{}{interval, interval, LogTypeConsume, LogTypeError, LogTypeConsume, LogTypeError}
	if channelID > 0 {
		query += " AND channel_id = ?"
		args = append(args, channelID)
	}
	if modelName != "" {
		query += " AND model_name = ?"
		args = append(args, modelName)
	}
	if userID > 0 {
		query += " AND user_id = ?"
		args = append(args, userID)
	}
	if !startTime.IsZero() {
		query += " AND created_at >= ?"
		args = append(args, startTime.Unix())
	}
	query += " GROUP BY timestamp ORDER BY timestamp ASC LIMIT 500"

	rows, err := LOG_DB.Raw(query, args...).Rows()
	if err != nil {
		return trend
	}

	for rows.Next() {
		var point TrendPoint
		var avgFirstToken sql.NullFloat64
		var avgUseTime sql.NullFloat64
		var totalQuota int64
		if err := rows.Scan(
			&point.Timestamp,
			&point.Requests,
			&point.Success,
			&point.Failure,
			&avgFirstToken,
			&avgUseTime,
			&totalQuota,
			&point.TotalPromptTokens,
			&point.TotalOutputTokens,
		); err != nil {
			continue
		}
		point.SuccessRate = percent(point.Success, point.Requests)
		point.ErrorRate = percent(point.Failure, point.Requests)
		if avgFirstToken.Valid {
			point.AvgFirstToken = avgFirstToken.Float64
		}
		if avgUseTime.Valid {
			point.AvgUseTime = avgUseTime.Float64
		}
		point.TotalCost = quotaToUSD(totalQuota)
		trend = append(trend, point)
	}
	_ = rows.Close()
	return trend
}

func getTopChannels(startTime time.Time, limit int) []ChannelStat {
	return getChannelsBy(startTime, limit, "total_requests DESC")
}

func getChannelsBy(startTime time.Time, limit int, orderBy string) []ChannelStat {
	var stats []ChannelStat
	query := `
		SELECT
			channel_id,
			COUNT(*) AS total_requests,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success_requests,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS failed_requests,
			CAST(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS REAL) * 100.0 / COUNT(*) AS success_rate,
			CAST(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS REAL) * 100.0 / COUNT(*) AS error_rate,
			AVG(` + frtExpr() + `) AS avg_first_token,
			AVG(use_time) AS avg_use_time,
			COALESCE(SUM(quota), 0) AS total_quota,
			COALESCE(SUM(prompt_tokens), 0) AS total_prompt_tokens,
			COALESCE(SUM(completion_tokens), 0) AS total_output_tokens
		FROM logs
	`

	args := []interface{}{LogTypeConsume, LogTypeError, LogTypeConsume, LogTypeError}
	if !startTime.IsZero() {
		query += " WHERE created_at >= ?"
		args = append(args, startTime.Unix())
	}
	query += " GROUP BY channel_id ORDER BY " + orderBy + " LIMIT ?"
	args = append(args, limit)

	rows, err := LOG_DB.Raw(query, args...).Rows()
	if err != nil {
		return stats
	}

	for rows.Next() {
		var stat ChannelStat
		var totalQuota int64
		var avgFirstToken sql.NullFloat64
		var avgUseTime sql.NullFloat64
		if err := rows.Scan(
			&stat.ChannelID,
			&stat.TotalRequests,
			&stat.SuccessRequests,
			&stat.FailedRequests,
			&stat.SuccessRate,
			&stat.ErrorRate,
			&avgFirstToken,
			&avgUseTime,
			&totalQuota,
			&stat.TotalPromptTokens,
			&stat.TotalOutputTokens,
		); err != nil {
			continue
		}
		if avgFirstToken.Valid {
			stat.AvgFirstToken = avgFirstToken.Float64
		}
		if avgUseTime.Valid {
			stat.AvgUseTime = avgUseTime.Float64
		}
		stat.TotalCost = quotaToUSD(totalQuota)
		stats = append(stats, stat)
	}
	_ = rows.Close()

	channelIDs := make([]int, 0, len(stats))
	for _, stat := range stats {
		channelIDs = append(channelIDs, stat.ChannelID)
	}
	channelNames := getChannelNameMap(channelIDs)
	for i := range stats {
		stats[i].ChannelName = channelNameOrUnknown(channelNames, stats[i].ChannelID)
	}
	return stats
}

func getTopModels(startTime time.Time, limit int) []ModelStat {
	var stats []ModelStat
	query := `
		SELECT
			model_name,
			COUNT(*) AS total_requests,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS success_requests,
			SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS failed_requests,
			CAST(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS REAL) * 100.0 / COUNT(*) AS success_rate,
			CAST(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END) AS REAL) * 100.0 / COUNT(*) AS error_rate,
			AVG(` + frtExpr() + `) AS avg_first_token,
			AVG(use_time) AS avg_use_time,
			COALESCE(SUM(quota), 0) AS total_quota,
			COALESCE(SUM(prompt_tokens), 0) AS total_prompt_tokens,
			COALESCE(SUM(completion_tokens), 0) AS total_output_tokens
		FROM logs
	`

	args := []interface{}{LogTypeConsume, LogTypeError, LogTypeConsume, LogTypeError}
	if !startTime.IsZero() {
		query += " WHERE created_at >= ?"
		args = append(args, startTime.Unix())
	}
	query += " GROUP BY model_name ORDER BY total_requests DESC LIMIT ?"
	args = append(args, limit)

	rows, err := LOG_DB.Raw(query, args...).Rows()
	if err != nil {
		return stats
	}

	for rows.Next() {
		var stat ModelStat
		var totalQuota int64
		var avgFirstToken sql.NullFloat64
		var avgUseTime sql.NullFloat64
		if err := rows.Scan(
			&stat.ModelName,
			&stat.TotalRequests,
			&stat.SuccessRequests,
			&stat.FailedRequests,
			&stat.SuccessRate,
			&stat.ErrorRate,
			&avgFirstToken,
			&avgUseTime,
			&totalQuota,
			&stat.TotalPromptTokens,
			&stat.TotalOutputTokens,
		); err != nil {
			continue
		}
		if avgFirstToken.Valid {
			stat.AvgFirstToken = avgFirstToken.Float64
		}
		if avgUseTime.Valid {
			stat.AvgUseTime = avgUseTime.Float64
		}
		stat.TotalCost = quotaToUSD(totalQuota)
		stats = append(stats, stat)
	}
	_ = rows.Close()
	return stats
}

func getUserTopChannelID(startTime time.Time, userID int) int {
	query := `
		SELECT channel_id
		FROM logs
		WHERE user_id = ?
	`
	args := []interface{}{userID}
	if !startTime.IsZero() {
		query += " AND created_at >= ?"
		args = append(args, startTime.Unix())
	}
	query += " GROUP BY channel_id ORDER BY COALESCE(SUM(quota), 0) DESC, COUNT(*) DESC LIMIT 1"

	var channelID int
	_ = LOG_DB.Raw(query, args...).Row().Scan(&channelID)
	return channelID
}

func getChannelNameMap(ids []int) map[int]string {
	names := map[int]string{}
	if len(ids) == 0 {
		return names
	}
	type row struct {
		ID   int
		Name string
	}
	var rows []row
	if err := DB.Table("channels").Select("id, name").Where("id IN ?", ids).Scan(&rows).Error; err != nil {
		return names
	}
	for _, r := range rows {
		names[r.ID] = r.Name
	}
	return names
}

func channelNameOrUnknown(names map[int]string, id int) string {
	if name := names[id]; name != "" {
		return name
	}
	return "Unknown"
}

func statsBaseQuery(startTime time.Time) *gorm.DB {
	query := LOG_DB.Table("logs").Where("type IN ?", []int{LogTypeConsume, LogTypeError})
	if !startTime.IsZero() {
		query = query.Where("created_at >= ?", startTime.Unix())
	}
	return query
}

func frtExpr() string {
	return frtExprWithAlias("")
}

func frtExprWithAlias(alias string) string {
	prefix := ""
	if alias != "" {
		prefix = alias + "."
	}
	switch LOG_DB.Dialector.Name() {
	case "mysql":
		return "CASE WHEN JSON_VALID(" + prefix + "other) THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(" + prefix + "other, '$.frt')) AS DECIMAL(18,3)) ELSE NULL END"
	default:
		return "CASE WHEN json_valid(" + prefix + "other) THEN CAST(json_extract(" + prefix + "other, '$.frt') AS REAL) ELSE NULL END"
	}
}

func trendIntervalSeconds(startTime time.Time) int64 {
	if startTime.IsZero() {
		return 24 * 3600
	}
	diff := time.Since(startTime)
	switch {
	case diff <= 48*time.Hour:
		return 3600
	case diff <= 31*24*time.Hour:
		return 6 * 3600
	default:
		return 24 * 3600
	}
}

func quotaToUSD(quota int64) float64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	return float64(quota) / common.QuotaPerUnit
}

func requestsPerMinute(total int64, startTime time.Time) float64 {
	if total <= 0 {
		return 0
	}
	if startTime.IsZero() {
		var bounds struct {
			MinCreatedAt int64
			MaxCreatedAt int64
		}
		if err := LOG_DB.Table("logs").
			Where("type IN ?", []int{LogTypeConsume, LogTypeError}).
			Select("MIN(created_at) AS min_created_at, MAX(created_at) AS max_created_at").
			Scan(&bounds).Error; err != nil || bounds.MaxCreatedAt <= bounds.MinCreatedAt {
			return 0
		}
		minutes := float64(bounds.MaxCreatedAt-bounds.MinCreatedAt) / 60
		if minutes <= 0 {
			return float64(total)
		}
		return float64(total) / minutes
	}
	minutes := time.Since(startTime).Minutes()
	if minutes <= 0 {
		return float64(total)
	}
	return float64(total) / minutes
}

func percent(part, total int64) float64 {
	if total <= 0 {
		return 0
	}
	return float64(part) * 100 / float64(total)
}
