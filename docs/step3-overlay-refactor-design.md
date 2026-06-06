# Step 3 — 侵入式 → 叠加式重构设计文档

> 目的：在保持当前所有功能行为不变的前提下，把现在分散在上游核心文件里的修改，重组成"叠加层"，让 patch 体积大幅压缩、上游升级冲突概率显著下降。
> 这份文档只设计接口，不动代码。Ken review 通过后再实施。

---

## 1. 现状分类（基于 78 个改动文件 / 5468+ / 180-）

### 1A 后端 Go 改动（按功能聚类）

| 聚类 | 行数（新增） | 关键文件 | 现侵入点 |
|---|---|---|---|
| **F1 UA 管理** | ~800 | `controller/user_agent.go`, `model/user_agent.go`, `model/user_agent_cache.go`, `relay/channel/api_request.go`, `relay/channel/openai/adaptor.go`, `relay/channel/codex/adaptor.go`, `relay/channel/claude/relay-claude.go`, `dto/channel_settings.go` | adaptor 层注入 + router 注册 |
| **F2 上游错误归一化** | ~140 | `service/upstream_error_normalize.go`, `setting/.../upstream_error_normalize_setting.go`, `controller/relay.go` defer 处的 1 行 | `controller/relay.go` defer，`types/error.go` 11 行 |
| **F3 Claude antipoison** | ~570 | `relay/antipoison/*`, `relay/claude_anti_poison.go`, `relay/claude_handler.go`, `relay/compatible_handler.go`, `relay/channel/claude/relay-claude.go` | claude_handler / compatible_handler 写入点 |
| **F4 失效渠道 failover** | ~177 | `controller/compat_channel_failover.go`, `service/channel_select.go`, `model/ability.go`, `controller/relay.go` 多处 | retry 循环、`shouldRetry` 之后、`processChannelError` 之后 |
| **F5 Claude thinking 路由 + 清洗** | ~310 | `service/claude_thinking_compat.go`, `dto/channel_settings.go`, `model/channel.go`, `model/channel_cache.go`, `controller/relay.go` 多处 | retry 循环 init/fallback/scrub body |
| **F6 加密 reasoning affinity + fallback** | ~430 | `service/encrypted_reasoning_compat.go`, `setting/.../encrypted_reasoning_fallback_setting.go`, `relay/channel/openai/relay_responses.go`, `relay/channel/openai/chat_via_responses.go`, `relay/common/relay_info.go`, `controller/relay.go` 多处 | retry 循环 init/scrub body, OpenAI Responses adaptor |
| **F7 渠道定时测试调度器** | ~370 | `controller/channel_test_scheduler.go`, `controller/channel-test.go`（改 119 行）, `model/ability.go` 部分, `main.go` 启动 | controller/channel-test.go 内部，main.go 启动 goroutine |
| **F8 官方价格同步（models.dev）** | ~273 | `controller/official_price_sync.go`, `controller/official_price_sync_api.go`, `controller/ratio_sync.go`, `main.go`, `router/api-router.go` | router 注册 + main 启动 |
| **F9 SSE 流式与 token 计数补丁** | ~330 | `relay/helper/stream_scanner.go`, `relay/helper/valid_request.go`, `relay/common/stream_status.go`, `relay/chat_completions_via_responses.go`, `relay/channel/openai/chat_via_responses.go`（部分）, `relay/responses_handler.go` | scanner 直接改 + 多处 fix |
| **F10 OpenAI compat policy & `/v1/v1` 去重 & 参数清洗** | ~250 | `service/openaicompat/policy.go`, `service/openai_chat_responses_mode.go`, `service/convert.go +193`, `relay/channel/codex/adaptor.go`, `relay/channel/openai/adaptor.go` | 散在 adaptor/convert/policy |
| **F11 SQLite WAL + busy timeout + pool** | ~16 | `common/database.go`, `common/init.go`, `common/constants.go`, `model/main.go` | 上游 init 顺序 |
| **F12 attribution / Read.pages 等小补丁** | ~50 | 散在 `service/convert.go`, `relay/claude_handler.go` 等 | 改散文 |

