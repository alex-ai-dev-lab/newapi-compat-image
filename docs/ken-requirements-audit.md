# Ken 需求验收审计

这份文档按 Ken 的问答需求逐项核对当前 `v1.0.0-rc.10` compat patch。它不是宣传文案；每一项都要能落到代码、测试、入口或明确边界。

## 结论摘要

当前补丁已经覆盖核心运行需求：UA 管理、官方价格同步入口、错误归一化、每渠道定时测试、SQLite 调优、Claude thinking 路由/清洗、客户端标识符管理、统计看板局部增强和首页美化变体。

当前补丁没有完成“整套后台 Phase3 全量重设计”，也没有把所有兼容逻辑迁移到 `pkg/compat/**`。这些说法不能再用于 README、Release Notes 或对外说明。

本轮外观配置增量：`系统设置 -> 内容/外观 -> Appearance` 已补充后台全局强调色开关和 `#RRGGBB` 颜色值配置，并纳入 Appearance JSON 导入/导出；后端 option 校验只接受布尔开关和合法十六进制颜色；`/api/status` 下发后默认前端会在启用时覆盖 primary/ring/chart/sidebar 相关 CSS 变量，关闭或颜色非法时回到主题预设。Operations Center 的 `Defaults snapshot` 也会显示当前强调色状态。这是轻量外观可配置补强，不是完整主题引擎。

本轮模型配置迁移增量：`系统设置 -> 模型相关 -> Model Pricing` 已补充模型价格、倍率、分组倍率和工具价格 JSON 导入/导出；导入只更新当前表单或工具价格编辑器，仍需管理员在对应 tab 保存，官方价格同步动作不参与导入/导出。`Global Model Configuration`、`Claude`、`Gemini`、`Grok` 和 `Channel Affinity` 已补充 JSON 导入/导出，覆盖全局 passthrough/thinking/ping、Claude headers/max tokens/thinking adapter、Gemini safety/version/imagine/thinking adapter、Grok violation deduction、Channel Affinity sticky routing 规则和容量/TTL 配置；Channel Affinity 缓存清理这类运行时动作不参与导入/导出。Operations Center 的 Runtime 配置地图和命令面板已补充这些直达入口。

2026-06-07 增量：统计中心已新增管理员可见的 `Operations center`、`/dashboard/channels` 渠道分析页、`/dashboard/models` 模型运维面板和 `/dashboard/users` 用户运维面板，覆盖全站请求量、成功/失败量、错误率、首字延迟、成本、Top 风险渠道、Top 慢渠道、Top 模型、Top 消费用户，以及渠道/模型/用户维度请求、失败、成功率、首字延迟、平均用时、成本和主用渠道；Overview 趋势 payload 和图表已从单纯成功/失败线扩展为请求量、成功率、错误率、首字延迟、平均用时、成本和 token 趋势；趋势图支持 `Overview`、`Traffic`、`Reliability`、`Latency`、`Spend` 指标模式切换，单项模式会放大对应图表，并按 Overview/模型/渠道/用户页面分别记住选择；趋势图顶部新增当前窗口内的请求量、成功率、失败量、加权首字延迟、成本和 token 本地汇总，每个小图新增常驻颜色图例，空数据时显示明确空态而不是空白图表；渠道分析页已支持选择某个渠道查看该渠道下用户消费、成功率、失败率、首字延迟、平均用时和 token，并新增选中渠道的请求量、成功率、错误率、首字延迟、平均用时、成本和 token 趋势图；渠道用户消费表已支持搜索用户/ID、活跃/失败/慢首字筛选、可点击表头排序、分页和每页数量选择；模型分析页已支持选择某个模型查看请求量、成功率、错误率、首字延迟、平均用时、成本和 token 趋势图；`/dashboard/users` 主入口已切到用户运维面板，支持选择某个用户查看请求量、成功率、错误率、首字延迟、平均用时、成本和 token 趋势图，并避免非管理员直接访问时触发管理员统计请求；模型/渠道/用户明细表已增加搜索框、健康状态筛选、可点击表头排序、分页和每页数量选择，可快速只看活跃项、失败项或首字延迟偏慢项，并按请求量、成功率、失败、错误率、首字延迟、用时、tokens、成本等字段升降序定位；Overview/模型/渠道/用户统计均默认 5 秒刷新，并提供关闭开关和 5/15/30/60 秒刷新间隔选择，且各页面会通过浏览器本地存储分别记住时间范围、自动刷新开关和刷新间隔；模型表、渠道表、渠道内用户消费表和用户运维表也会分别记住搜索词、健康筛选、排序字段/方向和每页数量，并提供 `Reset view` 一键恢复默认视角，白名单外或损坏的本地存储值会回退到默认值；命令面板已补充 Overview/Model/Channel/User Analytics、Header Navigation/Docs URL、Security、Official Price Sync、Channel Test Scheduler、Claude Thinking Support 等入口，并修复旧搜索菜单和 pricing 页搜索抢占 Ctrl/Cmd+K 的快捷键冲突；统计 API 权限已收紧为管理员；后端统计查询修复了 SQLite 单连接下遍历 `Rows()` 时再发查询导致的等待/卡住风险；站点导航里的 Docs 地址已移到 `系统设置 -> 站点设置 -> Header navigation` 可直接配置，并驱动顶部导航和默认 footer 文档链接；`系统设置 -> 内容/外观` 已从浏览器本地偏好扩展为后台全局默认外观配置，可设置默认主题预设、字体、圆角、密度和内容宽度，并支持 Appearance JSON 导入/导出，用户本地 cookie 仍可覆盖全局默认。

