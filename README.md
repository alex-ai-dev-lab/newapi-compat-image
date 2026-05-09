# NewAPI 兼容补丁镜像

这是一个给 **原版 NewAPI 镜像** 用的“补丁版发布仓库”。

说白了就是：

- 上游 NewAPI 更新了以后，我这里会自动拉最新源码
- 先把我整理好的兼容补丁打上去
- 再重新构建一个可直接用的镜像
- 最后把镜像打包放到 GitHub Releases 里

你可以把它当成：

- 原版 NewAPI 的“增强版镜像”
- 一个自动打补丁、自动出新镜像的仓库
- 一个方便回滚、方便比对的发布包

## 这个镜像主要改了什么

我做的不是重写 NewAPI，而是把一些容易出问题的地方补齐了，重点是兼容性。

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

## 这个仓库里有什么

- `selected-compat-v6.patch`
  - 核心补丁文件
- `SHA256SUMS.txt`
  - 校验文件
- `deploy-newapi-compat.sh`
  - 本地手工构建 / 应用补丁脚本
- `.github/workflows/build-release.yml`
  - GitHub Actions 自动构建脚本

## 发布出来的东西长什么样

每次上游有新版本并且补丁还能打上去时，Actions 会生成一个新的 Release，里面一般会有：

- 重新构建好的镜像打包文件
- 校验文件
- 补丁文件

你拿到 Release 以后可以直接：

1. 下载镜像包
2. `docker load`
3. 把 `docker-compose.yml` 里的镜像名换成新镜像
4. `docker compose up -d`

## 自动更新是怎么跑的

这个仓库的 GitHub Actions 会定时检查上游 NewAPI 的最新 Release。

如果发现上游有新版本，它会自动：

1. 下载上游源码
2. 应用补丁
3. 构建镜像
4. 打包镜像
5. 发一个新的 Release

如果补丁和上游代码打架了，Actions 会失败，这时候就需要我再更新补丁一次。

## 本地手工怎么用

如果你想自己在本机先跑一遍，可以这样做：

```bash
git clone <你的仓库>
cd newapi-compat-image
chmod +x deploy-newapi-compat.sh
./deploy-newapi-compat.sh \
  /path/to/upstream/new-api-source \
  /path/to/selected-compat-v6.patch \
  new-api:compat-custom-$(date +%Y%m%d%H%M)
```

如果你用的是 Windows PowerShell，直接看 README 时如果出现乱码，记得这样读：

```powershell
Get-Content .\README.md -Encoding UTF8
```

## 怎么判断这份补丁有没有生效

最简单的办法：

- 看容器是不是正常启动
- 看 `/api/status` 是否正常
- 看测试渠道有没有还在报之前那些老错误

常见老错误包括：

- `Stream must be set to true`
- `Unsupported parameter: top_p`
- `Invalid pages parameter: ""`
- `invalid character 'd' looking for beginning of value`

如果这些老问题不再出现，基本就说明补丁链路是通的。

## 回滚怎么办

最简单的回滚方式就是：

1. 把镜像切回上一个稳定版本
2. 重启容器

因为我这里发布的是“补丁镜像”，所以回滚就是换回旧镜像，不需要动数据库。

## 说明

这个仓库只负责：

- 给上游 NewAPI 打补丁
- 重新构建镜像
- 发布补丁版镜像

它不负责：

- 代理配置
- HTTPS 证书
- 反代规则
- 域名解析
- 服务器本身的运维脚本