合计后端 ~3700 行新增，~180 行删除。

### 1B 前端 React 改动

| 聚类 | 行数 | 文件 |
|---|---|---|
| **U1 渠道编辑高级设置（UA/错误/thinking/定时测试 控件）** | ~370 | `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx`, `lib/channel-form.ts`, `types.ts`, `constants.ts`, `api.ts` |
| **U2 UA 管理后台 section** | ~430 | `web/default/src/features/system-settings/models/user-agent-settings-section.tsx`, `section-registry.tsx` |
| **U3 渠道测试 dialog 小改** | ~5 | `channel-test-dialog.tsx` |
| **U4 playground / usage-logs / keys 小修补** | ~290 | `web/default/src/features/playground/lib/storage.ts +210`, 其余 |
| **U5 classic 前端兼容（旧版）** | ~24 | `web/classic/...` |

合计前端 ~1100 行新增。

---

## 2. 重构目标和原则

1. **零行为变更**：任何一个特性，所有现有 e2e 行为必须等价（测试用例无须改动）。
2. **patch 压缩**：核心目标是上游升级时的冲突最小化。把"改" 转成"加文件 + 注册"。
3. **目录边界清晰**：所有新增代码集中在 `pkg/compat/` 下。上游目录里只剩**注册行**和**hook 点暴露**。
4. **可关闭**：每个 compat 模块都能通过单一开关 + 环境变量短路掉，方便定位"是不是兼容层的锅"。
5. **可观测**：每个模块自报 metric（命中次数、fallback 次数），统一注册到 `pkg/compat/metrics.go`。
6. **不引入新运行时依赖**：不上 wire / ent / 新 ORM；继续用 gin / gorm / 现有 cache 抽象。
7. **保留两类 patch**：runtime-only 和 runtime+homepage。后者只多加一个前端 dist 替换 patch。

---

## 3. 目标目录结构（提议）

```
新增（位于上游源码树内）：
pkg/compat/
  README.md                                     # 维护手册
  compat.go                                     # Register() / Enabled() 总入口
  metrics.go                                    # prometheus-style 计数
  config.go                                     # 统一配置加载
  ua/
    detector.go                                 # F1 UA detector pattern
    middleware.go                               # gin middleware：写 outbound UA
    model.go                                    # 表结构
    repo.go
    cache.go
    api.go                                      # /api/compat/user-agent/*
    seed.go                                     # 默认 UA 种子
  errornorm/
    rule.go                                     # F2 规则（含 DB 持久化，留作未来）
    normalizer.go                               # 当前阶段：硬编码规则也走这层
    response_writer.go                          # gin response writer 包装
  antipoison/                                   # F3，从现有 relay/antipoison 平移
    （保持现有结构，提到 pkg/compat 下）
  failover/
    excluder.go                                 # F4 排除策略
    retry_decorator.go                          # 包住 service.RetryParam
    disabler.go                                 # 失败渠道禁用策略
  thinking/
    detector.go                                 # F5 检测请求是否含 thinking
    sanitizer.go                                # 清洗
    channel_filter.go                           # 渠道筛选（thinking-capable）
  reasoning/
    affinity.go                                 # F6 affinity
    fallback.go                                 # F6 scrub & fallback
  scheduler/
    runner.go                                   # F7 定时调度
    config.go                                   # 每渠道窗口/间隔/阈值
  pricesync/
    fetcher.go                                  # F8 models.dev fetch
    applier.go                                  # 覆盖官方 ratio
    api.go                                      # 手动触发 endpoint
  sqlite/
    tune.go                                     # F11 启动期 PRAGMA / pool
  ssepool/
    scanner.go                                  # F9 sync.Pool 化的 scanner（也是 Step 2）
  openaicompat/
    paramstrip.go                               # F10 top_p 删除等
    routenorm.go                                # /v1/v1 -> /v1
    convert_ext.go                              # 多余的 convert 扩展

上游侵入（约 12 处，每处 ≤ 5 行）：
  main.go                       +5  ：compat.Register(...)
  router/api-router.go          +5  ：compat.RegisterRoutes(r)
  controller/relay.go           +20 ：导出 8 个 hook 点（init/before-select/before-call/on-error/on-success/before-defer/before-retry/after-retry）
  relay/claude_handler.go        +3 ：hook 入口
  relay/compatible_handler.go    +1
  relay/responses_handler.go     +1
  relay/channel/openai/adaptor.go +3 ：透出 outbound request hook
  relay/channel/codex/adaptor.go  +3 ：同上
  relay/channel/claude/relay-claude.go +3 ：同上
  model/main.go                  +2 ：调用 compat/sqlite.Tune
  common/database.go             +1
  service/channel_select.go      +5 ：暴露 excluder hook
```