本轮后续增量：Overview、Operations center、模型运维、渠道分析、用户运维这五个统计入口的自动刷新控件已补充手动刷新按钮、刷新中状态和上次更新时间显示；模型、渠道、用户页面的手动刷新会同时刷新当前选中的趋势/明细查询；Operations center 的 Top channel、Top model、Top spend user、风险渠道和慢首字渠道项目已支持跳转到对应分析页继续钻取，并通过 `channel_id`、`model_name`、`user_id` URL 参数让目标页自动选中对应对象；Operations center 的 `Analytics` 深链会继续携带当前 `time_range`，目标模型/渠道/用户页会消费该参数以继承 1天/7天/30天/1年/全部时间窗口，用户在目标页手动切换时间范围时会清掉 URL 参数，避免后续本地时间偏好和深链状态互相抢占；Operations center 顶部新增全局 `Usage logs` 快捷入口，Top channel / Top model / Top spend user 摘要条新增 `Analytics` 和 `Logs` 两个明确动作，`Logs` 会带入对应 `channel`、`model` 或 `username` 过滤条件并继承当前时间窗口；命令面板也补充了 `Usage Logs` 直达入口，可直接打开 `Usage Logs -> common`；用户在目标页手动切换对象时会清掉对应 URL 参数，避免深链参数持续抢回选择；模型、渠道、用户明细表行已支持鼠标点击和键盘 Enter/Space 直接切换上方选中对象与趋势图，当前选中行会高亮；模型、渠道、用户选中趋势区域已新增 `View logs` 入口，可跳转到 `Usage Logs -> common` 并自动带入 `model`、`channel` 或 `username` 过滤条件，同时继承当前统计页的 1天/7天/30天/1年/全部时间窗口；这是 Phase3 统计体验的局部补强，不代表整套后台 Phase3 已完成。

本轮模型入口增量：`系统设置 -> 模型相关` 默认页已从 `Global Model Configuration` 改为 `Model Operations` 控制中心，集中提供官方价格同步、UA 管理、Client Identity、模型统计、渠道统计、Claude thinking、全局模型行为、Channel Affinity、模型广场、渠道配置、渠道测试调度和上游错误归一化的快捷入口；控制中心已复用现有 overview stats API 增加 7 天模型健康摘要，显示请求量、成功率、首字延迟、成本，以及 Top model、Top channel、慢首字渠道的钻取入口，注意队列同时提供继承 7 天窗口的原始 `Usage Logs` 链接，默认不自动刷新也不新增后端接口；`Model Operations -> Open analytics` 和 `Dashboard -> Overview` 的管理员 `Operations center` 已补齐 `time_range` URL 参数消费逻辑，深链进入 Overview 时会应用 1天/7天/30天/1年/全部时间窗口，用户手动切换时间范围后会清掉 URL 参数；Dashboard 模型/渠道/用户分析页的顶部 tabs 已纳入 Overview，分区切换时会保留当前 `time_range`，但不会保留跨分区无意义的 `model_name`、`channel_id`、`user_id` 对象筛选；命令面板里的 `Model Settings` 也改为打开这个控制中心，并新增 `Model Operations` 命令。这是信息架构和入口可发现性的补强，不代表所有模型相关页面已经重写。

本轮 Dashboard 默认项增量：`系统设置 -> 内容/外观 -> Data Dashboard` 已补充统计默认时间范围、默认自动刷新开关、默认刷新间隔、默认表格页大小、默认健康筛选、默认趋势模式和健康判定阈值配置；健康阈值包括慢首字延迟、错误率 warning/critical、成功率 good/degraded，默认保持原行为：慢首字 3000ms、错误率 warning 0%、critical 5%、成功率 good 95%、degraded 85%；后端 option 会通过 `/api/status` 下发到前端，Dashboard 在浏览器没有保存本地偏好时使用后台默认值，用户手动切换后的本地偏好仍优先；`Reset view` 会回到后台默认视角，而不是固定写死 25 行 / all / overview，模型/渠道/用户表的慢首字筛选、成功率徽标和错误风险颜色会使用后台健康阈值；后续补充了 Data Dashboard JSON 导入/导出，导出保存当前 Dashboard 相关 option key，导入只更新当前表单，仍需管理员点 Save 才写入后台。

本轮 Dashboard 图表和分区默认项增量：`系统设置 -> 内容/外观 -> Data Dashboard` 已补充旧 Dashboard 图表默认时间窗口、消费分布图默认类型、模型分析图默认类型和 Dashboard 分区可见性配置；`DataExportDefaultTime` 继续作为默认图表粒度；这些值通过 `/api/status` 下发，旧 Dashboard 模型图表在浏览器没有保存本地偏好时使用后台默认，已有本地偏好仍优先；Dashboard tabs 会按后台可见分区显示，直达隐藏分区时会跳到第一个可见分区。

本轮运维入口增量：`系统设置` 总入口、侧边栏 `System Settings` 和个人菜单里的 `System Settings` 已默认进入 `系统设置 -> 运维/Operations -> Operations Center`，不再先落到站点信息页；该控制中心集中提供模型控制中心、UA 管理、Client Identity、官方价格、统计分析、上游错误规则、Dashboard 默认值、外观、Header navigation、渠道测试、性能设置和 Usage Logs 的快捷入口，并新增 `Configuration map`，按 Runtime / Analytics / Appearance / Safety 四组列出最短配置路径；控制中心还新增 `Defaults snapshot`，直接展示 `/api/status` 下发的 Dashboard 视图默认值、旧图表默认值、健康阈值、外观默认值和 Sidebar 分组/模块摘要，便于管理员不用点进多个页面也能扫到当前全局配置；后续快照又补充 Header navigation 模块数量/Docs URL、官方价格同步状态和上游错误规则启用数量，方便管理员从一个页面扫到导航、价格和错误安全配置是否符合预期；再后续补强了 Header navigation 顶栏模块排序，后台可以调整 Home、Console、Model Square、Rankings、Docs、About 的左右顺序，运行时顶栏按 `HeaderNavModules.order` 渲染，旧配置缺少 `order` 时自动使用默认顺序；再后续补充了 Header navigation JSON 导入/导出，导出会保存 `HeaderNavModules` 和 `docs_link`，导入只更新当前表单，仍需管理员点 Save 才写入后台；Operations Center 后续新增 `Sidebar modules` 直达卡片；命令面板新增 `Operations Center`、`Dashboard Defaults`、`Appearance`、`Header Navigation`、`Sidebar Modules`、`Performance Settings`、`Monitoring & Alerts` 等直达命令，搜索 `ua`、`client identity`、`dashboard defaults`、`sqlite`、`error rules`、`sidebar`、`json`、`import`、`export` 等关键词也能找到对应入口。这是后台信息架构和可发现性的补强，不代表所有运维页面已经重写。

