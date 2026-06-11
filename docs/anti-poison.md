# Anti-Poison

Anti-poison behavior is profile based instead of global strict mode.

Core changes:

- Real user requests do not get canary text appended by default.
- Canary is probe-only by default.
- Probation non-stream responses require a nonce-bound answer envelope.
- Opaque payload scanner detects zero-width, bidi override, control chars, dense percent encoding, long base64-like blobs, long hex blobs, and high-entropy segments.
- Quarantine channels are removed from production routing.

Envelope XML:

```xml
<newapi_answer nonce="...">
answer
</newapi_answer>
```

Envelope JSON:

```json
{"newapi_nonce":"...","answer":"OK"}
```

Envelope outside text and nonce mismatch are hard blocks. Missing envelope is suspicious and should retry another channel rather than permanently disabling on a single event.
