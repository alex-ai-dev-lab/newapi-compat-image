/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  BadgeDollarSign,
  BellRing,
  FileText,
  Fingerprint,
  Gauge,
  Globe,
  LayoutDashboard,
  ListChecks,
  Palette,
  RadioTower,
  Search,
  ShieldAlert,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getOfficialPriceSyncStatus } from '../api'
import {
  getSystemSettingsAreaOrder,
  getSystemSettingsSectionOrder,
  normalizeHeaderNavOrder,
  parseHeaderNavModules,
  parseSystemSettingsNavigation,
} from '../maintenance/config'
import type { OfficialPriceSyncStatus } from '../types'

type OperationsCenterProps = {
  currentVersion?: string | null
  startTime?: number | null
}

type ActionLink =
  | {
      kind: 'system-settings'
      area:
        | 'models'
        | 'security'
        | 'content'
        | 'site'
        | 'operations'
        | 'auth'
        | 'billing'
      section: string
    }
  | {
      kind: 'dashboard'
      section: 'overview' | 'models' | 'channels' | 'users'
    }
  | {
      kind: 'usage-logs'
    }
  | {
      kind: 'plain'
      to: '/channels' | '/models'
    }

type OperationsAction = {
  title: string
  description: string
  icon: LucideIcon
  status: string
  cta: string
  link: ActionLink
}

type ConfigMapGroup = {
  title: string
  description: string
  icon: LucideIcon
  items: Array<{
    label: string
    link: ActionLink
  }>
}

type ErrorRule = {
  id: number
  enabled: boolean
}

async function listErrorRules() {
  const res = await api.get<{ success: boolean; data: ErrorRule[] }>(
    '/api/compat/error-rules'
  )
  return res.data.data ?? []
}

const PRIMARY_ACTIONS: OperationsAction[] = [
  {
    title: '模型运维中心',
    description:
      '集中查看定价、User-Agent、客户端标识、Claude thinking、模型路由与模型健康状态。',
    icon: LayoutDashboard,
    status: '模型控制',
    cta: '打开中心',
    link: { kind: 'system-settings', area: 'models', section: 'overview' },
  },
  {
    title: 'User-Agent 管理',
    description:
      '管理默认、模型类别、指定配置和单渠道 User-Agent 规则，无需改渠道代码。',
    icon: Globe,
    status: '热路径',
    cta: '管理 UA',
    link: { kind: 'system-settings', area: 'models', section: 'user-agents' },
  },
  {
    title: '客户端标识',
    description:
      '强制写入 Codex、Claude 和自定义服务商标识，支持轮换与 JSON 迁移。',
    icon: Fingerprint,
    status: '强制标识',
    cta: '管理标识',
    link: {
      kind: 'system-settings',
      area: 'models',
      section: 'client-identity',
    },
  },
  {
    title: '官方价格同步',
    description:
      '从 models.dev 同步官方价格，并过滤转售商和聚合商别名。',
    icon: BadgeDollarSign,
    status: '仅官方',
    cta: '打开定价',
    link: { kind: 'system-settings', area: 'models', section: 'model-pricing' },
  },
  {
    title: '运维数据分析',
    description:
      '查看模型和渠道维度的请求量、成功率、首 token 延迟、成本和风险信号。',
    icon: Activity,
    status: '管理员统计',
    cta: '打开分析',
    link: { kind: 'dashboard', section: 'overview' },
  },
  {
    title: '上游错误规则',
    description:
      '规范化不安全的上游错误响应，日志保留脱敏预览，并支持规则导入/导出。',
    icon: ShieldAlert,
    status: '防污染',
    cta: '打开规则',
    link: {
      kind: 'system-settings',
      area: 'security',
      section: 'upstream-error-rules',
    },
  },
]