本轮侧边栏模块增量：`系统设置 -> 站点设置 -> Sidebar modules` 在原有全局显示/隐藏基础上补充分组内模块排序，管理员可以用上移/下移按钮调整 Chat、Console、Personal、Admin 各分组内部模块顺序；配置仍复用 `SidebarModulesAdmin` JSON option，旧配置没有 `order` 字段时会自动按默认顺序补齐，保存后才写入扩展后的 JSON；后续又新增 `SidebarSectionOrder` option，支持调整 Chat、Console、Personal、Admin 顶层分组顺序，并通过 `/api/status` 下发给运行时侧边栏；运行时侧边栏会按后台顺序渲染，同时保留管理员全局开关和用户侧边栏偏好叠加过滤；再后续补充了 Sidebar modules JSON 导入/导出，导出会保存 `SidebarModulesAdmin` 和 `SidebarSectionOrder`，导入只更新当前表单，仍需管理员点 Save 才写入后台。这是“模块可配置”的局部补强，不代表所有页面参数都已后台化。

本轮站点信息增量：`系统设置 -> 站点设置 -> System Information` 已补充 JSON 导入/导出，覆盖系统名、服务地址、Logo、Footer、About、首页内容、用户协议和隐私政策等站点基础 option；导入支持平铺 option key、`theme` / `legal` 分组和 `SystemInformation` 包装格式，导入后只更新当前表单，仍需管理员点 Save 才写入后台。后续又把 System Information 加入 Operations Center 的二级卡片、Configuration map 和命令面板直达入口，可通过 `system information`、`site info`、`json`、`import`、`export` 等关键词找到。这是站点基础配置迁移能力和入口可发现性的补强，不代表所有站点页面已经重写。

本轮内容模块增量：`系统设置 -> 内容/外观 -> Announcements` 已补充 JSON 导入/导出，导出会保存 `console_setting.announcements_enabled` 和 `console_setting.announcements`；导入支持 `ConsoleAnnouncements` 包装格式和原 option key，导入后只更新当前页面状态，仍需管理员点 `Save Settings` 才写入后台；Operations Center 的配置地图和命令面板也新增 Announcements 入口，可通过 `announcement`、`notice`、`json`、`import`、`export` 等关键词找到。这是内容模块迁移能力的局部补强，不代表全部内容模块都已支持导入/导出。

本轮 API 地址模块增量：`系统设置 -> 内容/外观 -> API Addresses` 已补充 JSON 导入/导出，导出会保存 `console_setting.api_info_enabled` 和 `console_setting.api_info`；导入支持 `ApiAddresses` 包装格式、`apiInfo` 别名和原 option key，导入后只更新当前页面状态，仍需管理员点 `Save Settings` 才写入后台；Operations Center 的配置地图和命令面板也新增 API Addresses 入口，可通过 `api address`、`api info`、`endpoint`、`json`、`import`、`export` 等关键词找到。这是内容模块迁移能力的局部补强，不代表全部内容模块都已支持导入/导出。

本轮 FAQ 模块增量：`系统设置 -> 内容/外观 -> FAQ` 已补充 JSON 导入/导出，导出会保存 `console_setting.faq_enabled` 和 `console_setting.faq`；导入支持 `FAQ` 包装格式、`faq` 别名和原 option key，导入后只更新当前页面状态，仍需管理员点 `Save Settings` 才写入后台；Operations Center 的配置地图和命令面板也新增 FAQ 入口，可通过 `faq`、`question`、`answer`、`json`、`import`、`export` 等关键词找到。这是内容模块迁移能力的局部补强，不代表全部内容模块都已支持导入/导出。

本轮内容模块批量增量：`系统设置 -> 内容/外观 -> Uptime Kuma` 已补充状态页分组和启用状态的 JSON 导入/导出；`系统设置 -> 内容/外观 -> Chat Presets` 已补充聊天客户端预设 JSON 导入/导出；`系统设置 -> 内容/外观 -> Drawing` 已补充绘图/Midjourney 相关开关 JSON 导入/导出；Operations Center 的配置地图和命令面板也新增对应入口，可通过 `uptime`、`chat preset`、`drawing`、`midjourney`、`json`、`import`、`export` 等关键词找到。导入仍只更新当前页面状态，必须点保存才写入后台。这是内容模块迁移能力的继续补强，不代表整套后台 Phase3 已完成。

本站点公告模块增量：`系统设置 -> 站点设置 -> System Notice` 已补充 JSON 导入/导出，导出会保存 `Notice`；导入支持 `SystemNotice.notice` 包装格式和原 option key，导入后只更新当前页面状态，仍需管理员点 `Save notice` 才写入后台；Operations Center 的配置地图和命令面板也新增 System Notice 入口，可通过 `system notice`、`announcement`、`json`、`import`、`export` 等关键词找到。这是站点配置迁移能力的局部补强，不代表全部站点/后台模块都已完成。

