# NewAPI Compat 镜像

基于 `QuantumNous/new-api` upstream tag 生成补丁并构建 Docker 镜像，用于 Ken 的 NewAPI 生产环境兼容改造。

这个仓库不直接 fork 上游源码，核心交付物是两个 patch 和 GitHub Actions 构建出的镜像 tar 包。

## 镜像变体

| 变体 | 镜像名 | 内容 |
|---|---|---|
| Runtime | `ghcr.io/alex-ai-dev-lab/newapi-runtime-compat:v1.0.0-rc.10` | 兼容补丁、后台功能、调度与数据库参数调整 |
| Runtime + Homepage | `ghcr.io/alex-ai-dev-lab/newapi-runtime-compat-homepage:v1.0.0-rc.10` | Runtime 变体 + “One endpoint. Every model.” 首页 |

发布资产包含：

- `newapi-runtime-compat-docker-image-v1.0.0-rc.10.tar.gz`
- `newapi-runtime-compat-homepage-docker-image-v1.0.0-rc.10.tar.gz`
- `newapi-runtime-compat.patch`
- `newapi-runtime-compat-with-homepage.patch`
- `SHA256SUMS.txt`
- `ARTIFACTS.SHA256SUMS`
- `RELEASE_NOTES.md`

## 当前实际功能

### 客户端兼容

- `/v1/v1/*` 重复前缀兼容。
- Codex / OpenAI Responses 兼容：
  - Codex channel `/backend-api/codex/responses` 支持。
  - 部分 Responses 请求可做参数清理、stream 聚合、chat fallback。
  - encrypted reasoning 相关 affinity / scrub fallback 保留在 runtime patch 中。
- Claude Messages / Claude Code 兼容：
  - Claude attribution 与部分工具调用历史兼容修补。
  - Claude thinking 请求优先选择支持 thinking 的渠道。
  - 渠道 thinking 支持开关是三态：自动推断、强制支持、强制不支持；未配置时按渠道类型推断。
  - 无 thinking 兼容渠道时，发送前清洗 `thinking` / `redacted_thinking` block 和 request `thinking` 参数。

### 后台功能

- User-Agent 管理：
  - 入口：`系统设置 -> 模型相关 -> User-Agent Management`
  - 优先级：渠道自定义 UA > 渠道选择 UA > 模型大类全局 UA > 系统默认 UA
  - 模型大类：`openai`、`claude`、`grok`、`gemini`、`other`
  - 支持启用/禁用、排序、导入/导出、默认 UA。
  - 新增、编辑、删除后会立即刷新 relay 热路径缓存。
- Client Identity 管理：
  - 入口：`系统设置 -> 模型相关 -> Client Identity`
  - Codex：强制写入 `client_metadata.x-codex-installation-id`
  - Claude：强制写入 `metadata.user_id.device_id`、`metadata.user_id.session_id`，并同步 `X-Claude-Code-Session-Id`
  - Generic：可配置任意 JSON body 字段或 header 字段，适配后续其他厂商。
  - 支持手动生成、立即轮换、按周/月/年自动轮换。
- 上游错误归一化：
  - 仅归一化错误响应。
  - 客户端看到固定错误信息。
  - DB 规则只能选择固定内置消息或管理员写入的 `custom_message`；不会透传上游错误正文。
  - 后台日志保留上游错误预览，但做脱敏。
- 定时渠道测试：
  - 每渠道可设置启用、间隔分钟、每轮尝试次数、连续失败禁用阈值、测试时间段、时区。
  - 支持跨天窗口，例如 `23:00-07:00`。
- 官方价格同步：
  - 入口：`系统设置 -> 模型相关 -> Model Pricing -> Upstream Sync`
  - 来源固定为 `https://models.dev/api.json`。
  - 后端只接收白名单官方 provider，并过滤带 `/` 的聚合商/转售商模型别名，例如 `openai/gpt-*`、`siliconflow/deepseek-*`。
  - 后台“上游价格同步”只暴露 `models.dev` 预设，不再列出生产渠道或 OpenRouter/custom 入口。
  - 后台有官方同步状态和手动同步按钮；自动后台同步默认关闭，需要自动跑时显式设置 `OFFICIAL_PRICE_SYNC_ENABLED=true`。
- 统计看板：
  - 支持 `1d`、`7d`、`30d`、`1y`、`all`。
  - 管理员可看渠道、模型、用户维度统计。
  - 首字延迟覆盖总览、渠道、模型、用户维度；来源为日志 `other.frt`，查询对损坏 JSON 做了防护。
  - 后台可配置默认时间范围、自动刷新开关和 5/15/30/60 秒刷新间隔；用户浏览器本地偏好仍优先。
- 站点导航与模块：
  - 顶部文档地址可在 `系统设置 -> 站点设置 -> Header navigation` 配置。
  - 侧边栏模块可在 `系统设置 -> 站点设置 -> Sidebar modules` 配置全局显示/隐藏，并支持顶层分组和分组内模块上移/下移排序。

### 数据库与运行参数

