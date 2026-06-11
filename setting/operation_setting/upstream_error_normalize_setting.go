package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type UpstreamErrorNormalizeSetting struct {
	Enabled bool `json:"enabled"`
}

var upstreamErrorNormalizeSetting = UpstreamErrorNormalizeSetting{
	Enabled: true,
}

func init() {
	config.GlobalConfig.Register("upstream_error_normalize_setting", &upstreamErrorNormalizeSetting)
}

func GetUpstreamErrorNormalizeSetting() *UpstreamErrorNormalizeSetting {
	return &upstreamErrorNormalizeSetting
}