本轮运维配置增量：`系统设置 -> 运维/Operations -> System Behavior` 已补充重试次数、默认侧边栏、演示站点和自用模式的 JSON 导入/导出；`系统设置 -> 运维/Operations -> Monitoring & Alerts` 已补充全局渠道测试、自动禁用/恢复、失败关键词、禁用/重试状态码和额度提醒的 JSON 导入/导出；`系统设置 -> 运维/Operations -> Performance` 已补充磁盘缓存、资源阈值和性能指标采集配置的 JSON 导入/导出。导入仍只更新当前页面状态，必须点保存才写入后台；性能页的清理缓存、GC、日志清理等运行操作没有被导入/导出覆盖。这是运维配置迁移能力的局部补强，不代表 Operations 分区全部完成，SMTP/Worker 这类带密钥页面仍需单独处理。

SMTP/Worker 密钥页增量：`系统设置 -> 运维/Operations -> SMTP Email` 和 `Worker Proxy` 已补充 JSON 导入/导出。导出会保留非敏感配置并将 `SMTPToken`、`WorkerValidKey` 写成 `__SECRET_REDACTED__`；导入遇到该占位符或缺失字段时保留当前页面里的密钥值，只有显式提供新密钥才会在保存时更新后台。Operations Center 配置地图和命令面板也新增 SMTP/Worker 入口。这是密钥页面迁移能力的保守实现，不把密钥明文写入导出文件。

日志维护配置增量：`系统设置 -> 运维/Operations -> Log Maintenance` 已补充 JSON 导入/导出，覆盖 `LogConsumeEnabled` 额度消费日志写入开关。导入仍只更新当前表单，必须点保存才写入后台；历史日志清理的时间选择和删除动作不参与导入/导出，避免配置迁移文件触发破坏性日志删除。Operations Center 配置地图和命令面板新增 Log Maintenance 入口，可通过 `log`、`maintenance`、`consume`、`cleanup`、`json`、`import`、`export` 等关键词找到。

模型部署配置增量：`系统设置 -> 模型相关 -> Model Deployment` 已补充 io.net 部署开关和 API key 的 JSON 导入/导出。导出会将 `apiKey` 写成 `__SECRET_REDACTED__`；导入遇到脱敏占位符、空值或缺失字段时保留当前页面里的 API key，只有显式提供新 key 才会在保存时更新后台。Operations Center 配置地图和命令面板新增 Model Deployment 入口，可通过 `model deployment`、`io.net`、`ionet`、`api key`、`json`、`import`、`export` 等关键词找到。

Auth 配置页增量：`系统设置 -> 认证/Auth -> Basic Authentication`、`OAuth Integrations`、`Passkey Authentication`、`Bot Protection` 已补充 JSON 导入/导出。OAuth 导出会将 `GitHubClientSecret`、`discord.client_secret`、`oidc.client_secret`、`TelegramBotToken`、`LinuxDOClientSecret`、`WeChatServerToken` 写成 `__SECRET_REDACTED__`；Bot Protection 导出会将 `TurnstileSecretKey` 脱敏；导入脱敏占位符时保留当前密钥，只有显式提供新值才会更新。Operations Center 配置地图和命令面板也新增 Auth 入口。

Custom OAuth 列表资源增量：`系统设置 -> 认证/Auth -> Custom OAuth` 已补充 provider 列表 JSON 导入/导出。导出会将每个 provider 的 `client_secret` 写成 `__SECRET_REDACTED__`；导入按 `slug` upsert，slug 已存在则更新该 provider 并在脱敏占位符时保留当前密钥，slug 不存在则创建新 provider；导入不会删除生产中已有但导入文件缺失的 provider，避免误删登录入口。

Request Limits 安全配置增量：`系统设置 -> 安全 -> Rate Limiting`、`Sensitive Words`、`SSRF Protection` 已补充 JSON 导入/导出。Rate Limiting 导出/导入模型请求限流开关、周期、总请求数、成功请求数和分组限流 JSON；Sensitive Words 导出/导入敏感词扫描开关、Prompt 扫描开关和敏感词列表；SSRF Protection 导出/导入 SSRF 总开关、私网 IP 放行、域名/IP 黑白名单模式、域名/IP 列表、端口列表和域名解析后 IP 过滤开关。导入仍只更新当前表单，必须点保存才写入后台；Operations Center 的 Safety 配置地图和命令面板已新增 Rate Limiting、Sensitive Words、SSRF Protection 直达入口，可通过 `rate limit`、`sensitive`、`ssrf`、`json`、`import`、`export` 等关键词找到。

Billing 配置增量：`系统设置 -> 计费/Billing -> Quota Settings`、`Currency & Display`、`Check-in Rewards`、`Payment Gateway` 已补充 JSON 导入/导出。Quota Settings 导出/导入新用户额度、预消耗额度、邀请奖励、充值链接、文档链接和免费模型预消耗开关；Currency & Display 导出/导入额度单位、美元汇率、展示币种、币种符号/自定义汇率和 token 统计开关；Check-in Rewards 导出/导入签到开关、最小/最大奖励额度；Payment Gateway 导出/导入 Epay、Stripe、Creem、Waffo 和 Waffo Pancake 的非密钥配置、Waffo 支付方式、Waffo Pancake 店铺/商品绑定。Payment Gateway 导出的 `EpayKey`、`StripeApiSecret`、`StripeWebhookSecret`、`CreemApiKey`、`CreemWebhookSecret`、`WaffoApiKey`、`WaffoPrivateKey`、`WaffoSandboxApiKey`、`WaffoSandboxPrivateKey`、`WaffoPancakePrivateKey` 默认写成 `__SECRET_REDACTED__`；导入脱敏占位符、空值或缺失密钥时保留当前页面值，只有显式提供新密钥才会在保存时更新。导入仍只更新当前表单，必须点保存才写入后台；Payment Gateway 的合规确认状态不参与导入/导出。Operations Center 新增 Billing 配置地图，命令面板新增 Quota Settings、Currency Display、Payment Gateway、Check-in Rewards 直达入口，可通过 `billing`、`quota`、`currency`、`payment`、`gateway`、`stripe`、`waffo`、`json`、`import`、`export` 等关键词找到。