---

## 4. 核心 Hook 设计（最重要的一段）

`controller/relay.go` 现在被改了 433 行，是侵入主战场。设计目标：把所有特性钩在统一的 hook 接口上，relay.go 只承担"调度 hook"的工作。

### 4.1 RelayHooks 接口

```go
// pkg/compat/compat.go
package compat

import (
    "github.com/gin-gonic/gin"
    relaycommon "..../relay/common"
    "..../types"
    "..../model"
    "..../service"
)

// RelayHook is implemented by every compat module that wants to influence
// the relay pipeline. All methods are no-op safe and must remain idempotent.
type RelayHook interface {
    Name() string

    // OnInit fires once after relayInfo is built, before channel selection.
    // Modules use this to detect request features and set RelayInfo flags.
    OnInit(c *gin.Context, info *relaycommon.RelayInfo) error

    // OnSelectRetryParam fires once before the retry loop starts.
    // Modules use this to populate ExcludedChannelIds, PreferredChannelId,
    // RequireClaudeThinkingSupport, etc.
    OnSelectRetryParam(c *gin.Context, info *relaycommon.RelayInfo, p *service.RetryParam)

    // BeforeChannelCall fires once per retry, after a channel is picked but
    // before the upstream call. Modules use this to scrub request body
    // (claude thinking sanitize, encrypted reasoning scrub).
    // Returning a non-nil error skips this channel and triggers retry.
    BeforeChannelCall(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, p *service.RetryParam) *types.NewAPIError

    // AfterChannelCall fires after each upstream call, before shouldRetry.
    // err may be nil on success.
    AfterChannelCall(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, err *types.NewAPIError)

    // OnRetryDecision fires after shouldRetry() but before the next loop iteration.
    // shouldRetryResult is the upstream shouldRetry() decision.
    // Modules can adjust RetryParam (exclude channel, lift preference, etc.)
    // and override shouldRetry by returning a different bool.
    // Typical: return shouldRetryResult (pass-through), or return true (force retry).
    OnRetryDecision(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, err *types.NewAPIError, p *service.RetryParam, shouldRetryResult bool) bool

    // OnClientResponseError fires inside the defer block, before the error is
    // serialized to the client. Modules can normalize/redact the message.
    OnClientResponseError(c *gin.Context, info *relaycommon.RelayInfo, err *types.NewAPIError) *types.NewAPIError
}
```

### 4.2 在 relay.go 中的精简调用

`controller/relay.go` 的所有 hook 调用集中成 7 行（vs 现在 433 行）：

