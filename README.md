# NewAPI 兼容补丁镜像

这个仓库会基于原版 NewAPI 自动构建两个镜像：一个是普通功能补丁版，一个是功能补丁 + 首页美化版。
普通版主要修 Claude Code、Codex、Responses、Claude Messages、渠道测试、流式转换和 429 自动换渠道等兼容问题。
美化版在普通版基础上额外替换公开首页，不改后台逻辑和数据库。
上游 NewAPI 更新后，Actions 会自动尝试重新打补丁并发布新镜像；如果上游改动导致补丁冲突，Actions 会失败，需要手动更新补丁。

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
    image: ghcr.io/alex-ai-dev-lab/newapi-compat:v1.0.0-rc.8
    volumes:
      - ./data:/data
    ports:
      - "3000:3000"
```

Release 里的离线镜像包叫：

```text
newapi-compat-image-v1.0.0-rc.8.tar.gz
```

导入方式：

```bash
docker load -i newapi-compat-image-v1.0.0-rc.8.tar.gz
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
    image: ghcr.io/alex-ai-dev-lab/newapi-compat-home:v1.0.0-rc.8
    volumes:
      - ./data:/data
    ports:
      - "3000:3000"
```

Release 里的离线镜像包叫：

```text
newapi-compat-home-image-v1.0.0-rc.8.tar.gz
```

导入方式：

```bash
docker load -i newapi-compat-home-image-v1.0.0-rc.8.tar.gz
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
  v1.0.0-rc.8
```

功能补丁 + 首页美化版：

```bash
./deploy-newapi-compat.sh \
  /path/to/upstream/new-api-source \
  ./newapi-compat-home.patch \
  newapi-compat-home:custom \
  v1.0.0-rc.8
```

## 主要改动说明

### 1. Claude Code / Claude 类调用更稳

- 处理 Claude Code 的工具调用链。
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

- 手动禁用的渠道也能参与自动测试。
- 自动恢复逻辑不再只认“自动禁用”。
- 对一些常见的测试误判做了兜底。

### 5. 网关兼容更顺手

- 一些客户端 base_url 写重复时，能少踩坑。
- 对 OpenAI / Claude / Responses 这几条链路做了兼容修正。
- 尽量让客户端“照着原来的写法就能跑”。

### 6. 429 / 额度不足时尽量自动换渠道

- Codex / Claude Code / Responses 这类长任务遇到上游 429、余额不足、额度不足时，会尽量在服务端换下一个可用渠道重试。
- 尽量避免把 429 直接返回给本地 Codex，导致本地任务中断。
- 如果渠道开启了自动禁用，补丁会把明显失败的渠道标记掉，让同一次请求更容易切到其他渠道。

### 7. 首页美化版额外改了什么

- 替换公开首页，增加更现代的 Hero、能力说明、端点展示、Quickstart 和 CTA。
- 微调顶栏和底栏视觉样式。
- 首页样式使用独立作用域，尽量不影响后台页面。
- 不改路由、不改数据库、不改登录和后台管理逻辑。
