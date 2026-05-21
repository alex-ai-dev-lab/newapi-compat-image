# NewAPI 兼容补丁镜像

这是基于原版 NewAPI 自动打补丁后构建出来的 Docker 镜像。
主要用途是让 NewAPI 更好兼容 Claude Code、Codex、OpenAI Responses、Claude Messages 等调用方式。
上游 NewAPI 发布新版后，GitHub Actions 会自动尝试重新打补丁、构建镜像，并把镜像包放到 Releases。
如果补丁和新版代码冲突，Actions 会失败，需要更新补丁后再重新构建。

## 使用方式

### 方式一：使用 Releases 里的离线镜像包

在 Releases 里下载类似下面这个文件：

```text
newapi-patched-v1.0.0-rc.4.tar.gz
```

导入 Docker：

```bash
docker load -i newapi-patched-v1.0.0-rc.7.tar.gz
```

查看导入后的镜像名：

```bash
docker images | grep newapi-compat
```

然后把你的 `docker-compose.yml` 里的 NewAPI 镜像改成导入后的镜像，例如：

```yaml
services:
  newapi:
    image: ghcr.io/alex-ai-dev-lab/newapi-compat:v1.0.0-rc.7
    volumes:
      - ./data:/data
    ports:
      - "3000:3000"
```

最后重启：

```bash
docker compose up -d
```

### 方式二：自己在本地源码上打补丁构建

先准备一份原版 NewAPI 源码，然后执行：

```bash
chmod +x deploy-newapi-compat.sh

./deploy-newapi-compat.sh \
  /path/to/upstream/new-api-source \
  ./selected-compat-v6.patch \
  newapi-compat:custom \
  v1.0.0-rc.7
```

构建完成后运行：

```bash
docker run -d \
  --name newapi \
  -p 3000:3000 \
  -v ./data:/data \
  newapi-compat:custom
```

### 更新到新版补丁镜像

下载新的 Release 镜像包后：

```bash
docker load -i newapi-patched-新版本.tar.gz
```

然后把 `docker-compose.yml` 里的镜像 tag 改成新版本，再执行：

```bash
docker compose up -d
```

### 回滚

如果新版有问题，直接把 `docker-compose.yml` 里的镜像 tag 改回旧版本，然后：

```bash
docker compose up -d
```

## 这个镜像主要改了什么

### 1. Claude Code / Claude 类调用更稳

- 处理 Claude Code 的工具调用链
- 修正 Claude / OpenAI 流式和非流式之间的转换
- 清理 Claude attribution / `cch` / `cc_version` / `cc_entrypoint`
- 避免一些工具参数被错误传递，导致调用中断

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