```go
hooks := compat.Hooks()  // global registry

if err := hooks.OnInit(c, relayInfo); err != nil { ... }
hooks.OnSelectRetryParam(c, relayInfo, retryParam)

for ; retryParam.GetRetry() <= maxRetryTimes; retryParam.IncreaseRetry() {
    ch, chErr := getChannel(c, relayInfo, retryParam)
    // ...
    if e := hooks.BeforeChannelCall(c, relayInfo, ch, retryParam); e != nil {
        newAPIError = e; continue
    }
    // ... call upstream ...
    hooks.AfterChannelCall(c, relayInfo, ch, newAPIError)
    if newAPIError == nil { return }
    
    shouldRetryResult := shouldRetry(c, newAPIError, maxRetryTimes-retryParam.GetRetry())
    finalShouldRetry := hooks.OnRetryDecision(c, relayInfo, ch, newAPIError, retryParam, shouldRetryResult)
    if !finalShouldRetry { break }
}

// in defer:
newAPIError = hooks.OnClientResponseError(c, relayInfo, newAPIError)
```

### 4.3 各模块如何接入 hook

| 模块 | OnInit | OnSelectRetryParam | BeforeChannelCall | AfterChannelCall | OnRetryDecision | OnClientResponseError |
|---|---|---|---|---|---|---|
| F2 errornorm | - | - | - | - | - | ✓ |
| F4 failover | - | - | - | ✓ 记失败 | ✓ 排除/禁用 | - |
| F5 thinking | ✓ 检测 | ✓ Prefer/Require | ✓ scrub | - | ✓ fallback to sanitized | - |
| F6 reasoning | ✓ 检测 | ✓ Affinity | ✓ scrub | - | ✓ lift preference | - |

F1/F3/F7/F8/F9/F10/F11 不需要走 RelayHook，它们走自己的 middleware/启动 hook（见 §5）。

---

## 5. 非 Relay 类模块的接口

### 5.1 F1 UA 注入 — Gin middleware 形式

```go
// pkg/compat/ua/middleware.go
func Middleware(detector Detector) gin.HandlerFunc { ... }
```

在 adaptor 层（OpenAI / Codex / Claude）只插一个 `compat.UAMiddleware` 调用即可（3 行/adaptor），不再有"在三个 adaptor 各自写一份注入逻辑"的散点改动。

### 5.2 F2 errornorm — 现阶段保留硬编码归一化函数，做成 `OnClientResponseError` hook 即可；Step 4 再切到 DB 规则

### 5.3 F3 antipoison — 已是相对独立的 `relay/antipoison/` 包，直接平移到 `pkg/compat/antipoison/`，把调用方改成 hook

### 5.4 F4 failover — `service/channel_select.go` 暴露一个 Excluder 接口，compat 模块注入实现

### 5.5 F7 定时调度器 — `main.go` 启动期 `compat.scheduler.Start(ctx)` 一行

### 5.6 F8 价格同步 — `router.RegisterRoutes(r)` 一行 + `main.go` 启动 `compat.pricesync.Start(ctx)` 一行

### 5.7 F11 SQLite tune — `model/main.go` 现侵入 14 行 → 改成 `compat.sqlite.TunePragmas(db)` 一行调用，PRAGMA 逻辑搬到 compat 包

### 5.8 F9 SSE pool — Step 2 阶段先做 sync.Pool；scanner 接口本身不变，所以这部分继续保持薄改动（仅 3 行替换 `bufio.NewScanner` 初始化）

### 5.9 F10 OpenAI 兼容 — `service/convert.go` 大量散改是因为补丁混了协议转换扩展。设计为：在 convert.go 暴露 `compat.ConvertHooks(req, out)` 一个 hook，所有协议扩展归到 `pkg/compat/openaicompat/convert_ext.go`

---

## 6. 前端

前端不做大重构（这是 React 应用，叠加成本和收益不对等）。但做两件事：

1. 把 `user-agent-settings-section.tsx` 这类整页新文件，确保以 **新增文件** 形式存在（已经是），不是 inline 改动。
2. `channel-mutate-drawer.tsx +251` 是上游会频繁改的文件。把那 251 行抽成独立组件 `<CompatAdvancedSettings />` 放在新增文件 `web/default/src/features/channels/components/drawers/compat-advanced-settings.tsx`，drawer 里只插入一行 `<CompatAdvancedSettings form={form} />`。
3. `playground/lib/storage.ts +210` 评估是否还需要保留这个改动；如果是必要的，同样抽出为独立 hook/module。