## 功能入口速查

| 功能 | 后台入口 |
|---|---|
| 运维控制中心 | `系统设置` 默认入口、`系统设置 -> 运维/Operations -> Operations Center`，含配置入口地图、Dashboard/外观/System Information/侧边栏/Header navigation 顺序/官方价格/错误安全当前快照，或命令面板 `Operations Center` |
| 配置入口地图 | `Operations Center -> Configuration map`，按 Runtime / Analytics / Appearance / Safety 分组 |
| 命令面板直达 | `Operations Center`、`Dashboard Defaults`、`Appearance`、`Announcements`、`API Addresses`、`FAQ`、`Uptime Kuma`、`Chat Presets`、`Drawing`、`System Information`、`System Notice`、`Header Navigation`、`Sidebar Modules`、`Performance Settings`、`Monitoring & Alerts`、`Rate Limiting`、`Sensitive Words`、`SSRF Protection`、`Global Model Configuration`、`Claude Settings`、`Gemini Settings`、`Grok Settings`、`Channel Affinity`；支持用 `json` / `import` / `export` 搜索可迁移配置 |
| 模型控制中心 | `系统设置 -> 模型相关 -> Model Operations`，含官方价格、UA、Client Identity、模型/渠道统计、渠道测试调度、上游错误归一化等快捷入口 |
| UA 管理 | `系统设置 -> 模型相关 -> User-Agent Management` |
| 客户端标识符 | `系统设置 -> 模型相关 -> Client Identity` |
| 模型价格/官方同步 | `系统设置 -> 模型相关 -> Model Pricing -> Upstream Sync` |
| 模型价格/倍率迁移 | `系统设置 -> 模型相关 -> Model Pricing`，支持模型价格、倍率、分组倍率和工具价格 JSON 导入/导出；官方价格同步动作不参与导入/导出 |
| 模型运行配置迁移 | `系统设置 -> 模型相关 -> Global Model Configuration`、`Claude`、`Gemini`、`Grok`、`Channel Affinity`，支持 JSON 导入/导出；导入后需点保存才写入后台 |
| 上游错误归一化 | `系统设置 -> 安全 -> Upstream Error Rules` |
| 请求限制/防护 | `系统设置 -> 安全 -> Rate Limiting`、`Sensitive Words`、`SSRF Protection`，支持 JSON 导入/导出；导入后需点保存才写入后台 |
| 计费配置 | `系统设置 -> 计费/Billing -> Quota Settings`、`Currency & Display`、`Check-in Rewards`、`Payment Gateway`，支持 JSON 导入/导出；Payment Gateway 密钥默认脱敏，导入脱敏占位符时保留当前密钥；导入后需点保存才写入后台 |
| 渠道定时测试配置 | `渠道 -> 编辑渠道 -> 测试/恢复相关高级设置` |
| Claude thinking 支持开关 | `渠道 -> 编辑渠道 -> Claude thinking support` |
| 系统行为 | `系统设置 -> 运维/Operations -> System Behavior`，配置重试次数、默认侧边栏、演示站点、自用模式，并支持 JSON 导入/导出 |
| 监控与告警 | `系统设置 -> 运维/Operations -> Monitoring & Alerts`，配置全局渠道测试、自动禁用/恢复、失败关键词、禁用/重试状态码、额度提醒，并支持 JSON 导入/导出 |
| 性能设置 | `系统设置 -> 运维/Operations -> Performance`，配置磁盘缓存、资源阈值和性能指标采集，并支持 JSON 导入/导出 |
| 日志维护 | `系统设置 -> 运维/Operations -> Log Maintenance`，配置额度消费日志写入，并支持 JSON 导入/导出；历史日志清理不参与导入/导出 |
| SMTP/Worker | `系统设置 -> 运维/Operations -> SMTP Email` 与 `Worker Proxy`，配置邮件发送和 worker 转发，并支持默认脱敏的 JSON 导入/导出 |
| 模型部署 | `系统设置 -> 模型相关 -> Model Deployment`，配置 io.net 部署开关和 API key，并支持默认脱敏的 JSON 导入/导出 |
| 认证配置 | `系统设置 -> 认证/Auth -> Basic Authentication`、`OAuth Integrations`、`Passkey Authentication`、`Bot Protection`、`Custom OAuth`，支持 JSON 导入/导出；OAuth/Turnstile/Custom OAuth 密钥默认脱敏 |
| 统计看板 | `Dashboard -> Overview` 的管理员 `Operations center`；`Dashboard -> Model Call Analytics` 的管理员模型运维面板和原消费图表；`Dashboard -> Channel Analytics` 的渠道分析和渠道用户消费表；`Dashboard -> User Analytics` 的用户运维面板和消费图表 |
| 统计默认视图 | `系统设置 -> 内容/外观 -> Data Dashboard`，可配置默认时间范围、自动刷新、刷新间隔、表格页大小、健康筛选、趋势模式、Dashboard 分区可见性、旧图表默认项和健康判定阈值，并支持 JSON 导入/导出 |
| 控制台公告 | `系统设置 -> 内容/外观 -> Announcements`，配置公告列表和启用状态，并支持 JSON 导入/导出 |
| API 地址展示 | `系统设置 -> 内容/外观 -> API Addresses`，配置控制台 API 地址卡片和启用状态，并支持 JSON 导入/导出 |
| FAQ | `系统设置 -> 内容/外观 -> FAQ`，配置常见问题列表和启用状态，并支持 JSON 导入/导出 |
| Uptime Kuma | `系统设置 -> 内容/外观 -> Uptime Kuma`，配置状态页分组和启用状态，并支持 JSON 导入/导出 |
| Chat Presets | `系统设置 -> 内容/外观 -> Chat Presets`，配置聊天客户端预设，并支持 JSON 导入/导出 |
| Drawing | `系统设置 -> 内容/外观 -> Drawing`，配置绘图/Midjourney 相关开关，并支持 JSON 导入/导出 |
| 原始调用日志 | 统计页 `Logs` / `View logs` 动作，或命令面板 `Usage Logs`，进入 `Usage Logs -> common` |
| 主题/外观 | `系统设置 -> 内容/外观 -> Appearance` 配置全局默认主题/字体/圆角/密度/内容宽度/强调色，并支持 JSON 导入/导出；顶部主题切换保存用户本地偏好 |
| 站点基础信息 | `系统设置 -> 站点设置 -> System Information`，配置系统名、服务地址、Logo、Footer、About、首页内容、用户协议和隐私政策，并支持 JSON 导入/导出 |
| 系统公告 | `系统设置 -> 站点设置 -> System Notice`，配置站点全局公告，并支持 JSON 导入/导出 |
| 顶部导航与页脚文档地址 | `系统设置 -> 站点设置 -> Header navigation`，可配置顶部模块开关、模型广场/排行榜登录要求、顶栏模块顺序、Documentation URL，并支持 JSON 导入/导出 |
| 侧边栏模块 | `系统设置 -> 站点设置 -> Sidebar modules`，可配置全局显示/隐藏、顶层分组排序、分组内模块排序，并支持 JSON 导入/导出 |

