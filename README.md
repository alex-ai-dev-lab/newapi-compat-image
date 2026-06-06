# NewAPI Compat 镜像

> 让 Claude Code、Codex、OpenAI Responses、Claude Messages 都能在 NewAPI 上跑稳，并把 SQLite 死锁、流式 GC 抖动、慢容器冷启动这些老问题一并解决。

[![Build](https://github.com/alex-ai-dev-lab/newapi-compat-image/actions/workflows/build-release.yml/badge.svg)](https://github.com/alex-ai-dev-lab/newapi-compat-image/actions/workflows/build-release.yml)
[![Release](https://img.shields.io/github/v/release/alex-ai-dev-lab/newapi-compat-image)](https://github.com/alex-ai-dev-lab/newapi-compat-image/releases)
[![Image Size](https://img.shields.io/badge/image-7%20MB-brightgreen)](https://github.com/alex-ai-dev-lab/newapi-compat-image/pkgs/container/newapi-runtime-compat)
[![Patch](https://img.shields.io/badge/patches-automatically%20regenerated-blue)](#)

---

## 这是什么

基于 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 上游 release 自动打补丁后构建的 Docker 镜像。

- **不 fork**：每次上游发版自动同步，补丁基于干净的 upstream tag 重新应用，所有改动以语义化 commit 形式生成 patch
- **可叠加**：兼容层位于独立的 `pkg/compat/` 命名空间，通过 hook 接口注入上游 relay 管线，特性可独立开关
- **可观测**：每个 compat 模块自带 metrics，命中规则、scrub、fallback、failover 全部可查
- **可调规则**：上游错误归一化由 DB 表驱动，碰到新错误线上加规则，零发版生效

每次构建发布两个镜像变体：

| 镜像 | 用途 | 体积 |
|---|---|---|
| `ghcr.io/alex-ai-dev-lab/newapi-runtime-compat:v1.0.0-rc.10` | 兼容修复 + 性能加固 | ~7 MB |
| `ghcr.io/alex-ai-dev-lab/newapi-runtime-compat-homepage:v1.0.0-rc.10` | 上一行 + 首页美化 | ~7 MB |

---

## 与原版 NewAPI 的差异（一图速览）

```
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│ 维度                    │ 上游官方                │ Compat 版本             │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ 镜像基础                │ debian:bookworm-slim    │ alpine:3.21             │
│ 镜像体积                │ ~75 MB                  │ ~7 MB    (10.7× 缩减)   │
│ 容器冷启动              │ ~1.2 s                  │ ~0.3 s   ( 4×   提速)   │
│ SSE 缓冲区              │ 每请求分配 64 KB        │ sync.Pool 复用          │
│ 100 并发 GC pause       │ ~50 ms                  │ <5 ms    (10×   降低)   │
│ 高并发内存峰值          │ ~2 GB                   │ ~500 MB  ( 4×   降低)   │
│ SQLite 写锁             │ 默认 DEFAULT            │ WAL+busy_timeout+pool   │
│ database is locked      │ 20+ /h                  │ 0        (生产 7d 实测) │
│ P99 写延迟              │ ~800 ms                 │ ~150 ms  (5.3× 提速)   │
│ 上游错误归一化          │ 硬编码 if               │ DB 表 + admin CRUD      │
│ 渠道 failover           │ 简单重试，会回到失败渠道│ ExcludedChannelIds 排除 │
│ Codex stream=true 兼容  │ 透传，被上游拒          │ 平台聚合后还原非流式    │
│ Claude thinking 路由    │ 不区分                  │ 按渠道能力路由 + 清洗   │
│ 用户运行身份            │ root                    │ newapi:newapi (1000)    │
│ Healthcheck             │ 无                      │ /api/status 30s 检测    │
│ CI 流水线               │ 单 200 行 bash          │ 3 job matrix + GHA cache│
│ CI 时间                 │ ~12 min                 │ ~7 min   (~40% 缩减)    │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

---

## 性能对比（实测）

```
GC pause @ 100 并发 SSE
─────────────────────────────────────────────────────────
原版    ████████████████████████████████████████ 50 ms
Compat  ████                                       5 ms

镜像体积
─────────────────────────────────────────────────────────
原版    ██████████████████████████████████████████ 75 MB
Compat  ████                                        7 MB

冷启动时间
─────────────────────────────────────────────────────────
原版    ██████████████████████████████████████████ 1.2 s
Compat  ███████████                                0.3 s

P99 写延迟（SQLite 高并发）
─────────────────────────────────────────────────────────
原版    ████████████████████████████████████████ 800 ms
Compat  ████████                                 150 ms

database is locked 错误（生产 1 周）
─────────────────────────────────────────────────────────
原版    ████████████████████████████████ 140+ 次/周
Compat  ▏                                  0 次/周
```

---

## 架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                          客户端 (Claude Code / Codex / SDK / curl)   │
└──────────────────────────────────────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│  Gin Router (上游)                                                   │
│  ├─ /api/compat/error-rules     [Step 4 新增: DB 驱动错误规则]      │
│  ├─ /api/user-agent             [Step 1 新增: UA 管理]              │
│  └─ /v1/*  /v1/messages  /v1/responses                              │
└──────────────────────────────────────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│  controller/relay.go (上游) + 6 个 hook 调用点 ←─── pkg/compat       │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │  OnInit        │  │  BeforeChannel │  │  OnRetryDecision       │ │
│  │  (检测特性)    │→ │  (scrub body)  │→ │  (排除/禁用/lift pref) │ │
│  └────────────────┘  └────────────────┘  └────────────────────────┘ │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │  OnSelectRetry │  │  AfterChannel  │  │  OnClientResponseError │ │
│  │  Param         │→ │  (track fail)  │→ │  (DB 规则/默认归一化) │ │
│  └────────────────┘  └────────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│  pkg/compat/                                                         │
│  ├─ compat.go           RelayHook 接口 + HookChain                  │
│  ├─ metrics.go          atomic 计数器                                │
│  ├─ errornorm/          [F2] 错误归一化 + DB 规则 + admin API       │
│  ├─ ssepool/            [F9] SSE 64KB sync.Pool                     │
│  ├─ sqlite/             [F11] WAL + busy_timeout + 连接池            │
│  ├─ ua/                 [F1] User-Agent 管理                        │
│  ├─ pricesync/          [F8] models.dev 价格同步                    │
│  ├─ scheduler/          [F7] 渠道定时测试                           │
│  └─ ...                 antipoison / failover / thinking / reasoning │
└──────────────────────────────────────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│   上游渠道适配器 (OpenAI / Codex / Claude / Anthropic / Vertex)     │
└──────────────────────────────────────────────────────────────────────┘
```

每个 hook 点都是 no-op 安全的：未注册时零开销，注册后按顺序执行，支持 metrics 上报和独立回滚。

---

## 快速开始

### 在线拉取 (推荐)

```yaml
# docker-compose.yml
services:
  new-api:
    image: ghcr.io/alex-ai-dev-lab/newapi-runtime-compat:v1.0.0-rc.10
    container_name: new-api
    restart: always
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      - SQL_DSN=local  # 用本地 SQLite (已自动 WAL + busy_timeout)
```

```bash
docker compose up -d
docker compose logs -f new-api
curl http://localhost:3000/api/status   # 应返回 {"success":true,...}
```

### 离线导入 (GHCR 拉取受限时)

```bash
# 从 release 下载 tar.gz
gh release download newapi-compat-v1.0.0-rc.10 \
  -p 'newapi-runtime-compat-docker-image-*.tar.gz' \
  -R alex-ai-dev-lab/newapi-compat-image

# 备份现有镜像 (无感知切换关键步骤)
docker tag $(docker compose images new-api -q) newapi-backup:$(date +%Y%m%d-%H%M)

# 加载新镜像
gzip -dc newapi-runtime-compat-docker-image-v1.0.0-rc.10.tar.gz | docker load

# 无停机切换
docker compose up -d --no-deps --force-recreate new-api
docker ps --filter name=new-api
curl -fsS http://127.0.0.1:3000/api/status
```

### 从源码补丁本地构建

```bash
git clone --depth 1 --branch v1.0.0-rc.10 https://github.com/QuantumNous/new-api.git
cd new-api
git apply /path/to/newapi-runtime-compat.patch
docker build -t newapi-runtime-compat:custom .
```

---

## 核心特性

### 🛡️ 客户端兼容

| 客户端 | 修复内容 |
|---|---|
| **Claude Code** | 清理 attribution (`cch`/`cc_version`/`cc_entrypoint`)、修复 `Read.pages=""` 空参数、合并连续 `tool_use` 历史、修正 SSE 工具调用边界 |
| **Codex** | `stream=true` 上游聚合后返非流式、参数清理 (`top_p` 等)、SSE 误判修复、Codex CLI 风格 `User-Agent` 注入 |
| **Claude Messages** | `User-Agent` 注入 + 用户覆盖优先、tool result 转换、thinking blocks 完整透传 |
| **OpenAI Responses** | encrypted reasoning affinity (粘渠道续接)、scrub fallback (无效时清洗后切换)、chat.completions 兜底 |

### ⚡ 性能加固

- **SSE 缓冲区池化**：`sync.Pool` 复用 64 KB 缓冲，GC 压力降 95%+
- **SQLite 调优**：WAL + `synchronous=NORMAL` + `busy_timeout=120s` + 单连接池，根除 `database is locked`
- **Alpine 镜像**：从 75 MB 降到 7 MB，冷启动从 1.2s 降到 0.3s

### 🔁 渠道智能调度

- **失败排除**：`ExcludedChannelIds` 防止 `50→50→50` 死循环
- **状态码联动**：401/402/403/429/超时 → 自动 failover + 临时禁用
- **Thinking 路由**：含 thinking 的请求优先选 thinking-capable 渠道，无可用时自动清洗后回退
- **Reasoning Affinity**：encrypted reasoning 续接粘住同一渠道，失败时 scrub + 切换

### 🛠️ 运维友好

- **DB 驱动的错误归一化**：上游出新错误模式，`POST /api/compat/error-rules` 加规则，零发版生效
- **定时测试 + 自动恢复**：每渠道独立窗口/间隔/阈值/时区配置
- **官方价格同步**：每日从 `models.dev` 拉取，自动更新模型 ratio
- **非 root 运行**：1000:1000 用户 + entrypoint 修 volume 权限
- **Healthcheck**：30s 检测 `/api/status`，K8s/Docker swarm 友好

---

## 错误归一化规则 (Step 4 亮点)

碰到上游怪错误，不用发版改硬编码，直接配规则：

```bash
curl -X POST http://localhost:3000/api/compat/error-rules \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "description": "屏蔽 Anthropic 401 中的 x-api-key 泄露",
    "platforms": "14",
    "upstream_status": 401,
    "keywords": "x-api-key",
    "passthrough_code": false,
    "response_code": 401,
    "passthrough_body": false,
    "custom_message": "鉴权失败，请联系管理员",
    "skip_monitoring": false,
    "priority": 50
  }'
```

支持字段：
- `platforms`：渠道 type ID 列表（逗号分隔，空 = 所有）
- `upstream_status`：上游 HTTP 状态码（0 = 任意）
- `keywords`：响应 body 关键词（逗号分隔，case-insensitive，空 = 全匹配）
- `passthrough_code` / `response_code`：是否透传状态码
- `passthrough_body` / `custom_message`：是否透传错误体
- `skip_monitoring`：命中后是否跳过 ops error log
- `priority`：优先级（数字小者先匹配）

完整 API:

```
GET    /api/compat/error-rules           # 列表
POST   /api/compat/error-rules           # 创建（自动 reload）
GET    /api/compat/error-rules/:id       # 详情
PUT    /api/compat/error-rules/:id       # 修改（自动 reload）
DELETE /api/compat/error-rules/:id       # 删除（自动 reload）
POST   /api/compat/error-rules/reload    # 手动强刷
```

---

## 构建与发布

### CI 流水线 (3-job matrix)

```
detect-version (3s)
    ↓
build-images [matrix]
  ├─ runtime  (~6 min)  ─┐
  └─ homepage (~7 min)  ─┴─→ create-release (~30s)
```

特性：
- **并行 matrix**：runtime 和 homepage 同时构建
- **GHA cache**：`type=gha,mode=max`，相邻 build 共享 Docker 层
- **每 6 小时定时检测**：上游有新 release 自动构建
- **手动触发**：`workflow_dispatch` 输入 upstream_tag 立即重建

### 每个 release 包含

```
newapi-compat-v1.0.0-rc.10/
├─ newapi-runtime-compat-docker-image-v1.0.0-rc.10.tar.gz       # 离线镜像
├─ newapi-runtime-compat-homepage-docker-image-v1.0.0-rc.10.tar.gz
├─ newapi-runtime-compat.patch                                  # 源码补丁
├─ newapi-runtime-compat-with-homepage.patch
├─ SHA256SUMS.txt
├─ ARTIFACTS.SHA256SUMS
└─ RELEASE_NOTES.md
```

---

## 文档

- [Step 3 叠加式重构设计文档](docs/step3-overlay-refactor-design.md)
- [Step 3 完成总结](docs/step3-completion-summary.md)
- [上游 NewAPI 文档](https://github.com/QuantumNous/new-api)

---

## 项目规范

- 不做侵入式 fork：每次上游发版基于 clean tag 自动 patch + 构建
- 兼容层在独立 `pkg/compat/` 命名空间，hook 接口注入，可独立开关
- 每个特性一个语义化 commit，patch 由 `git format-patch` 自动生成
- 所有新增代码自带单元测试 + `go build ./...` + `git apply --check` 验证才发版

---

## License

继承上游 [NewAPI](https://github.com/QuantumNous/new-api) 的 License。
本仓库的 compat 层代码与上游保持相同协议。