---

## 7. 预期收益（量化）

- Patch 行数：runtime patch 从 ~7269 行 → 估算 **1500–2200 行**（70%+ 压缩）。
- 上游升级时实际冲突点：从 ~60+ 个 hunk 跨核心文件 → ~12 个明确的 hook 行（基本只是函数签名/调用位置变更）。
- 单一特性回滚：注释掉 `compat.Register("ua", ...)` 一行即可关闭整个 F1。
- 单元测试：每个 compat 模块在 `pkg/compat/*/` 自带测试，无须 mock 上游核心。

---

## 8. 兼容性 / 风险

- **行为兼容**：通过补充集成测试覆盖每个特性的端到端路径（含 retry 顺序、scrub 时机、error 文案）。
- **顺序敏感**：`RelayHook` 的多个实现按注册顺序执行。需要明确 thinking 和 reasoning 谁先 scrub（当前代码隐含 thinking 优先，新设计需把这个顺序写进 `compat.Register` 调用）。
- **性能**：8 个 hook 点每个请求会走一遍 hook chain，全部 no-op 时一次 hook 调用约 1–2ns，可忽略。
- **观测降级**：新增 compat metrics 不影响现有 prometheus/log。

---

## 9. 内嵌（推荐）vs Sidecar 决策

| 维度 | 内嵌 fork | Sidecar |
|---|---|---|
| 部署复杂度 | 1 容器 | 2 容器（同 pod / docker-compose） |
| 网络跳 | 无 | 多 1 跳本地 loopback |
| 后端代码改动 | ~12 个 hook 注册行 + 新建 pkg/compat | ≈ 0 |
| 处理面 | 所有 NewAPI 内部状态都能改 | 只能改请求/响应 |
| 适合的特性 | F1/F2/F3/F4/F5/F6/F7/F8/F9/F10/F11 全部 | F1/F2/F9/F10 一部分；F3/F4/F5/F6/F7/F8/F11 做不了或别扭 |
| 升级独立 | 仍受上游接口变化影响（虽然小 90%） | 完全独立 |

**推荐结论：内嵌 fork**。理由：本项目 12 个特性里有 7 个直接依赖 NewAPI 内部状态（channel cache、retry param、ability 表、设置表），sidecar 做不了。剩下 5 个能做的特性单独抽出 sidecar 也并不划算。Step 3 的设计已经把"上游升级冲突"从平均 60+ hunk 降到 12 个 hook 行，这跟 sidecar 的实际差距很小，但避免了运维复杂度。

如果将来希望对外发布"无 fork 兼容层"（比如让其他 NewAPI 实例 PR 时不用打 patch），那时再考虑把 F1/F2/F9/F10 抽出 sidecar 单独发版。

---

## 10. 执行步骤（待 Ken approve 后启动）

> 这一节是 Step 3 的内部子任务分解，跟主流程的 Step 1/2/4 不冲突。

1. 新建 `pkg/compat/compat.go` + `metrics.go` + `config.go`，定义接口和全局 registry。
2. 在 `controller/relay.go` 引入 hook 调用（**这一步只插入 hook，没有任何 hook 实现**，所有现有逻辑保留为兼容性 hook 实现）。跑测试，确保 0 行为差异。
3. 按 F11 → F9 → F2 → F1 → F8 → F7 → F4 → F3 → F5 → F6 → F10 顺序，把每个特性从原位置搬到 `pkg/compat/<x>/`，注册到 hook，删掉原位置代码。每搬一个跑一次测试。
4. 全部搬完后 `git format-patch` 重新生成 runtime patch 并 `git apply --check` 在干净的 rc.10 上回放。

每个特性搬迁是独立 commit，可以逐个 review。

---