const SECONDARY_ACTIONS: OperationsAction[] = [
  {
    title: '数据看板默认值',
    description:
      '设置数据看板默认视图，并通过 JSON 导入/导出迁移默认配置。',
    icon: Gauge,
    status: '全局默认',
    cta: '配置',
    link: { kind: 'system-settings', area: 'content', section: 'dashboard' },
  },
  {
    title: '外观设置',
    description:
      '调整并迁移全局主题、字体、圆角、密度、内容宽度、强调色和界面调色板。',
    icon: Palette,
    status: '视觉系统',
    cta: '打开外观',
    link: { kind: 'system-settings', area: 'content', section: 'appearance' },
  },
  {
    title: '系统信息',
    description:
      '编辑并导入/导出站点标识、首页内容、用户协议与隐私政策文案。',
    icon: FileText,
    status: '站点标识',
    cta: '编辑站点',
    link: {
      kind: 'system-settings',
      area: 'site',
      section: 'system-info',
    },
  },
  {
    title: '顶部导航',
    description:
      '编辑并导入/导出顶部导航模块和文档地址。',
    icon: ListChecks,
    status: '导航',
    cta: '编辑导航',
    link: {
      kind: 'system-settings',
      area: 'site',
      section: 'header-navigation',
    },
  },
  {
    title: '侧边栏模块',
    description:
      '控制侧边栏显示与排序，并将布局作为 JSON 导入/导出。',
    icon: LayoutDashboard,
    status: '导航',
    cta: '编辑侧边栏',
    link: {
      kind: 'system-settings',
      area: 'site',
      section: 'sidebar-modules',
    },
  },
  {
    title: '系统设置导航',
    description:
      '控制系统设置区域/分区的显示与排序，并支持 JSON 迁移。',
    icon: ListChecks,
    status: '导航',
    cta: '编辑设置导航',
    link: {
      kind: 'system-settings',
      area: 'site',
      section: 'settings-navigation',
    },
  },
  {
    title: '渠道测试调度',
    description:
      '定位需要自定义测试间隔、重试次数、禁用阈值和跨日窗口的渠道。',
    icon: Timer,
    status: '恢复',
    cta: '打开渠道',
    link: { kind: 'plain', to: '/channels' },
  },
  {
    title: '性能设置',
    description:
      '查看、调优并迁移缓存、监控阈值与后端压力保护配置。',
    icon: ShieldCheck,
    status: '运行时',
    cta: '调优运行时',
    link: {
      kind: 'system-settings',
      area: 'operations',
      section: 'performance',
    },
  },
  {
    title: '请求日志',
    description:
      '从分析卡片跳转到原始请求日志，追踪具体请求链路。',
    icon: FileText,
    status: '下钻',
    cta: '打开日志',
    link: { kind: 'usage-logs' },
  },
]

const QUICK_FILTERS: OperationsAction[] = [
  {
    title: '渠道分析',
    description:
      '查看渠道可靠性、首 token 延迟、消费、用户构成和趋势窗口。',
    icon: RadioTower,
    status: '渠道',
    cta: '查看渠道',
    link: { kind: 'dashboard', section: 'channels' },
  },
  {
    title: '模型分析',
    description:
      '查看模型成功率、成本、token 用量、首 token 延迟和单模型趋势。',
    icon: Search,
    status: '模型',
    cta: '查看模型',
    link: { kind: 'dashboard', section: 'models' },
  },
  {
    title: '监控告警',
    description:
      '管理自动禁用/恢复、重试状态码、额度提醒、全局渠道测试和 JSON 迁移。',
    icon: BellRing,
    status: '告警',
    cta: '打开监控',
    link: {
      kind: 'system-settings',
      area: 'operations',
      section: 'monitoring',
    },
  },
]

