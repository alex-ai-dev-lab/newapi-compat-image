# Ken 需求验收审计

这份文档按 Ken 的问答需求逐项核对当前 `v1.0.0-rc.10` compat patch。它不是宣传文案；每一项都要能落到代码、测试、入口或明确边界。

## 结论摘要

当前补丁已经覆盖核心运行需求：UA 管理、官方价格同步入口、错误归一化、每渠道定时测试、SQLite 调优、Claude thinking 路由/清洗、客户端标识符管理、统计看板局部增强和首页美化变体。

当前补丁没有完成“整套后台 Phase3 全量重设计”，也没有把所有兼容逻辑迁移到 `pkg/compat/**`。这些说法不能再用于 README、Release Notes 或对外说明。

## 功能入口速查

| 功能 | 后台入口 |
|---|---|
| UA 管理 | `系统设置 -> 模型相关 -> User-Agent Management` |
| 客户端标识符 | `系统设置 -> 模型相关 -> Client Identity` |
| 模型价格/官方同步 | `系统设置 -> 模型相关 -> Model Pricing -> Upstream Sync` |
| 上游错误归一化 | `系统设置 -> 安全 -> Upstream Error Rules` |
| 渠道定时测试配置 | `渠道 -> 编辑渠道 -> 测试/恢复相关高级设置` |
| Claude thinking 支持开关 | `渠道 -> 编辑渠道 -> Claude thinking support` |
| 统计看板 | `Dashboard` 相关页面，管理员可见渠道/用户维度 |
| 主题/外观 | `系统设置 -> 内容/外观` 和顶部主题切换 |

## 逐项验收

| # | 需求 | 当前状态 | 证据 | 边界/注意 |
|---|---|---|---|---|
| 1 | 后台 UA 管理；渠道单独设置优先于模型大类全局；支持导入/导出、排序、默认 UA | 已实现 | `controller/user_agent.go`、`model/user_agent*.go`、`relay/channel/api_request.go`、`web/default/src/features/system-settings/models/user-agent-settings-section.tsx`、`TestInitUserAgentCacheRefreshesImmediately` | 大类固定为 `openai`、`claude`、`grok`、`gemini`、`other`；模型名规则自动识别 |
| 2 | 官方价格同步，只要官方，不要转售/聚合商模型；关闭其他上游同步 | 已实现为 official-only `models.dev` | `controller/official_price_sync.go`、`controller/ratio_sync.go`、`pkg/compat/pricesync/fetcher.go`、`official-price-sync-panel.tsx`、`TestOfficial*` / `TestConvertModelsDev*` | 自动同步默认关闭；需要自动任务必须显式设置 `OFFICIAL_PRICE_SYNC_ENABLED=true`。不是逐个官网抓取，依赖 `models.dev` 官方 provider 元数据 |
| 3 | 上游错误防投毒：客户端隐藏，后台日志保留但脱敏；只做错误归一化，不扫正常输出 | 已实现 | `pkg/compat/errornorm/*`、`web/default/src/features/system-settings/security/upstream-error-rules-section.tsx`、`TestApplyRule_NeverPassesThroughUpstreamBody` | 不扫描正常模型输出；`passthrough_body` / `skip_monitoring` 已被后端强制关闭 |
| 4 | 定期渠道测试：每渠道时间、尝试次数、失败禁用阈值、测试时间段和跨天窗口 | 已实现 | `controller/channel_test_scheduler.go`、`dto/channel_settings.go`、渠道编辑 drawer、`TestGetEffectiveTestConfigUsesChannelIntervalMinutes`、`TestIsClockInTestWindowSupportsCrossDayWindow` | `auto_test_interval` 语义是分钟 |
| 5 | 数据库卡顿评估，考虑是否 SQLite 换高性能数据库 | 已做镜像级 SQLite 调优，未迁库 | `pkg/compat/sqlite/tune.go`、`model/main.go` | 当前补丁不强制迁 MySQL。Ken 当前小并发下优先 WAL + busy_timeout + 保守连接池；日志量显著上升后再迁 MySQL |
| 6 | Claude thinking sanitizer：支持渠道保持 thinking/signature，不支持渠道清洗；带 thinking sticky 到支持渠道 | 已实现 | `service/claude_thinking_compat.go`、`controller/relay.go`、`service/channel_select.go`、渠道 `supports_claude_thinking` 三态 UI、`TestSanitizeClaudeThinking*`、`TestChannelSupportsClaudeThinking*` | 没有兼容渠道时才清洗后 fallback |
| 7 | 渠道 75 Claude 400 问题 | 代码侧有 thinking/fallback/错误归一化补强；生产仍需复测 | 相关证据同 #3 / #6 | 需要部署后用真实渠道 75 日志验证，不应在未部署时宣称已修复 |
| 8 | 渠道 77 / Codex UA 与请求体标识符问题 | UA 管理和 Client Identity 已覆盖；生产仍需复测 | `service/client_identity.go`、`relay/channel/api_request.go`、`client-identity-settings-card.tsx`、`TestApplyClientIdentity*` | 需要部署后用真实渠道 77 直连/经 NewAPI 对比验证 |
| 9 | 所有设备标识符固定，支持定期轮换；Codex/Claude/其他厂商可配置字段 | 已实现 | `model/client_identity.go`、`service/client_identity*.go`、`controller/client_identity.go`、`client-identity-settings-card.tsx` | 当前策略为强制替换，不保留客户端原值 |
| 10 | 后台重设计：Vercel/Stripe/Datadog/Linear/Raycast 风格，Phase3 一次性全部 | 未完整实现；仅局部增强 | dashboard/theme/command-palette 相关前端文件 | 不能宣传为 Phase3 完成。已做主题、命令面板、统计页、局部导航整理，但不是全后台重写 |
| 11 | 首页美化变体保留 “One endpoint. Every model.” | 已实现于 homepage patch | `web/default/src/features/home/components/sections/iz-hero.tsx`、`newapi-runtime-compat-with-homepage.patch` | runtime-only patch 不包含首页改动 |
| 12 | 镜像运行别再踩非 root 导致 `failed to open log file` | 已写入 README/skill | README 生产部署章节、`newapi-compat-handoff` skill | 生产 compose 必须保留 `user: "0:0"`，除非先修挂载目录权限 |
| 13 | Release 资产命名必须和 README/部署命令一致 | 已修 | `.github/workflows/build-release.yml` | 首页 tar 统一为 `newapi-runtime-compat-homepage-docker-image-<tag>.tar.gz` |
| 14 | 模型相关入口集中到模型模块 | 已增强 | `web/default/src/features/system-settings/models/section-registry.tsx`、command palette、渠道测试/playground 错误跳转 | 旧 `billing/model-pricing` 注册暂保留用于兼容老入口 |

