package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannelInfoScanAcceptsStringJSON(t *testing.T) {
	var info ChannelInfo

	require.NoError(t, info.Scan(`{"is_multi_key":false,"multi_key_size":0,"multi_key_status_list":{},"multi_key_polling_index":0,"multi_key_mode":"random"}`))
	require.False(t, info.IsMultiKey)
}

func TestChannelInfoScanTreatsEmptyAsDefault(t *testing.T) {
	var info ChannelInfo

	require.NoError(t, info.Scan(""))
	require.False(t, info.IsMultiKey)
}