- SQLite 仍是默认生产数据库。
- patch 保留主库和独立日志 SQLite 的 WAL、`busy_timeout` 和保守连接池设置，适合 Ken 当前“小并发、多读少写”的场景。
- 如果后续日志量、字段、写入并发明显上升，再迁移 MySQL 更合适；当前镜像没有强制迁库。

## 后台入口速查

| 功能 | 入口 |
|---|---|
| 模型控制中心 | `系统设置 -> 模型相关 -> Model Operations` |
| 运维控制中心 | `系统设置` 默认入口、`系统设置 -> 运维/Operations -> Operations Center`，含配置入口地图和 Dashboard/Appearance/System Information/Sidebar 当前默认值快照，或命令面板 `Operations Center` |
| 配置入口地图 | `Operations Center -> Configuration map`，按 Runtime / Analytics / Appearance / Safety 分组 |
| 命令面板直达 | `Operations Center`、`Dashboard Defaults`、`Appearance`、`Announcements`、`API Addresses`、`FAQ`、`Uptime Kuma`、`Chat Presets`、`Drawing`、`System Information`、`System Notice`、`Header Navigation`、`Sidebar Modules`、`Performance Settings`、`Monitoring & Alerts`；支持用 `json` / `import` / `export` 搜索可迁移配置 |
| UA 管理 | `系统设置 -> 模型相关 -> User-Agent Management` |
| Client Identity | `系统设置 -> 模型相关 -> Client Identity` |
| 官方价格同步 | `系统设置 -> 模型相关 -> Model Pricing -> Upstream Sync` |
| 上游错误归一化 | `系统设置 -> 安全 -> Upstream Error Rules` |
| 请求限制/防护 | `系统设置 -> 安全 -> Rate Limiting`、`Sensitive Words`、`SSRF Protection` 支持 JSON 导入/导出；导入仅更新当前表单，需保存后写入后台 |
| 渠道测试调度 | `渠道 -> 编辑渠道 -> 测试/恢复相关高级设置` |
| Claude thinking 支持 | `渠道 -> 编辑渠道 -> Claude thinking support` |
| 系统行为 | `系统设置 -> 运维/Operations -> System Behavior`，可配置重试次数、默认侧边栏、演示站点、自用模式，并支持 JSON 导入/导出 |
| 监控与告警 | `系统设置 -> 运维/Operations -> Monitoring & Alerts`，可配置全局渠道测试、自动禁用/恢复、重试状态码、额度提醒，并支持 JSON 导入/导出 |
| 性能设置 | `系统设置 -> 运维/Operations -> Performance`，可配置磁盘缓存、资源阈值、性能指标采集，并支持 JSON 导入/导出 |
| SMTP/Worker | `系统设置 -> 运维/Operations -> SMTP Email` 与 `Worker Proxy` 支持 JSON 导入/导出；导出的 `SMTPToken`、`WorkerValidKey` 默认脱敏，导入脱敏占位符时保留当前密钥 |
| 认证配置 | `系统设置 -> 认证/Auth -> Basic Authentication`、`OAuth Integrations`、`Passkey Authentication`、`Bot Protection`、`Custom OAuth` 支持 JSON 导入/导出；OAuth/Turnstile/Custom OAuth 密钥默认脱敏 |
| 运营统计总览 | `Dashboard -> Overview` 的管理员 `Operations center` |
| 模型/渠道/用户统计 | `Dashboard -> Model Call Analytics`、`Dashboard -> Channel Analytics`、`Dashboard -> User Analytics` |
| 统计默认视图 | `系统设置 -> 内容/外观 -> Data Dashboard`，可配置默认时间范围、自动刷新、刷新间隔、表格页大小、健康筛选、趋势模式、Dashboard 分区可见性、旧图表默认项和健康判定阈值，并支持 JSON 导入/导出 |
| 控制台公告 | `系统设置 -> 内容/外观 -> Announcements`，可配置公告列表和启用状态，并支持 JSON 导入/导出 |
| API 地址展示 | `系统设置 -> 内容/外观 -> API Addresses`，可配置控制台 API 地址卡片和启用状态，并支持 JSON 导入/导出 |
| FAQ | `系统设置 -> 内容/外观 -> FAQ`，可配置常见问题列表和启用状态，并支持 JSON 导入/导出 |
| Uptime Kuma | `系统设置 -> 内容/外观 -> Uptime Kuma`，可配置状态页分组和启用状态，并支持 JSON 导入/导出 |
| Chat Presets | `系统设置 -> 内容/外观 -> Chat Presets`，可配置聊天客户端预设，并支持 JSON 导入/导出 |
| Drawing | `系统设置 -> 内容/外观 -> Drawing`，可配置绘图/Midjourney 相关开关，并支持 JSON 导入/导出 |
| 原始调用日志 | 统计页的 `Logs` / `View logs` 动作会跳到 `Usage Logs -> common`，并自动带入模型、渠道或用户过滤条件 |
| 站点基础信息 | `系统设置 -> 站点设置 -> System Information`，可配置系统名、服务地址、Logo、Footer、About、首页内容、用户协议和隐私政策，并支持 JSON 导入/导出 |
| 系统公告 | `系统设置 -> 站点设置 -> System Notice`，可配置站点全局公告，并支持 JSON 导入/导出 |
| 顶部文档地址 | `系统设置 -> 站点设置 -> Header navigation -> Documentation URL` |
| 侧边栏模块 | `系统设置 -> 站点设置 -> Sidebar modules`，可配置显示/隐藏、顶层分组排序和分组内模块排序，并可从 Operations Center 直达 |
| 全局默认外观 | `系统设置 -> 内容/外观 -> Appearance`，可配置全局默认主题/字体/圆角/密度/内容宽度，并支持 JSON 导入/导出 |

