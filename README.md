# NewAPI 兼容补丁镜像

这个仓库会基于原版 NewAPI 自动构建两个镜像：一个普通功能补丁版，一个功能补丁 + 首页美化版。
现在很多基础能力其实上游已经自带了，比如 Claude/OpenAI 互转、部分自动恢复、部分 Playground 清理逻辑；我们保留官方实现，只补上缺口。
补丁重点解决的是：Claude Code / Codex 兼容、渠道测试与流式转换、429/401/403 后自动切换渠道、以及“允许自动测试及恢复”这种更细的渠道控制。
美化版只改公开首页，不改后台逻辑和数据库。

## 使用方式

### 1. 普通功能补丁版

Docker 镜像：

```text
ghcr.io/alex-ai-dev-lab/newapi-compat:版本号
```

例如：

```yaml
services:
  new-api:
    image: ghcr.io/alex-ai-dev-lab/newapi-compat:v1.0.0-rc.9
    volumes:
      - ./data:/data
    ports:
      - "3000:3000"
```

Release 里的离线镜像包：

```text
newapi-compat-image-v1.0.0-rc.9.tar.gz
```

导入方式：

```bash
docker load -i newapi-compat-image-v1.0.0-rc.9.tar.gz
docker compose up -d
```

对应补丁文件：

```text
newapi-compat-core.patch
```

### 2. 功能补丁 + 首页美化版

Docker 镜像：

```text
ghcr.io/alex-ai-dev-lab/newapi-compat-home:版本号
```

例如：

```yaml
services:
  new-api:
    image: ghcr.io/alex-ai-dev-lab/newapi-compat-home:v1.0.0-rc.9
    volumes:
      - ./data:/data
    ports:
      - "3000:3000"
```

Release 里的离线镜像包：

```text
newapi-compat-home-image-v1.0.0-rc.9.tar.gz
```

导入方式：

```bash
docker load -i newapi-compat-home-image-v1.0.0-rc.9.tar.gz
docker compose up -d
```

对应补丁文件：

```text
newapi-compat-home.patch
```

### 3. 自己本地打补丁构建

普通功能补丁版：

```bash
./deploy-newapi-compat.sh \
  /path/to/upstream/new-api-source \
  ./newapi-compat-core.patch \
  newapi-compat:custom \
  v1.0.0-rc.9
```

功能补丁 + 首页美化版：

```bash
./deploy-newapi-compat.sh \
  /path/to/upstream/new-api-source \
  ./newapi-compat-home.patch \
  newapi-compat-home:custom \
  v1.0.0-rc.9
```

## 主要改动说明

### 1. Claude Code / Claude 类调用更稳

- 修正 Claude / OpenAI 流式和非流式之间的转换。
- 清理 Claude attribution、`cch`、`cc_version`、`cc_entrypoint`。
- 避免一些工具参数被错误传递，导致调用中断。
- 避免上游返回空 assistant 回合导致 Claude Code 自己停下。

### 2. Codex 相关兼容

- Codex 测试渠道会按需要强制走流式。
- `chat.completions` 和 `responses` 之间会做更稳的转换。
- 去掉 Codex 容易拒绝的参数，比如 `top_p`。
- 修掉一些“看起来能通，实际解析会炸”的情况。

### 3. 渠道测试更稳

- 某些渠道后台点“测试”时，上游会返回 SSE。
- 以前会被当成普通 JSON 解析，直接报错。
- 现在测试链会先看响应类型，再决定按流式还是按普通 JSON 处理。

### 4. 自动测试 / 自动恢复更合理

- 新增“允许自动测试及恢复”开关。
- 关掉后，系统定时测试时会跳过这个渠道，也不会自动把它启用。
- 需要人工手动启用时，才会重新参与自动测试。

### 5. 自动切换渠道更积极

- 429、401、403、首字超时、请求失败等情况，会尽量在服务端自动换下一个渠道。
- 尽量避免把这些错误直接返回给本地 Codex，导致任务中断。
- 对明显失败的渠道会做禁用和排除，减少同一个坏渠道反复重试。

### 6. 网关兼容更顺手

- 一些客户端 base_url 写重复时，能少踩坑。
- 对 OpenAI / Claude / Responses 这几条链路做了兼容修正。
- 尽量让客户端“照着原来的写法就能跑”。

### 7. 首页美化版额外改了什么

- 替换公开首页，增加更现代的 Hero、能力说明、端点展示、Quickstart 和 CTA。
- 微调顶栏和底栏视觉样式。
- 首页样式使用独立作用域，尽量不影响后台页面。
- 不改路由、不改数据库、不改登录和后台管理逻辑。
