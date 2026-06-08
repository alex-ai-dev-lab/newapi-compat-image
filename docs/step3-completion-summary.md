# Step 3 真实状态审计

这份文档替代旧的“完成总结”。旧文档把 `pkg/compat` 叠加式重构描述得过满，容易让维护者误以为所有兼容逻辑都已经迁入 hook 框架。当前真实状态如下。

## 已经存在

- `pkg/compat/compat.go`：定义了 `RelayHook`、`HookChain` 和全局注册入口。
- `pkg/compat/errornorm`：错误归一化 hook、DB 规则表、CRUD API、规则缓存和单测。
- `pkg/compat/pricesync`：官方价格同步启动入口；实际同步逻辑仍在 `controller/official_price_sync.go`。
- `pkg/compat/scheduler`：渠道更新/测试调度启动入口；实际业务逻辑仍在 controller/model 层。
- `pkg/compat/sqlite`、`pkg/compat/ssepool`、`pkg/compat/ua`：启动入口或小型封装。
- `pkg/compat/metrics.go`：定义了内存计数器。

## 没有完全落地

- 不是所有功能都通过 `RelayHook` 执行。Claude thinking、encrypted reasoning、failover、UA 等仍有大量逻辑直接留在上游目录中。
- `metrics.go` 不是完整观测系统。它没有 Prometheus/管理后台展示，也不是每个模块都稳定打点。
- `pkg/compat/pricesync` 不是完整独立模块。它只是启动 wrapper。
- `pkg/compat/scheduler` 不是完整独立模块。它只是启动 wrapper。
- 前端 `channel-mutate-drawer.tsx` 仍然很大，兼容设置没有抽成独立可维护组件。
- 文档中曾提到的“核心文件只剩少量 hook 点”不成立。

## 已修正的关键缺口

- Client Identity 改成强制替换：
  - Codex: `client_metadata.x-codex-installation-id`
  - Claude: `metadata.user_id.device_id`、`metadata.user_id.session_id`、`X-Claude-Code-Session-Id`
  - Generic: 任意 JSON body 字段或 header 字段
- Generic header 不再只写入入站请求；relay 层会把 identity header patch 明确应用到上游请求。
- Client Identity 后台补齐 Generic 字段配置 UI。
- User-Agent 管理修正：
  - 新增、编辑、删除 UA 后立即刷新 relay 热路径缓存，不再最多等待 5 分钟才生效。
  - 覆盖测试：`TestInitUserAgentCacheRefreshesImmediately`。
- 统计看板修复：
  - API 返回值正确解包。
  - 用户统计页不再是空白占位。
  - `logs.other` 损坏 JSON 不会炸首字延迟统计。
  - 日志统计避免在 `LOG_DB` 上 join 主库 `channels/users`，方便未来日志库独立。
  - 模型统计补齐 `avg_first_token`，模型分析页展示 Avg First Token。
- 上游错误规则补齐后台入口：
  - `系统设置 -> 安全 -> Upstream Error Rules`
  - 支持新增、编辑、删除、reload 规则。
  - 规则不会透传上游错误正文；客户端只会看到管理员固定消息或内置固定消息，原始上游错误只进入脱敏日志。
- 定时渠道测试单位修正：
  - 每渠道 `auto_test_interval` 的语义是分钟，和全局 AutoTestChannelMinutes 及后台表单一致。
  - 跨天窗口仍按 `23:00-07:00` 这种格式支持。
  - 覆盖测试：`TestIsClockInTestWindowSupportsCrossDayWindow`、`TestIsClockInTestWindowSupportsSameDayWindow`。
- Claude thinking 支持开关修正：
  - 后端字段保持 `*bool`，nil 表示自动推断。
  - 前端改为三态：自动推断、强制支持、强制不支持；不会再把未配置渠道保存成 `false`。
  - `request.thinking` 本身也会触发 thinking-compatible 渠道优先选择。
- 官方价格同步自动任务需要设置 `OFFICIAL_PRICE_SYNC_ENABLED=true`；启用后按容器本地时区每天 07:00 执行，仍保留手动 trigger API。
- 官方价格同步补成 official-only：
  - `系统设置 -> 模型相关 -> Model Pricing -> Upstream Sync` 增加官方同步状态和手动同步按钮。
  - 模型价格页也挂到 `系统设置 -> 模型相关` 下，旧的 `计费与支付 -> Model Pricing` 入口暂时保留，避免破坏原导航。
  - `GetSyncableChannels` 只返回 `models.dev` 预设，不再把生产渠道、OpenRouter 或 custom endpoint 暴露给后台同步入口。
  - `models.dev` 转换只接收官方 provider 白名单。
  - 即使在官方 provider bucket 中，也跳过带 `/` 的模型名，避免导入 `openai/gpt-*`、`siliconflow/deepseek-*` 等聚合商/转售商别名。
  - 同步策略为 add-only：只新增本地缺失模型，不覆盖已有模型价格，手工维护的特殊模型继续保留。
  - 前端同步弹窗只读展示固定 endpoint，不再允许切换到普通渠道接口。
- SQLite 调优补齐：
  - 主库 SQLite 和独立日志 SQLite 都会应用 WAL、`synchronous=NORMAL`、`busy_timeout=120000` 和保守连接池。

## 维护建议

1. 不要再把 Step 3 描述为“完成的叠加式架构”。更准确的说法是“已有一部分 compat 包和 hook 框架，但仍是混合架构”。
2. 后续若继续重构，优先迁移热路径里最容易冲突的 `controller/relay.go` 逻辑，而不是继续增加 wrapper。
3. 每次改 patch 前都要跑：

```powershell
go test ./pkg/compat/errornorm ./service ./model ./controller ./router -run 'TestApplyClientIdentity|TestClientIdentity|TestNormalize|TestError|TestStats|TestOfficial'
cd D:\Code\newapi\_rc10_core_work\web\default
npm run typecheck
npm run build
```

4. 文档里不要写未验证的性能数字、镜像体积或“全量已完成”。
