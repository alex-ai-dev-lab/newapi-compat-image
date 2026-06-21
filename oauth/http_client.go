package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const maxOAuthResponseBytes int64 = 2 << 20

const defaultOAuthTimeout = 20 * time.Second

func doOAuthRequest(ctx context.Context, req *http.Request, timeout time.Duration) (*http.Response, error) {
	if req == nil || req.URL == nil {
		return nil, fmt.Errorf("oauth request url is empty")
	}
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(
		req.URL.String(),
		fetchSetting.EnableSSRFProtection,
		fetchSetting.AllowPrivateIp,
		fetchSetting.DomainFilterMode,
		fetchSetting.IpFilterMode,
		fetchSetting.DomainList,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		fetchSetting.ApplyIPFilterForDomain,
	); err != nil {
		return nil, fmt.Errorf("oauth endpoint %s blocked: %w", req.URL.String(), err)
	}
	client, err := service.NewHttpClientWithOptions(service.HTTPClientOptions{})
	if err != nil {
		return nil, err
	}
	oauthClient := *client
	if timeout > 0 {
		oauthClient.Timeout = timeout
	}
	return oauthClient.Do(req.WithContext(ctx))
}

func readOAuthResponseBody(res *http.Response) ([]byte, error) {
	if res == nil || res.Body == nil {
		return nil, fmt.Errorf("oauth response body is empty")
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, maxOAuthResponseBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > maxOAuthResponseBytes {
		return nil, fmt.Errorf("oauth response body exceeds %d bytes", maxOAuthResponseBytes)
	}
	return body, nil
}

func decodeOAuthJSONResponse(res *http.Response, target any) error {
	body, err := readOAuthResponseBody(res)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, target)
}
