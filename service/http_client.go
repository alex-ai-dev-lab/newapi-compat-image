package service

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gorilla/websocket"

	"golang.org/x/net/proxy"
)

type HTTPClientOptions struct {
	Proxy                 string
	TLSInsecureSkipVerify bool
}

var (
	httpClient      *http.Client
	proxyClientLock sync.Mutex
	proxyClients    = make(map[HTTPClientOptions]*http.Client)
)

func checkRedirect(req *http.Request, via []*http.Request) error {
	fetchSetting := system_setting.GetFetchSetting()
	urlStr := req.URL.String()
	if err := common.ValidateURLWithFetchSetting(urlStr, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return fmt.Errorf("redirect to %s blocked: %v", urlStr, err)
	}
	if len(via) >= 10 {
		return fmt.Errorf("stopped after 10 redirects")
	}
	return nil
}

func InitHttpClient() {
	client, err := NewHttpClientWithOptions(HTTPClientOptions{})
	if err != nil {
		common.SysError("failed to initialize http client: " + err.Error())
		return
	}
	httpClient = client
}

func GetHttpClient() *http.Client {
	return httpClient
}

func NewHttpClient() *http.Client {
	client, err := NewHttpClientWithOptions(HTTPClientOptions{})
	if err != nil {
		return http.DefaultClient
	}
	return client
}

// GetHttpClientWithProxy returns the default client or a proxy-enabled one when proxyURL is provided.
func GetHttpClientWithProxy(proxyURL string) (*http.Client, error) {
	return GetHttpClientWithOptions(HTTPClientOptions{Proxy: proxyURL})
}

func GetHttpClientWithOptions(options HTTPClientOptions) (*http.Client, error) {
	options = normalizeHTTPClientOptions(options)
	if options.Proxy == "" && !options.TLSInsecureSkipVerify {
		if client := GetHttpClient(); client != nil {
			return client, nil
		}
		return NewHttpClientWithOptions(options)
	}

	proxyClientLock.Lock()
	if client, ok := proxyClients[options]; ok {
		proxyClientLock.Unlock()
		return client, nil
	}
	proxyClientLock.Unlock()

	client, err := NewHttpClientWithOptions(options)
	if err != nil {
		return nil, err
	}
	proxyClientLock.Lock()
	proxyClients[options] = client
	proxyClientLock.Unlock()
	return client, nil
}

// ResetProxyClientCache 清空代理客户端缓存，确保下次使用时重新初始化
func ResetProxyClientCache() {
	proxyClientLock.Lock()
	defer proxyClientLock.Unlock()
	for _, client := range proxyClients {
		if transport, ok := client.Transport.(*http.Transport); ok && transport != nil {
			transport.CloseIdleConnections()
		}
	}
	proxyClients = make(map[HTTPClientOptions]*http.Client)
}

// NewProxyHttpClient 创建支持代理的 HTTP 客户端
func NewProxyHttpClient(proxyURL string) (*http.Client, error) {
	return GetHttpClientWithOptions(HTTPClientOptions{Proxy: proxyURL})
}

func NewHttpClientWithOptions(options HTTPClientOptions) (*http.Client, error) {
	transport, err := newHTTPTransportWithOptions(options)
	if err != nil {
		return nil, err
	}
	client := &http.Client{
		Transport:     transport,
		CheckRedirect: checkRedirect,
	}
	if common.RelayTimeout > 0 {
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
	}
	return client, nil
}

func NewWebSocketDialerWithOptions(options HTTPClientOptions) (*websocket.Dialer, error) {
	options = normalizeHTTPClientOptions(options)
	dialer := *websocket.DefaultDialer
	if options.Proxy != "" {
		parsedURL, err := parseProxyURL(options.Proxy)
		if err != nil {
			return nil, err
		}
		switch parsedURL.Scheme {
		case "http", "https":
			dialer.Proxy = http.ProxyURL(parsedURL)
		case "socks5", "socks5h":
			socksDialer, err := newSocks5Dialer(parsedURL)
			if err != nil {
				return nil, err
			}
			dialer.Proxy = nil
			dialer.NetDialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
				return socksDialer.Dial(network, addr)
			}
		default:
			return nil, unsupportedProxySchemeError(parsedURL.Scheme)
		}
	}
	if shouldSkipTLSVerify(options) {
		dialer.TLSClientConfig = newInsecureTLSConfig()
	}
	return &dialer, nil
}

func normalizeHTTPClientOptions(options HTTPClientOptions) HTTPClientOptions {
	options.Proxy = strings.TrimSpace(options.Proxy)
	return options
}

func newHTTPTransportWithOptions(options HTTPClientOptions) (*http.Transport, error) {
	options = normalizeHTTPClientOptions(options)
	transport := &http.Transport{
		MaxIdleConns:        common.RelayMaxIdleConns,
		MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
		ForceAttemptHTTP2:   true,
	}
	if options.Proxy == "" {
		transport.Proxy = http.ProxyFromEnvironment // Support HTTP_PROXY, HTTPS_PROXY, NO_PROXY env vars
	} else {
		parsedURL, err := parseProxyURL(options.Proxy)
		if err != nil {
			return nil, err
		}
		switch parsedURL.Scheme {
		case "http", "https":
			transport.Proxy = http.ProxyURL(parsedURL)
		case "socks5", "socks5h":
			socksDialer, err := newSocks5Dialer(parsedURL)
			if err != nil {
				return nil, err
			}
			// proxy.SOCKS5 使用 tcp 参数，所有 TCP 连接包括 DNS 查询都将通过代理进行。行为与 socks5h 相同
			transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
				return socksDialer.Dial(network, addr)
			}
		default:
			return nil, unsupportedProxySchemeError(parsedURL.Scheme)
		}
	}
	if shouldSkipTLSVerify(options) {
		transport.TLSClientConfig = newInsecureTLSConfig()
	}
	return transport, nil
}

func shouldSkipTLSVerify(options HTTPClientOptions) bool {
	return common.TLSInsecureSkipVerify || options.TLSInsecureSkipVerify
}

func newInsecureTLSConfig() *tls.Config {
	// #nosec G402 -- disabled only when an administrator explicitly enables
	// global or per-channel upstream compatibility for broken/self-signed TLS.
	return &tls.Config{InsecureSkipVerify: true}
}

func parseProxyURL(proxyURL string) (*url.URL, error) {
	return url.Parse(strings.TrimSpace(proxyURL))
}

func newSocks5Dialer(parsedURL *url.URL) (proxy.Dialer, error) {
	var auth *proxy.Auth
	if parsedURL.User != nil {
		auth = &proxy.Auth{
			User:     parsedURL.User.Username(),
			Password: "",
		}
		if password, ok := parsedURL.User.Password(); ok {
			auth.Password = password
		}
	}
	return proxy.SOCKS5("tcp", parsedURL.Host, auth, proxy.Direct)
}

func unsupportedProxySchemeError(scheme string) error {
	return fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", scheme)
}