## 逐项验收

| # | 需求 | 当前状态 | 证据 | 边界/注意 |
|---|---|---|---|---|
| 1 | 后台 UA 管理；渠道单独设置优先于模型大类全局；支持导入/导出、排序、默认 UA | 已实现 | `controller/user_agent.go`、`model/user_agent*.go`、`relay/channel/api_request.go`、`web/default/src/features/system-settings/models/user-agent-settings-section.tsx`、`TestInitUserAgentCacheRefreshesImmediately` | 大类固定为 `openai`、`claude`、`grok`、`gemini`、`other`；模型名规则自动识别 |
| 2 | 官方价格同步，只要官方，不要转售/聚合商模型；关闭其他上游同步 | 已实现为 official-only `models.dev` | `controller/official_price_sync.go`、`controller/ratio_sync.go`、`pkg/compat/pricesync/fetcher.go`、`official-price-sync-panel.tsx`、`TestOfficial*` / `TestConvertModelsDev*` | 自动同步默认关闭；需要自动任务必须显式设置 `OFFICIAL_PRICE_SYNC_ENABLED=true`。不是逐个官网抓取，依赖 `models.dev` 官方 provider 元数据 |
| 3 | 上游错误防投毒：客户端隐藏，后台日志保留但脱敏；只做错误归一化，不扫正常输出 | 已实现 | `pkg/compat/errornorm/*`、`web/default/src/features/system-settings/security/upstream-error-rules-section.tsx`、`TestApplyRule_NeverPassesThroughUpstreamBody` | 不扫描正常模型输出；`passthrough_body` / `skip_monitoring` 已被后端强制关闭 |
| 4 | 定期渠道测试：每渠道时间、尝试次数、失败禁用阈值、测试时间段和跨天窗口 | 已实现 | `controller/channel_test_scheduler.go`、`dto/channel_settings.go`、渠道编辑 drawer、`TestGetEffectiveTestConfigUsesChannelIntervalMinutes`、`TestIsClockInTestWindowSupportsCrossDayWindow` | `auto_test_interval` 语义是分钟 |
| 5 | 数据库卡顿评估，考虑是否 SQLite 换高性能数据库 | 已做镜像级 SQLite 调优，未迁库 | `pkg/compat/sqlite/tune.go`、`model/main.go` | 当前补丁不强制迁 MySQL。Ken 当前小并发下优先 WAL + busy_timeout + 保守连接池；日志量显著上升后再迁 MySQL |
| 6 | Claude thinking sanitizer：支持渠道保持 thinking/signature，不支持渠道清洗；带 thinking sticky 到支持渠道 | 已实现 | `service/claude_thinking_compat.go`、`controller/relay.go`、`service/channel_select.go`、渠道 `supports_claude_thinking` 三态 UI、`TestSanitizeClaudeThinking*`、`TestChannelSupportsClaudeThinking*` | 没有兼容渠道时才清洗后 fallback |
| 7 | 渠道 75 Claude 400 问题 | 按 Ken 最新要求保持现状，暂不作为后续任务 | 相关通用补强同 #3 / #6 | 不再作为发布阻塞项；除非 Ken 重新要求，不继续跟进渠道 75 |
| 8 | 渠道 77 / Codex UA 与请求体标识符问题 | UA 管理和 Client Identity 已覆盖；生产已有成功日志 | `service/client_identity.go`、`relay/channel/api_request.go`、`client-identity-settings-card.tsx`、`TestApplyClientIdentity*`；2026-06-07 生产日志显示 `gpt-5.5` 流式请求走 `use_channel=["77"]` 成功，且 `client identity applied: provider=codex mode=force_global` | 这证明本轮部署后渠道 77 已能跑通；后续仍建议观察长时间真实流量 |
| 9 | 所有设备标识符固定，支持定期轮换；Codex/Claude/其他厂商可配置字段 | 已实现 | `model/client_identity.go`、`service/client_identity*.go`、`controller/client_identity.go`、`client-identity-settings-card.tsx` | 当前策略为强制替换，不保留客户端原值 |
| 10 | 后台重设计：Vercel/Stripe/Datadog/Linear/Raycast 风格，Phase3 一次性全部 | 未完整实现；统计中心和可配置项继续增强 | `web/default/src/features/dashboard/index.tsx`、`web/default/src/features/dashboard/components/overview/operations-insights-panel.tsx`、`web/default/src/features/dashboard/overview-dashboard.tsx`、`web/default/src/features/dashboard/model-analytics-dashboard.tsx`、`web/default/src/features/dashboard/components/channels/channel-analytics-dashboard.tsx`、`web/default/src/features/dashboard/components/users/user-operations-panel.tsx`、`web/default/src/features/dashboard/trend-chart.tsx`、`web/default/src/features/dashboard/stats-api.ts`、`web/default/src/features/dashboard/use-dashboard-controls.ts`、`controller/stats.go`、`model/stats.go`、`router/api-router.go`、`web/default/src/features/system-settings/operations/operations-center.tsx`、`web/default/src/features/system-settings/operations/section-registry.tsx`、`web/default/src/features/system-settings/models/model-operations-overview.tsx`、`web/default/src/features/system-settings/models/section-registry.tsx`、`web/default/src/features/system-settings/content/dashboard-section.tsx`、`web/default/src/features/system-settings/maintenance/sidebar-modules-section.tsx`、`web/default/src/features/system-settings/maintenance/config.ts`、`web/default/src/lib/dashboard-defaults.ts`、`web/default/src/components/layout/components/command-palette.tsx`、`web/default/src/context/search-provider.tsx`、`web/default/src/features/pricing/components/search-bar.tsx`、`web/default/src/features/system-settings/maintenance/header-navigation-section.tsx`、`web/default/src/features/system-settings/content/appearance-settings.tsx`、dashboard/theme/command-palette 相关前端文件 | 不能宣传为 Phase3 完成。已做主题、命令面板、统计页、局部导航整理、运维控制中心、系统设置总入口落到运维控制中心、运维配置入口地图和当前默认值快照、模型相关默认控制中心、模型控制中心 7 天健康摘要和注意队列原始日志入口、模型控制中心集中渠道测试调度和上游错误归一化入口、Overview/Operations center 时间范围深链消费、Dashboard 分区 tabs 纳入 Overview 且切换保留时间窗口、管理员 Operations center、Operations center 全局和 Top 对象原始日志入口、模型运维面板、选中模型多指标趋势图、渠道分析页、渠道用户消费表搜索/健康筛选/排序/分页、选中渠道多指标趋势图、用户运维面板主入口、选中用户多指标趋势图、模型/渠道/用户明细表搜索、健康筛选、表头排序和分页、选中行高亮并可键盘切换趋势对象、选中模型/渠道/用户一键跳到 Usage Logs 过滤原始日志且继承统计时间窗口、用户页管理员守卫、Overview 多指标趋势图、趋势图指标模式切换和页面级记忆、趋势图窗口汇总、常驻图例和空态、统计默认 5 秒刷新开关和可选刷新间隔、各统计页分别记住时间范围/自动刷新/刷新间隔、后台可配置 Dashboard 默认时间范围/自动刷新/刷新间隔/表格页大小/健康筛选/趋势模式/Dashboard 分区可见性/旧图表默认项/健康判定阈值并支持 JSON 导入/导出、模型/渠道/渠道用户/用户表格分别记住搜索/筛选/排序/每页数量并支持 Reset view、命令面板补充关键改造入口和 `json/import/export` 可迁移配置搜索词、运维直达命令并统一 Ctrl/Cmd+K、Operations Center 新增 Sidebar modules 直达卡片、Docs 地址后台可配置、侧边栏模块全局显示/隐藏、顶层分组排序和分组内排序、后台全局默认外观配置并支持 JSON 导入/导出，但不是全后台重写 |
| 16 | 每个模块尽量能后台配置，尤其配色、字体、内容宽度等外观项 | 部分实现 | `setting/system_setting/theme.go`、`controller/misc.go`、`controller/option.go`、`theme-customization-provider.tsx`、`appearance-settings.tsx`、`system-info-section.tsx`、`system-config-store.ts`、`dashboard-section.tsx`、`sidebar-modules-section.tsx`、`use-sidebar-config.ts` | 后台全局默认值只在用户没有本地偏好 cookie 时生效；顶部主题切换仍作为个人偏好入口。System Information、Appearance、Data Dashboard 默认项、侧边栏模块和 Header navigation 支持 JSON 导入/导出；侧边栏模块支持全局显示/隐藏、顶层分组排序、分组内排序；尚未做到“每个模块的所有参数均后台可配置” |
| 15 | 顶栏文档地址等站点参数不应只能改代码或放错模块 | 已补强 | `controller/misc.go`、`use-top-nav-links.ts`、`footer.tsx`、`header-navigation-section.tsx`、`web/default/src/lib/nav-modules.ts`、`web/default/src/features/system-settings/maintenance/config.ts`、`use-update-option.ts` | `general_setting.docs_link` 保留原 option key；`HeaderNavModules` 兼容旧 JSON 并新增 `order` 字段用于顶栏模块排序；Header navigation 支持 JSON 导入/导出；旧计费/额度入口仍可兼容，新增入口更符合站点导航语义 |
| 11 | 首页美化变体保留 “One endpoint. Every model.” | 已实现并生产验证 | `web/default/src/features/home/components/sections/iz-hero.tsx`、`newapi-runtime-compat-with-homepage.patch`；2026-06-07 用本机 Chrome/Playwright CLI 截取 `https://router.108848.xyz:1443/` 首屏，确认显示 “One endpoint. Every model.” | runtime-only patch 不包含首页改动；截图验证文件在本机 `D:\Code\newapi\homepage-check.png`，不作为 release 资产提交 |
| 12 | 镜像运行别再踩非 root 导致 `failed to open log file` | 已写入 README/skill | README 生产部署章节、`newapi-compat-handoff` skill | 生产 compose 必须保留 `user: "0:0"`，除非先修挂载目录权限 |
| 13 | Release 资产命名必须和 README/部署命令一致 | 已修 | `.github/workflows/build-release.yml` | 首页 tar 统一为 `newapi-runtime-compat-homepage-docker-image-<tag>.tar.gz` |
| 14 | 模型相关入口集中到模型模块 | 已增强 | `web/default/src/features/system-settings/models/section-registry.tsx`、command palette、渠道测试/playground 错误跳转 | 旧 `billing/model-pricing` 注册暂保留用于兼容老入口 |