const CONFIG_MAP_GROUPS: ConfigMapGroup[] = [
  {
    title: '运行时',
    description:
      '请求兼容、客户端标识、上游路由、模型配置 JSON 迁移和渠道测试。',
    icon: ShieldCheck,
    items: [
      {
        label: 'User-Agent 配置',
        link: {
          kind: 'system-settings',
          area: 'models',
          section: 'user-agents',
        },
      },
      {
        label: '客户端标识',
        link: {
          kind: 'system-settings',
          area: 'models',
          section: 'client-identity',
        },
      },
      {
        label: '全局模型配置',
        link: {
          kind: 'system-settings',
          area: 'models',
          section: 'global',
        },
      },
      {
        label: 'Claude 设置',
        link: {
          kind: 'system-settings',
          area: 'models',
          section: 'claude',
        },
      },
      {
        label: 'Gemini 设置',
        link: {
          kind: 'system-settings',
          area: 'models',
          section: 'gemini',
        },
      },
      {
        label: 'Grok 设置',
        link: {
          kind: 'system-settings',
          area: 'models',
          section: 'grok',
        },
      },
      {
        label: '渠道亲和',
        link: {
          kind: 'system-settings',
          area: 'models',
          section: 'channel-affinity',
        },
      },
      {
        label: '模型部署',
        link: {
          kind: 'system-settings',
          area: 'models',
          section: 'model-deployment',
        },
      },
      { label: '渠道测试', link: { kind: 'plain', to: '/channels' } },
    ],
  },
  {
    title: '分析',
    description: '运维统计、请求日志、默认视图和趋势分析。',
    icon: Activity,
    items: [
      {
        label: '运维总览',
        link: { kind: 'dashboard', section: 'overview' },
      },
      {
        label: '数据看板默认值',
        link: {
          kind: 'system-settings',
          area: 'content',
          section: 'dashboard',
        },
      },
      {
        label: '日志维护',
        link: {
          kind: 'system-settings',
          area: 'operations',
          section: 'logs',
        },
      },
      { label: '请求日志', link: { kind: 'usage-logs' } },
    ],
  },
  {
    title: '外观',
    description:
      '内容模块、导航、主题默认值、布局和可见模块。',
    icon: Palette,
    items: [
      {
        label: '外观默认值',
        link: {
          kind: 'system-settings',
          area: 'content',
          section: 'appearance',
        },
      },
      {
        label: '公告',
        link: {
          kind: 'system-settings',
          area: 'content',
          section: 'announcements',
        },
      },
      {
        label: 'API 地址',
        link: {
          kind: 'system-settings',
          area: 'content',
          section: 'api-info',
        },
      },
      {
        label: 'FAQ',
        link: {
          kind: 'system-settings',
          area: 'content',
          section: 'faq',
        },
      },
      {
        label: 'Uptime Kuma',
        link: {
          kind: 'system-settings',
          area: 'content',
          section: 'uptime-kuma',
        },
      },
      {
        label: '聊天预设',
        link: {
          kind: 'system-settings',
          area: 'content',
          section: 'chat',
        },
      },
      {
        label: '绘图',
        link: {
          kind: 'system-settings',
          area: 'content',
          section: 'drawing',
        },
      },
      {
        label: '系统信息',
        link: {
          kind: 'system-settings',
          area: 'site',
          section: 'system-info',
        },
      },
      {
        label: '系统公告',
        link: {
          kind: 'system-settings',
          area: 'site',
          section: 'notice',
        },
      },
      {
        label: '顶部导航',
        link: {
          kind: 'system-settings',
          area: 'site',
          section: 'header-navigation',
        },
      },
      {
        label: '侧边栏模块',
        link: {
          kind: 'system-settings',
          area: 'site',
          section: 'sidebar-modules',
        },
      },
      {
        label: '系统设置导航',
        link: {
          kind: 'system-settings',
          area: 'site',
          section: 'settings-navigation',
        },
      },
    ],
  },
  {
    title: '计费',
    description:
      '额度、货币显示、支付网关脱敏 JSON 迁移、签到奖励和倍率配置。',
    icon: BadgeDollarSign,
    items: [
      {
        label: '额度设置',
        link: {
          kind: 'system-settings',
          area: 'billing',
          section: 'quota',
        },
      },
      {
        label: '货币显示',
        link: {
          kind: 'system-settings',
          area: 'billing',
          section: 'currency',
        },
      },
      {
        label: '支付网关',
        link: {
          kind: 'system-settings',
          area: 'billing',
          section: 'payment',
        },
      },
      {
        label: '签到奖励',
        link: {
          kind: 'system-settings',
          area: 'billing',
          section: 'checkin',
        },
      },
      {
        label: '模型定价',
        link: {
          kind: 'system-settings',
          area: 'billing',
          section: 'model-pricing',
        },
      },
      {
        label: '分组定价',
        link: {
          kind: 'system-settings',
          area: 'billing',
          section: 'group-pricing',
        },
      },
    ],
  },
  {
    title: '安全',
    description:
      '面向客户端的安全错误、保护规则、监控告警和压力保护。',
    icon: ShieldAlert,
    items: [
      {
        label: '上游错误规则',
        link: {
          kind: 'system-settings',
          area: 'security',
          section: 'upstream-error-rules',
        },
      },
      {
        label: '速率限制',
        link: {
          kind: 'system-settings',
          area: 'security',
          section: 'rate-limit',
        },
      },
      {
        label: '敏感词',
        link: {
          kind: 'system-settings',
          area: 'security',
          section: 'sensitive-words',
        },
      },
      {
        label: 'SSRF 防护',
        link: {
          kind: 'system-settings',
          area: 'security',
          section: 'ssrf',
        },
      },
      {
        label: '基础认证',
        link: {
          kind: 'system-settings',
          area: 'auth',
          section: 'basic-auth',
        },
      },
      {
        label: 'OAuth 集成',
        link: {
          kind: 'system-settings',
          area: 'auth',
          section: 'oauth',
        },
      },
      {
        label: 'Passkey 认证',
        link: {
          kind: 'system-settings',
          area: 'auth',
          section: 'passkey',
        },
      },
      {
        label: '机器人防护',
        link: {
          kind: 'system-settings',
          area: 'auth',
          section: 'bot-protection',
        },
      },
      {
        label: '自定义 OAuth',
        link: {
          kind: 'system-settings',
          area: 'auth',
          section: 'custom-oauth',
        },
      },
      {
        label: '监控告警',
        link: {
          kind: 'system-settings',
          area: 'operations',
          section: 'monitoring',
        },
      },
      {
        label: 'SMTP 邮件',
        link: {
          kind: 'system-settings',
          area: 'operations',
          section: 'email',
        },
      },
      {
        label: 'Worker 代理',
        link: {
          kind: 'system-settings',
          area: 'operations',
          section: 'worker',
        },
      },
      {
        label: '性能设置',
        link: {
          kind: 'system-settings',
          area: 'operations',
          section: 'performance',
        },
      },
    ],
  },
]

