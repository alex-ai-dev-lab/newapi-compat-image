# Channel Risk Profiles

Defaults:

| Channel | Profile | Production routing |
|---|---|---|
| 77 | trusted | yes |
| 101 | probation | yes, strict verification |
| 94 | quarantine | no |

Profiles:

- `trusted`: direct stream with light scan, no required envelope.
- `unknown`: short TTL probe, first bytes buffer for stream, score-based opaque scan.
- `probation`: required envelope for non-stream, aggregate then replay for stream strategy, strict tool guard.
- `quarantine`: scheduled probe only, production routing disabled.

Per-channel override lives in channel settings as:

```json
{"anti_poison_profile":"trusted"}
```