## 不应再使用的宣传口径

- 不要写“所有新增兼容逻辑都集中在 `pkg/compat/**`”。
- 不要写“Step 3 已完成叠加式架构全量迁移”。
- 不要写“完整 Phase3 后台重设计已完成”。
- 不要写“完整 metrics/可观测系统已完成”。
- 不要写未验证的镜像体积，例如“7MB 镜像”。
- 不要写“官方价格同步覆盖所有官网实时价格”。准确说法是：以 `models.dev` 为官方 provider 元数据源，过滤转售/聚合商别名。

## Release 前必须验证

```powershell
$patchRepo='D:\Code\newapi\newapi-compat-image'
$base='0e2cbdb6ff545c33103b9ce1fb633cbcb365f955'

go test ./pkg/compat/errornorm ./pkg/compat/pricesync ./service ./model ./controller ./router ./relay/channel -run 'TestApplyClientIdentity|TestClientIdentity|TestNormalize|TestError|TestStats|TestOfficial|TestConvertModelsDev|TestUserAgent|TestInitUserAgentCache|TestClaudeRequestHasThinking|TestClaudeThinking|TestSanitizeClaudeThinking|TestChannelSupportsClaudeThinking|TestGetEffectiveTestConfig|TestIsClockInTestWindow|TestApplyRule|TestApplyDefaultUpstreamUserAgent|TestApplyManagedUpstreamUserAgent'

go test ./model -run 'TestGetModelStatsIncludesAverageFirstToken|TestGetOverviewStatsIncludesOperationalSignals' -count=1 -timeout 60s

cd D:\Code\newapi\_rc10_core_work\web\default
npm run typecheck
npm run build
```