export function OperationsCenter(props: OperationsCenterProps) {
  const dashboardDefaults = useSystemConfigStore(
    (state) => state.config.dashboardDefaults
  )
  const themeCustomization = useSystemConfigStore(
    (state) => state.config.themeCustomization
  )
  const { status } = useStatus()
  const { data: priceSyncResponse } = useQuery({
    queryKey: ['official-price-sync-status'],
    queryFn: getOfficialPriceSyncStatus,
  })
  const { data: errorRules = [] } = useQuery({
    queryKey: ['upstream-error-rules'],
    queryFn: listErrorRules,
  })

  return (
    <section className='space-y-4'>
      <div className='bg-card rounded-lg border px-4 py-4'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
          <div className='max-w-3xl space-y-1'>
            <p className='text-sm font-medium'>运维中心</p>
            <p className='text-muted-foreground text-sm'>
              集中管理自定义兼容能力、数据分析工作区、运行时保护和管理员外观默认值。
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='secondary'>
              {props.currentVersion
                ? `NewAPI ${props.currentVersion}`
                : 'NewAPI'}
            </Badge>
            <Badge variant='secondary'>{formatUptime(props.startTime)}</Badge>
          </div>
        </div>
      </div>

      <ConfigMap />

      <DefaultsSnapshot
        dashboardDefaults={dashboardDefaults}
        themeCustomization={themeCustomization}
        sidebarSectionOrder={
          status?.SidebarSectionOrder as string | null | undefined
        }
        sidebarModulesAdmin={
          status?.SidebarModulesAdmin as string | null | undefined
        }
        headerNavModules={status?.HeaderNavModules as string | null | undefined}
        systemSettingsNavigation={
          status?.SystemSettingsNavigation as string | null | undefined
        }
        docsLink={status?.docs_link as string | null | undefined}
        priceSyncStatus={priceSyncResponse?.data}
        errorRules={errorRules}
      />

      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        {PRIMARY_ACTIONS.map((action) => (
          <OperationsActionCard key={action.title} action={action} />
        ))}
      </div>

      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        {SECONDARY_ACTIONS.map((action) => (
          <OperationsActionCard key={action.title} action={action} compact />
        ))}
      </div>

      <div className='grid gap-3 lg:grid-cols-3'>
        {QUICK_FILTERS.map((action) => (
          <OperationsActionCard key={action.title} action={action} compact />
        ))}
      </div>
    </section>
  )
}

