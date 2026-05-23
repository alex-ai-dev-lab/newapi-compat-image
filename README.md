# NewAPI 兼容补丁镜像

这里会自动基于原版 NewAPI 构建两个镜像：一个只打功能兼容补丁，一个在功能补丁基础上再加首页美化。
功能补丁主要解决 Claude Code、Codex、OpenAI Responses、Claude Messages、渠道测试、流式转换和 429 自动换渠道这些兼容问题。
首页美化版额外替换公开首页，并微调顶栏 logo 和底栏样式，不改后台逻辑和数据库。
上游 NewAPI 更新后，Actions 会自动尝试重新打补丁并发布镜像包；如果补丁冲突，Actions 会失败，需要手动更新补丁。

## 使用方式

### 1. 只要功能补丁

镜像：

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

也可以在 Releases 下载离线包：

```text
newapi-patched-v1.0.0-rc.8.tar.gz
```

导入：

```bash
docker load -i newapi-patched-v1.0.0-rc.8.tar.gz
docker compose up -d
```

### 2. 功能补丁 + 首页美化

镜像：

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

也可以在 Releases 下载离线包：

```text
newapi-patched-home-v1.0.0-rc.8.tar.gz
```

导入：

```bash
docker load -i newapi-patched-home-v1.0.0-rc.8.tar.gz
docker compose up -d
```

### 3. 两个 Actions 分别做什么

- `Build patched NewAPI release`：只应用 `selected-compat-v6.patch`，发布 `newapi-compat` 镜像。
- `Build patched NewAPI + home release`：应用 `selected-compat-v7.patch`，发布 `newapi-compat-home` 镜像。

`selected-compat-v7.patch` 等于“功能补丁 + 首页美化补丁”。`iz-home.patch` 是单独的首页美化补丁，保留它是为了以后需要拆分或重做 UI 时更方便。

### 4. 自己本地打补丁构建

只打功能补丁：

```bash
./deploy-newapi-compat.sh \
  /path/to/upstream/new-api-source \
  ./selected-compat-v6.patch \
  newapi-compat:custom \
  v1.0.0-rc.8
```

功能补丁 + 首页美化：

```bash
./deploy-newapi-compat.sh \
  /path/to/upstream/new-api-source \
  ./selected-compat-v7.patch \
  newapi-compat-home:custom \
  v1.0.0-rc.8
```

### 5. 更新和回滚

更新时把 `docker-compose.yml` 里的镜像 tag 改成新版本，然后：

```bash
docker compose up -d
```

回滚时把镜像 tag 改回旧版本，再执行同一条命令即可。两个镜像都不改数据库结构，通常可以直接互相切换。

## 这个镜像主要改了什么

### 1. Claude Code / Claude 类调用更稳

- 处理 Claude Code 的工具调用链
- 修正 Claude / OpenAI 流式和非流式之间的转换
- 清理 Claude attribution / `cch` / `cc_version` / `cc_entrypoint`
- 避免一些工具参数被错误传递，导致调用中断
- 避免上游返回空 assistant 回合导致 Claude Code 自己停下

### 2. Codex 相关兼容

- Codex 测试渠道会按需要强制走流式
- `chat.completions` 和 `responses` 之间会做更稳的转换
- 去掉 Codex 容易拒绝的参数，比如 `top_p`
- 修掉一些“看起来能通，实际解析会炸”的情况

### 3. 渠道测试更稳

- 某些渠道后台点“测试”时，上游会返回 SSE
- 以前会被当成普通 JSON 解析，直接报错
- 现在测试链会先看响应类型，再决定按流式还是按普通 JSON 处理

### 4. 自动测试 / 自动恢复更合理

- 手动禁用的渠道也能参与自动测试
- 自动恢复逻辑不再只认“自动禁用”
- 对一些常见的测试误判做了兜底

### 5. 网关兼容更顺手

- 一些客户端 base_url 写重复时，能少踩坑
- 对 OpenAI / Claude / Responses 这几条链路做了兼容修正
- 尽量让客户端“照着原来的写法就能跑”

### 6. 429 / 额度不足时尽量自动换渠道

- Codex / Claude Code / Responses 这类长任务遇到上游 429、余额不足、额度不足时，会尽量在服务端换下一个可用渠道重试
- 尽量避免把 429 直接返回给本地 Codex，导致本地任务中断
- 如果渠道开启了自动禁用，补丁会把明显失败的渠道标记掉，让同一次请求更容易切到其他渠道

### 7. 首页美化版额外改了什么

- 替换公开首页，增加更现代的 Hero、能力卡片、端点展示、Quickstart 和 CTA
- 顶栏 logo 增加徽章感边框和内嵌阴影，站点名换成轻微渐变文字
- 底栏增加渐变细线、状态点和更紧凑的排版
- 所有首页样式都用 `.iz-*` 作用域包住，不影响后台页面