## 已知边界

- 当前代码不是 README 旧版描述的 `pkg/compat/` 全量 hook 化架构；仍有不少兼容逻辑直接落在上游目录中。
- 没有承诺 7MB 镜像体积。实际 release tar 大约几十 MB，取决于 upstream 构建产物。
- 没有完整 metrics 面板；统计看板基于现有 NewAPI 日志表查询。
- 后台视觉与导航是局部增强：包含主题切换、命令面板、统计页和部分设置页整理，不是完整 Phase3 管理后台重写。
- 官方价格同步不是“所有模型官网逐一抓取”。当前实现以 `models.dev` 的官方 provider 元数据为源，并做 provider 白名单与 slash alias 过滤；若 `models.dev` 本身缺失某个官方模型，需要后续补映射或手工维护。
- 生产 compose 目前需要 `user: "0:0"`，因为服务器挂载的 `logs` / `data` 目录权限按 root 跑最稳。移除 root override 前必须先验证挂载目录权限。

逐项需求验收和不可宣传口径见 `docs/ken-requirements-audit.md`。Step 3 架构状态见 `docs/step3-completion-summary.md` 与 `docs/step3-overlay-refactor-design.md`。

## 构建

手动触发 GitHub Actions：

```bash
gh workflow run build-release.yml \
  -R alex-ai-dev-lab/newapi-compat-image \
  -f upstream_tag=v1.0.0-rc.10
```

工作流会从 upstream tag 拉源码，分别应用：

- `newapi-runtime-compat.patch`
- `newapi-runtime-compat-with-homepage.patch`

然后构建两个 Docker 镜像并上传 release assets。

## 生产部署

服务器如果 GHCR 拉取受限，使用 release tar：

```bash
cd /tmp
curl -fsSL --proxy http://127.0.0.1:10808 \
  -H "Authorization: Bearer <github-token>" \
  -o newapi-runtime-compat-homepage-docker-image-v1.0.0-rc.10.tar.gz \
  "https://github.com/alex-ai-dev-lab/newapi-compat-image/releases/download/newapi-compat-v1.0.0-rc.10/newapi-runtime-compat-homepage-docker-image-v1.0.0-rc.10.tar.gz"

gzip -dc newapi-runtime-compat-homepage-docker-image-v1.0.0-rc.10.tar.gz | docker load

cd /home/ken/services/new-api
docker compose up -d --no-deps --force-recreate new-api
curl -fsS http://127.0.0.1:3002/api/status
```

生产 compose 必须保留：

```yaml
services:
  new-api:
    user: "0:0"
```

如果容器启动后只输出 `failed to open log file`，优先检查 compose 的 `user: "0:0"` 是否还在，以及 `logs` / `data` 挂载目录权限。

## 维护流程

1. 在 `D:\Code\newapi\_rc10_core_work` 修改源码。
2. 跑聚焦测试：

```powershell
go test ./service ./model ./controller ./router -run 'TestApplyClientIdentity|TestClientIdentity|TestStats|TestUserAgent|TestClaudeThinking'
cd D:\Code\newapi\_rc10_core_work\web\default
npm run typecheck
npm run build
```

3. 从干净 upstream base 生成两个 patch：

```powershell
git -C D:\Code\newapi\_rc10_core_work add -N .
git -C D:\Code\newapi\_rc10_core_work diff --binary --output=D:\Code\newapi\newapi-compat-image\newapi-runtime-compat.patch 0e2cbdb6ff545c33103b9ce1fb633cbcb365f955 -- . ':!web/default/package-lock.json' ':!web/default/dist/**' ':!web/default/node_modules/**' ':!newapi.exe' ':!web/default/src/features/home/**' ':!web/default/src/styles/index.css'
git -C D:\Code\newapi\_rc10_core_work diff --binary --output=D:\Code\newapi\newapi-compat-image\newapi-runtime-compat-with-homepage.patch 0e2cbdb6ff545c33103b9ce1fb633cbcb365f955 -- . ':!web/default/package-lock.json' ':!web/default/dist/**' ':!web/default/node_modules/**' ':!newapi.exe'
```

4. 用干净 `v1.0.0-rc.10` 树执行 `git apply --check` 验证 patch。
5. 更新 `SHA256SUMS.txt`，提交并触发 Actions。