## 不应再使用的宣传口径

- 不要写“所有新增兼容逻辑都集中在 `pkg/compat/**`”。
- 不要写“Step 3 已完成叠加式架构全量迁移”。
- 不要写“完整 Phase3 后台重设计已完成”。
- 不要写“完整 metrics/可观测系统已完成”。
- 不要写未验证的镜像体积，例如“7MB 镜像”。
- 不要写“官方价格同步覆盖所有官网实时价格”。准确说法是：以 `models.dev` 为官方 provider 元数据源，过滤转售/聚合商别名。

## Release 前必须验证

```powershell
$patchRepo='D:\Code\newapi\newapi-compat-image'
$base='0e2cbdb6ff545c33103b9ce1fb633cbcb365f955'

go test ./pkg/compat/errornorm ./pkg/compat/pricesync ./service ./model ./controller ./router ./relay/channel -run 'TestApplyClientIdentity|TestClientIdentity|TestNormalize|TestError|TestStats|TestOfficial|TestConvertModelsDev|TestUserAgent|TestInitUserAgentCache|TestClaudeRequestHasThinking|TestClaudeThinking|TestSanitizeClaudeThinking|TestChannelSupportsClaudeThinking|TestGetEffectiveTestConfig|TestIsClockInTestWindow|TestApplyRule|TestApplyDefaultUpstreamUserAgent|TestApplyManagedUpstreamUserAgent'

cd D:\Code\newapi\_rc10_core_work\web\default
npm run typecheck
npm run build
```

还必须在干净 upstream base 上执行：

```powershell
git apply --check D:\Code\newapi\newapi-compat-image\newapi-runtime-compat.patch
git apply --check D:\Code\newapi\newapi-compat-image\newapi-runtime-compat-with-homepage.patch
```

并确认 patch 不包含：

- `web/default/dist/**`
- `web/default/node_modules/**`
- `web/default/package-lock.json`
- `newapi.exe`

## 生产验证项

以下项目只有部署后才能宣称修复完成：

- 渠道 75 Claude 400 是否还出现。
- 渠道 77 是否还返回 `codex_access_restricted`。
- UA/Client Identity 修改后是否在真实上游请求中生效。
- SQLite `database is busy` 是否在真实并发和日志写入下消失或显著降低。
- 首页 variant 是否在生产仍显示 “One endpoint. Every model.”。