function DefaultsSnapshot(props: {
  dashboardDefaults: ReturnType<
    typeof useSystemConfigStore.getState
  >['config']['dashboardDefaults']
  themeCustomization: ReturnType<
    typeof useSystemConfigStore.getState
  >['config']['themeCustomization']
  sidebarSectionOrder?: string | null
  sidebarModulesAdmin?: string | null
  headerNavModules?: string | null
  systemSettingsNavigation?: string | null
  docsLink?: string | null
  priceSyncStatus?: OfficialPriceSyncStatus
  errorRules: ErrorRule[]
}) {
  const dashboard = props.dashboardDefaults
  const theme = props.themeCustomization
  const sidebarSummary = getSidebarSummary(
    props.sidebarSectionOrder,
    props.sidebarModulesAdmin
  )
  const headerSummary = getHeaderNavSummary(
    props.headerNavModules,
    props.docsLink
  )
  const systemSettingsSummary = getSystemSettingsNavigationSummary(
    props.systemSettingsNavigation
  )
  const priceSummary = getPriceSyncSummary(props.priceSyncStatus)
  const errorRuleSummary = getErrorRuleSummary(props.errorRules)
  const items = [
    {
      label: '数据看板视图',
      value: `${formatTimeRange(dashboard.timeRange)} · ${dashboard.autoRefresh ? '自动刷新' : '手动刷新'} · ${dashboard.refreshInterval / 1000}s`,
      detail: `${dashboard.pageSize} 行 · ${formatHealthFilter(dashboard.healthFilter)} · ${formatTrendMode(dashboard.trendMode)} · ${dashboard.visibleSections.join('/')}`,
    },
    {
      label: '传统图表',
      value: `${dashboard.chartTimeRangeDays}d · ${dashboard.chartTimeGranularity}`,
      detail: `${dashboard.consumptionChart} 消费图 · ${dashboard.modelAnalyticsChart} 模型图`,
    },
    {
      label: '健康阈值',
      value: `首 token ${dashboard.slowFirstTokenThresholdMs}ms`,
      detail: `错误率 ${dashboard.errorRateWarningThreshold}/${dashboard.errorRateCriticalThreshold}% · 成功率 ${dashboard.successRateDegradedThreshold}/${dashboard.successRateGoodThreshold}%`,
    },
    {
      label: '外观',
      value: `${theme.preset} · ${theme.font}`,
      detail: `${theme.radius} 圆角 · ${theme.scale} 密度 · ${theme.contentLayout} 布局 · 强调色 ${
        theme.customAccentEnabled ? theme.customAccentColor : '默认'
      } · 调色板 ${theme.customPaletteEnabled ? '自定义' : '默认'}`,
    },
    {
      label: '侧边栏',
      value: sidebarSummary.value,
      detail: sidebarSummary.detail,
    },
    {
      label: '顶部导航',
      value: headerSummary.value,
      detail: headerSummary.detail,
    },
    {
      label: '系统设置导航',
      value: systemSettingsSummary.value,
      detail: systemSettingsSummary.detail,
    },
    {
      label: '官方定价',
      value: priceSummary.value,
      detail: priceSummary.detail,
    },
    {
      label: '错误安全',
      value: errorRuleSummary.value,
      detail: errorRuleSummary.detail,
    },
  ]

  return (
    <Card className='rounded-lg shadow-none'>
      <CardHeader className='border-b pb-3'>
        <CardTitle className='text-sm'>默认值快照</CardTitle>
        <CardDescription>
          当前由 `/api/status` 下发的全局默认值；用户浏览器本地偏好仍可覆盖这些值。
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3'>
        {items.map((item) => (
          <div key={item.label} className='bg-muted/20 rounded-md border p-3'>
            <p className='text-muted-foreground text-xs'>{item.label}</p>
            <p className='mt-2 text-sm font-medium'>{item.value}</p>
            <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
              {item.detail}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function getSystemSettingsNavigationSummary(navConfig?: string | null) {
  const parsed = parseSystemSettingsNavigation(navConfig)
  const areaOrder = getSystemSettingsAreaOrder(parsed)
  const enabledAreas = areaOrder.filter((area) => parsed.areas[area]?.enabled)
  let totalSections = 0
  let enabledSections = 0

  areaOrder.forEach((area) => {
    const sections = getSystemSettingsSectionOrder(parsed, area)
    totalSections += sections.length
    enabledSections += sections.filter(
      (section) => parsed.areas[area]?.sections?.[section] !== false
    ).length
  })

  return {
    value: `${enabledAreas.length}/${areaOrder.length} 个区域可见`,
    detail: `${enabledSections}/${totalSections} 个分区可见 · ${areaOrder.join(' / ')}`,
  }
}

function getHeaderNavSummary(
  navConfig?: string | null,
  docsLink?: string | null
) {
  const parsed = parseHeaderNavModules(navConfig)
  const modules = [
    ['home', parsed.home],
    ['console', parsed.console],
    ['models', parsed.pricing.enabled],
    ['rankings', parsed.rankings.enabled],
    ['docs', parsed.docs],
    ['about', parsed.about],
  ] as const
  const enabledModules = modules.filter(([, enabled]) => enabled)
  const gatedModules = [
    parsed.pricing.requireAuth ? 'models' : '',
    parsed.rankings.requireAuth ? 'rankings' : '',
  ].filter(Boolean)
  const normalizedDocsLink = docsLink?.trim() || '默认文档地址'
  const order = normalizeHeaderNavOrder(parsed.order)
    .map(formatHeaderModule)
    .join(' / ')

  return {
    value: `${enabledModules.length}/${modules.length} 个模块可见`,
    detail:
      gatedModules.length > 0
        ? `${order} · ${gatedModules.map(formatHeaderModule).join('/')} 需要登录 · ${normalizedDocsLink}`
        : `${order} · 公开模块 · ${normalizedDocsLink}`,
  }
}

function formatHeaderModule(value: string) {
  switch (value) {
    case 'home':
      return '首页'
    case 'console':
      return '控制台'
    case 'pricing':
      return '模型广场'
    case 'rankings':
      return '排行榜'
    case 'docs':
      return '文档'
    case 'about':
      return '关于'
    default:
      return value
  }
}

function getPriceSyncSummary(status?: OfficialPriceSyncStatus) {
  if (!status) {
    return {
      value: 'Status loading',
      detail: '正在读取 models.dev 官方价格同步状态',
    }
  }

  const source = status.source_url || 'https://models.dev/api.json'
  const lastRun = formatTimestamp(status.last_run_unix)
  if (!status.last_run_unix) {
    return {
      value: '尚未同步',
      detail: source,
    }
  }

  return {
    value: status.last_ok ? '上次同步成功' : '上次同步失败',
    detail: `${status.last_models_num ?? 0} 个模型 · ${lastRun} · ${source}`,
  }
}

function getErrorRuleSummary(rules: ErrorRule[]) {
  if (rules.length === 0) {
    return {
      value: '使用内置固定错误',
      detail: '尚未配置自定义规则',
    }
  }

  const enabledRules = rules.filter((rule) => rule.enabled)
  return {
    value: `${enabledRules.length}/${rules.length} 条自定义规则已启用`,
    detail: '客户端看到规范化提示，日志保留脱敏预览',
  }
}

function getSidebarSummary(
  sectionOrder?: string | null,
  modulesConfig?: string | null
) {
  const orderedSections = parseCSV(sectionOrder)
  const orderValue =
    orderedSections.length > 0
      ? orderedSections.map(formatSidebarSection).join(' / ')
      : '默认顺序'

  try {
    const parsed = modulesConfig
      ? (JSON.parse(modulesConfig) as Record<string, Record<string, unknown>>)
      : {}
    const sections = Object.entries(parsed).filter(
      ([, section]) => section && typeof section === 'object'
    )
    if (sections.length === 0) {
      return {
        value: orderValue,
        detail: '默认分组 · 默认模块',
      }
    }

    let enabledSections = 0
    let totalModules = 0
    let enabledModules = 0
    sections.forEach(([, section]) => {
      if (section.enabled !== false) enabledSections += 1
      Object.entries(section).forEach(([moduleKey, moduleValue]) => {
        if (moduleKey === 'enabled' || moduleKey === 'order') return
        if (typeof moduleValue !== 'boolean') return
        totalModules += 1
        if (moduleValue) enabledModules += 1
      })
    })

    return {
      value: orderValue,
      detail: `${enabledSections}/${sections.length} 个分组 · ${enabledModules}/${totalModules} 个模块可见`,
    }
  } catch {
    return {
      value: orderValue,
      detail: '侧边栏模块 JSON 无法读取',
    }
  }
}

function parseCSV(value?: string | null) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatSidebarSection(value: string) {
  switch (value) {
    case 'chat':
      return '聊天'
    case 'console':
      return '控制台'
    case 'personal':
      return '个人'
    case 'admin':
      return '管理'
    default:
      return value
  }
}

function ConfigMap() {
  return (
    <Card className='rounded-lg shadow-none'>
      <CardHeader className='border-b pb-3'>
        <CardTitle className='text-sm'>配置地图</CardTitle>
        <CardDescription>
          快速找到兼容、分析、外观和安全相关的新增控制项。
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-4'>
        {CONFIG_MAP_GROUPS.map((group) => (
          <ConfigMapGroupCard key={group.title} group={group} />
        ))}
      </CardContent>
    </Card>
  )
}

function ConfigMapGroupCard(props: { group: ConfigMapGroup }) {
  const Icon = props.group.icon
  return (
    <div className='bg-muted/20 rounded-md border p-3'>
      <div className='flex items-start gap-3'>
        <span className='bg-background flex size-8 shrink-0 items-center justify-center rounded-md border'>
          <Icon className='text-muted-foreground size-4' />
        </span>
        <div className='min-w-0'>
          <p className='text-sm font-medium'>{props.group.title}</p>
          <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
            {props.group.description}
          </p>
        </div>
      </div>
      <div className='mt-3 flex flex-col gap-1.5'>
        {props.group.items.map((item) => (
          <ConfigMapLink key={item.label} label={item.label} link={item.link} />
        ))}
      </div>
    </div>
  )
}

function ConfigMapLink(props: { label: string; link: ActionLink }) {
  return (
    <OperationsActionLink
      action={{
        title: props.label,
        description: '',
        icon: Activity,
        status: '',
        cta: props.label,
        link: props.link,
      }}
      compact
    />
  )
}

function OperationsActionCard(props: {
  action: OperationsAction
  compact?: boolean
}) {
  const Icon = props.action.icon
  return (
    <Card className='rounded-lg shadow-none'>
      <CardHeader className='gap-3'>
        <div className='flex min-w-0 items-center gap-3'>
          <div className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-md'>
            <Icon className='text-muted-foreground size-4' />
          </div>
          <div className='min-w-0'>
            <CardTitle className='truncate text-sm'>
              {props.action.title}
            </CardTitle>
            <Badge variant='outline' className='mt-1'>
              {props.action.status}
            </Badge>
          </div>
        </div>
        <CardDescription
          className={cn(
            'leading-relaxed',
            props.compact ? 'min-h-16' : 'min-h-20'
          )}
        >
          {props.action.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <OperationsActionLink action={props.action} />
      </CardContent>
    </Card>
  )
}

function OperationsActionLink(props: {
  action: OperationsAction
  compact?: boolean
}) {
  const className = cn(
    buttonVariants({ variant: 'outline', size: 'sm' }),
    'w-full',
    props.compact && 'h-8 justify-start px-2 text-xs'
  )
  const { link } = props.action

  if (link.kind === 'system-settings') {
    return (
      <Link
        to={`/system-settings/${link.area}/$section`}
        params={{ section: link.section }}
        className={className}
      >
        {props.action.cta}
      </Link>
    )
  }

  if (link.kind === 'dashboard') {
    return (
      <Link
        to='/dashboard/$section'
        params={{ section: link.section }}
        className={className}
      >
        {props.action.cta}
      </Link>
    )
  }

  if (link.kind === 'usage-logs') {
    return (
      <Link
        to='/usage-logs/$section'
        params={{ section: 'common' }}
        search={{ page: 1 }}
        className={className}
      >
        {props.action.cta}
      </Link>
    )
  }

  return (
    <Link to={link.to} className={className}>
      {props.action.cta}
    </Link>
  )
}

function formatUptime(startTime?: number | null) {
  if (!startTime || !Number.isFinite(startTime)) return '运行时长不可用'
  const nowSeconds = Math.floor(Date.now() / 1000)
  const elapsed = Math.max(0, nowSeconds - startTime)
  const days = Math.floor(elapsed / 86400)
  const hours = Math.floor((elapsed % 86400) / 3600)
  if (days > 0) return `已运行 ${days} 天 ${hours} 小时`
  const minutes = Math.floor((elapsed % 3600) / 60)
  if (hours > 0) return `已运行 ${hours} 小时 ${minutes} 分钟`
  return `已运行 ${Math.max(1, minutes)} 分钟`
}

function formatTimestamp(timestamp?: number) {
  if (!timestamp) return '从未'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000))
}

function formatTimeRange(value: string) {
  switch (value) {
    case '1d':
      return '1 天'
    case '7d':
      return '7 天'
    case '30d':
      return '30 天'
    case '1y':
      return '1 年'
    case 'all':
      return '全部时间'
    default:
      return value
  }
}

function formatHealthFilter(value: string) {
  switch (value) {
    case 'all':
      return '全部健康状态'
    case 'active':
      return '仅活跃项'
    case 'risk':
      return '仅风险项'
    case 'slow':
      return '仅慢响应项'
    default:
      return value
  }
}

function formatTrendMode(value: string) {
  switch (value) {
    case 'overview':
      return '总览趋势'
    case 'throughput':
      return '吞吐趋势'
    case 'latency':
      return '延迟趋势'
    case 'cost':
      return '成本趋势'
    default:
      return value
  }
}
