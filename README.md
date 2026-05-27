# NewAPI 运行兼容补丁镜像

这是基于原版 NewAPI 自动打补丁构建的镜像，尽量优先使用上游官方功能，只补官方还没覆盖好的兼容缺口。
仓库每次构建会在同一个 Release 里发布两个镜像：普通运行兼容版、运行兼容 + 首页美化版。
普通版只改模型调用链路；美化版额外替换公开首页，不改后台、数据库和登录逻辑。

## 使用方式

### 1. 普通运行兼容版

适合只想要 Claude Code / Codex / OpenAI Responses / Claude Messages 兼容修复，不想改首页的人。

Docker 镜像：

```text
ghcr.io/alex-ai-dev-lab/newapi-runtime-compat:v1.0.0-rc.10
```

`docker-compose.yml` 示例：

```yaml
services:
  new-api:
    image: ghcr.io/alex-ai-dev-lab/newapi-runtime-compat:v1.0.0-rc.10
    volumes:
      - ./data:/data
    ports:
      - "3000:3000"
```

如果服务器拉 GHCR 不稳定，就下载 Release 里的离线镜像包：

```text
newapi-runtime-compat-docker-image-v1.0.0-rc.10.tar.gz
```

导入：

```bash
docker load -i newapi-runtime-compat-docker-image-v1.0.0-rc.10.tar.gz
docker compose up -d
```

对应源码补丁：

```text
newapi-runtime-compat.patch
```

### 2. 运行兼容 + 首页美化版

适合想同时使用兼容修复，并替换公开首页视觉的人。

Docker 镜像：

```text
ghcr.io/alex-ai-dev-lab/newapi-runtime-compat-homepage:v1.0.0-rc.10
```

`docker-compose.yml` 示例：

```yaml
services:
  new-api:
    image: ghcr.io/alex-ai-dev-lab/newapi-runtime-compat-homepage:v1.0.0-rc.10
    volumes:
      - ./data:/data
    ports:
      - "3000:3000"
```

离线镜像包：

```text
newapi-runtime-compat-homepage-docker-image-v1.0.0-rc.10.tar.gz
```

导入：

```bash
docker load -i newapi-runtime-compat-homepage-docker-image-v1.0.0-rc.10.tar.gz
docker compose up -d
```

对应源码补丁：

```text
newapi-runtime-compat-with-homepage.patch
```

### 3. 自己本地打补丁构建

普通运行兼容版：

```bash
./deploy-newapi-compat.sh \
  /path/to/upstream/new-api-source \
  ./newapi-runtime-compat.patch \
  newapi-runtime-compat:custom \
  v1.0.0-rc.10
```

运行兼容 + 首页美化版：

```bash
./deploy-newapi-compat.sh \
  /path/to/upstream/new-api-source \
  ./newapi-runtime-compat-with-homepage.patch \
  newapi-runtime-compat-homepage:custom \
  v1.0.0-rc.10
```

## 主要改动说明

### 1. 优先保留官方功能，删掉重复补丁

- 上游已经自带的基础 Claude/OpenAI 格式转换、部分 Responses 处理、基础渠道测试逻辑，尽量不重复改。
- 删除历史遗留的特定渠道 ID 硬编码，避免把个人环境规则带进通用镜像。
- 删除和模型调用无关的零散前端小改动，减少后续升级冲突。

### 2. Claude Code / Claude 类客户端更稳

- 清理 `cch`、`cc_version`、`cc_entrypoint` 这类 Claude Code attribution 信息，并重写请求体缓存。
- 清理 Claude Code 容易生成的无效工具参数，比如 `Read.pages=""`。
- 合并连续并行 `tool_use` 历史，减少工具调用后模型只回一句话就停止的概率。
- 修正 Claude / OpenAI 流式转换中的工具调用、空 assistant 回合和结束事件。

### 3. Codex / OpenAI Responses 兼容

- Codex 上游要求 `stream=true` 时，平台侧自动用上游流式，再聚合回非流式 JSON 给客户端。
- 对 `chat.completions` 走 Responses 的场景做兜底转换。
- 清理 Codex 容易拒绝的参数，例如 `top_p`。
- 修正后台测试渠道把 SSE 当普通 JSON 解析导致的报错。

### 4. 渠道失败自动切换

- 遇到 401、403、402、429、首字超时、请求失败、典型网关错误时，服务端优先自动切换到下一个可用渠道。
- 失败渠道会从本次重试里排除，避免出现 `50->50->50` 这种一直切回自己的情况。
- 明显无额度、鉴权失败、限流或超时的渠道会自动禁用，减少客户端任务被 429/502 直接打断。

### 5. 自动测试及恢复开关

- 每个渠道新增“允许自动测试及恢复”开关。
- 打开：系统可以按定时任务自动测试，并在恢复后自动启用。
- 关闭：系统定时测试会跳过该渠道，除非用户手动启用。

### 6. 首页美化版额外改动

- 只替换公开首页的 Hero、能力说明、端点说明、Quickstart、结尾 CTA、顶栏和底栏。
- 样式尽量限制在首页作用域内。
- 不改后台管理功能、不改数据库结构、不改登录逻辑。
