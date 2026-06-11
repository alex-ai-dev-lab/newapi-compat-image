# Evidence

Anti-poison evidence is written under:

```text
/app/logs/anti-poison/channel-{id}/{request_id}.json
```

Evidence should contain sanitized previews only. Authorization, API key, token, password, and secret values must be redacted.

Target fields:

- `request_id`
- `channel_id`
- `channel_name`
- `profile`
- `model`
- `user_id`
- `token_id`
- `request_headers_preview`
- `request_body_preview`
- `upstream_body_preview`
- `error_code`
- `risk_level`
- `risk_signal`
- `sanitized_error`
- `original_error_text`
- `action_taken`
- `retry_channel_id`
- `probe_request_id`
- `stream_mode`
- `opaque_score`
- `tool_call_guard_result`
- `shape_check_result`
