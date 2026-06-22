package middleware

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestResolveChannelBaseURLReplacesModelPlaceholder(t *testing.T) {
	ch := &model.Channel{
		Type:    constant.ChannelTypeCustom,
		BaseURL: common.GetPointer("https://example.test/{model}/v1"),
	}

	require.Equal(t, "https://example.test/gpt-test/v1", resolveChannelBaseURL(ch, "gpt-test"))
}

func TestSelectVertexRegionSupportsCommaSeparatedList(t *testing.T) {
	require.Equal(t, "us-central1", selectVertexRegion("us-central1, europe-west4"))
	require.Equal(t, "europe-west4", selectVertexRegion("us-central1, europe-west4"))
	require.Equal(t, "asia-east1", selectVertexRegion(" asia-east1 "))
	require.Equal(t, "", selectVertexRegion(""))
}