还必须在干净 upstream base 上执行：

```powershell
git apply --check D:\Code\newapi\newapi-compat-image\newapi-runtime-compat.patch
git apply --check D:\Code\newapi\newapi-compat-image\newapi-runtime-compat-with-homepage.patch
```

并确认 patch 不包含：

- `web/default/dist/**`
- `web/default/node_modules/**`
- `web/default/package-lock.json`
- `newapi.exe`

## 生产验证项

2026-06-08 管理后台配置迁移批次部署验证：

- Patch repo commit `82af9f9` (`Complete admin config migration batch`) built successfully by Actions run `27112466557`.
- Production homepage image tag `ghcr.io/alex-ai-dev-lab/newapi-runtime-compat-homepage:v1.0.0-rc.10` was redeployed from release asset `newapi-runtime-compat-homepage-docker-image-v1.0.0-rc.10.tar.gz`; loaded container image ID is `sha256:1deea03f3c49d9c47f617f937b2902d281ffac36e4129974daae6908c2c00207`.
- Previous production image was backed up on the server as `ghcr.io/alex-ai-dev-lab/newapi-runtime-compat-homepage:v1.0.0-rc.10-backup-20260608-104613`.
- Compose still has `user: "0:0"` and container `ConfigUser=0:0`.
- Public checks returned HTTP 200 for `/api/status`, `/system-settings`, `/system-settings/operations/overview`, `/system-settings/content/appearance`, `/system-settings/models/model-pricing`, `/system-settings/models/global`, `/system-settings/models/claude`, `/system-settings/models/gemini`, `/system-settings/models/grok`, `/system-settings/models/channel-affinity`, `/system-settings/billing/payment`, `/system-settings/operations/logs`, `/system-settings/models/model-deployment`, `/system-settings/models/user-agents`, and `/system-settings/models/client-identity`.
- `/api/status` exposes `theme_customization` with `custom_accent_enabled=false` and `custom_accent_color=#2563eb`, plus Dashboard defaults `dashboard_default_time_range=7d`, `dashboard_auto_refresh=true`, `dashboard_refresh_interval=5`.
- SQLite quick pragma check: `journal_mode=wal`, `busy_timeout=5000`, `synchronous=2`, `wal_autocheckpoint=1000`.
- Recent 10-minute log keyword scan showed `0` matches for `sql busy`, `database is locked`, `database is closed`, `failed to open log file`, `panic`, or `fatal`.
- Recent production logs after deploy include successful `gpt-5.5` streaming traffic and `client identity applied: provider=codex mode=force_global`. These logs did not show a channel 77 live request in the checked window, so channel 77 is not claimed as newly live-tested by this deployment.

以下项目只有部署后才能宣称修复完成；2026-06-07 已补充部分生产证据：

- 渠道 77：已看到生产 `gpt-5.5` 流式请求走 `use_channel=["77"]` 成功，最近日志未再出现 `codex_access_restricted`。
- UA/Client Identity：已看到生产日志 `client identity applied: provider=codex mode=force_global`，证明 NewAPI 内部强制标识符逻辑触发；UA 仍可继续通过上游抓包做更强验证。
- SQLite：部署后最近 20 分钟日志未见 `sql busy`、`database is locked`、`database is closed`；SQLite pragma 为 `journal_mode=wal`、`busy_timeout=5000`。
- 首页 variant：已用 Chrome/Playwright CLI 生产截图验证 “One endpoint. Every model.” 首屏存在。
