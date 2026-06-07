# Step 3 叠加式重构设计现状

这份文档保留“叠加式重构”的方向，但不再把它描述成已经完整实现。

## 目标

减少上游升级冲突，把兼容逻辑尽量从上游核心文件迁到 `pkg/compat/**`。理想终态是：

- 上游核心文件只保留少量 hook 调用。
- 每个兼容模块可以独立启停、测试和回滚。
- 后台功能、路由、数据库迁移、热路径逻辑都有清晰归属。

## 当前状态

当前代码是混合架构：

- 有 `pkg/compat` 框架。
- 有部分模块迁入 `pkg/compat`。
- 仍有大量实际逻辑留在 controller、service、relay、model、dto、web 目录。

这不是失败，但也不是“重构完成”。维护时必须按混合架构理解，不要假设兼容逻辑都在 `pkg/compat`。

## 当前模块归属

| 功能 | 当前真实归属 | 状态 |
|---|---|---|
| 错误归一化 | `pkg/compat/errornorm` + `controller/relay.go` hook | 相对完整 |
| User-Agent 管理 | `controller/user_agent.go`、`model/user_agent*.go`、relay/header 注入、前端 models section | 未迁入 compat |
| Client Identity | `model/client_identity.go`、`service/client_identity*.go`、relay/header patch、前端 models section | 未迁入 compat |
| Claude thinking | `service/claude_thinking_compat.go`、`controller/relay.go`、channel settings | 未完全 hook 化 |
| encrypted reasoning | service/relay/openai 多处 | 未完全 hook 化 |
| 定时渠道测试 | controller/model/dto + `pkg/compat/scheduler` wrapper | wrapper |
| 官方价格同步 | controller + `pkg/compat/pricesync` wrapper | 默认自动任务已关闭 |
| SQLite 调优 | `pkg/compat/sqlite` + 启动调用 | 小模块 |
| SSE pool | `pkg/compat/ssepool` + relay/helper | 部分迁移 |
| 后台重设计 | 前端多处 dashboard/theme/command palette | 原型化，不是完整 Phase3 |

## 后续重构优先级

1. 先保证行为正确，不为了目录漂亮而迁移。
2. 优先迁移容易冲突的 relay retry/fallback 逻辑。
3. 前端先拆 `channel-mutate-drawer.tsx` 的兼容设置，降低继续改渠道设置时的风险。
4. metrics 只有在有展示或采集链路时再扩展，否则不要在 README 里宣传为完整可观测。

## 不再采用的说法

以下说法不能再写进 README 或 release notes，除非有新证据：

- “所有兼容层都位于独立 `pkg/compat` 命名空间”
- “每个 compat 模块自带可查 metrics”
- “DB 驱动错误规则零发版全量覆盖所有错误”
- “镜像约 7MB”
- “Step 3 已完成全部侵入式到叠加式迁移”

## 验证要求

任何后续 patch 进入 release 前至少验证：

```powershell
go test ./pkg/compat/errornorm ./service ./model ./controller ./router -run 'TestApplyClientIdentity|TestClientIdentity|TestNormalize|TestError|TestStats|TestOfficial'
cd D:\Code\newapi\_rc10_core_work\web\default
npm run typecheck
npm run build
```

并在干净 upstream base 上执行两个 patch 的 `git apply --check`。
