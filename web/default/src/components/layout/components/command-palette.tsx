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
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Key,
  Radio,
  Settings,
  Users,
  FileText,
  BadgeDollarSign,
  BarChart3,
  Palette,
  Shield,
  Zap,
  Globe,
  AlertTriangle,
  BookOpen,
  LineChart,
  RefreshCw,
  Timer,
  Gift,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { useCommandPalette } from '@/stores/command-palette-store'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

interface CommandAction {
  id: string
  label: string
  description?: string
  icon?: LucideIcon
  keywords?: string[]
  section: string
  action: () => void
  requiresRole?: number
}

export function CommandPalette() {
  const { t } = useTranslation()
  const { isOpen, close } = useCommandPalette()
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const [search, setSearch] = useState('')

  // Define all available commands
  const commands: CommandAction[] = useMemo(() => {
    const baseCommands: CommandAction[] = [
      // Navigation - Dashboard
      {
        id: 'nav-dashboard',
        label: '控制台',
        description: '打开数据总览控制台',
        icon: LayoutDashboard,
        keywords: ['home', 'overview', 'stats'],
        section: '导航',
        action: () => {
          navigate({ to: '/dashboard' })
          close()
        },
      },
      {
        id: 'analytics-overview',
        label: '运维总览',
        description: '打开运维总览与健康信号',
        icon: BarChart3,
        keywords: ['overview', 'analytics', 'operations', 'health', 'stats'],
        section: '分析',
        action: () => {
          navigate({
            to: '/dashboard/$section',
            params: { section: 'overview' },
          })
          close()
        },
      },
      {
        id: 'analytics-models',
        label: '模型分析',
        description: '查看模型流量、可靠性、延迟和成本',
        icon: LineChart,
        keywords: ['model', 'analytics', 'latency', 'cost', 'success rate'],
        section: '分析',
        action: () => {
          navigate({
            to: '/dashboard/$section',
            params: { section: 'models' },
          })
          close()
        },
      },
      {
        id: 'analytics-channels',
        label: '渠道分析',
        description:
          '查看渠道可靠性、首 token 延迟和用户构成',
        icon: Radio,
        keywords: [
          'channel',
          'analytics',
          'success rate',
          'first token',
          'user spend',
        ],
        section: '分析',
        action: () => {
          navigate({
            to: '/dashboard/$section',
            params: { section: 'channels' },
          })
          close()
        },
        requiresRole: 10,
      },
      {
        id: 'analytics-users',
        label: '用户分析',
        description: '查看用户消费、可靠性、延迟和趋势',
        icon: Users,
        keywords: ['user', 'analytics', 'spend', 'cost', 'latency', 'trend'],
        section: '分析',
        action: () => {
          navigate({
            to: '/dashboard/$section',
            params: { section: 'users' },
          })
          close()
        },
        requiresRole: 10,
      },
      // Navigation - Channels
      {
        id: 'nav-channels',
        label: '渠道',
        description: '管理 API 渠道与上游配置',
        icon: Radio,
        keywords: ['channel', 'api', 'upstream'],
        section: '导航',
        action: () => {
          navigate({ to: '/channels' })
          close()
        },
        requiresRole: 10,
      },
      // Navigation - Keys/Tokens
      {
        id: 'nav-keys',
        label: 'API 密钥',
        description: '管理 API 密钥与访问令牌',
        icon: Key,
        keywords: ['key', 'token', 'api', 'access'],
        section: '导航',
        action: () => {
          navigate({ to: '/keys' })
          close()
        },
      },
      // Navigation - Users
      {
        id: 'nav-users',
        label: '用户',
        description: '管理用户与权限',
        icon: Users,
        keywords: ['user', 'account', 'permission'],
        section: '导航',
        action: () => {
          navigate({ to: '/users' })
          close()
        },
        requiresRole: 10,
      },
      // Navigation - Logs
      {
        id: 'nav-logs',
        label: '日志',
        description: '查看请求日志与分析',
        icon: FileText,
        keywords: ['log', 'request', 'history', 'analytics'],
        section: '导航',
        action: () => {
          navigate({ to: '/console/log' })
          close()
        },
      },
      {
        id: 'nav-usage-logs',
        label: '使用日志',
        description: '打开带模型、渠道和用户筛选的原始 API 调用日志',
        icon: FileText,
        keywords: [
          'usage',
          'logs',
          'request',
          'raw',
          'model',
          'channel',
          'user',
          'trace',
        ],
        section: '导航',
        action: () => {
          navigate({
            to: '/usage-logs/$section',
            params: { section: 'common' },
            search: { page: 1 },
          })
          close()
        },
      },
      // Settings - System
      {
        id: 'settings-system',
        label: '系统设置',
        description: '配置全局系统设置',
        icon: Settings,
        keywords: ['settings', 'config', 'system'],
        section: '设置',
        action: () => {
          navigate({ to: '/system-settings' })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-operations-center',
        label: '运维中心',
        description:
          '打开兼容能力与后台运维控制台',
        icon: LayoutDashboard,
        keywords: [
          'operations',
          'compat',
          'ua',
          'user-agent',
          'client identity',
          'dashboard defaults',
          'appearance',
          'system information',
          'site info',
          'header',
          'sidebar',
          'import',
          'export',
          'json',
          'sqlite',
          'error rules',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/operations/$section',
            params: { section: 'email' },
          })
          close()
        },
        requiresRole: 100,
      },
      // Settings - Models
      {
        id: 'settings-models',
        label: '模型设置',
        description: '打开模型控制中心',
        icon: Zap,
        keywords: ['model', 'operations', 'pricing', 'ratio', 'claude', 'gpt'],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/models/$section',
            params: { section: 'overview' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-model-operations',
        label: '模型运维',
        description:
          '跳转到定价、UA、标识、路由和分析快捷入口',
        icon: LineChart,
        keywords: [
          'model',
          'operations',
          'ua',
          'identity',
          'analytics',
          'routing',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/models/$section',
            params: { section: 'overview' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-user-agents',
        label: 'User-Agent 管理',
        description: '管理全局和渠道 User-Agent 配置',
        icon: Globe,
        keywords: ['ua', 'user-agent', 'codex', 'claude', 'gpt', 'model'],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/models/$section',
            params: { section: 'user-agents' },
          })
          close()
        },
        requiresRole: 100,
      },
      // Settings - Client Identity
      {
        id: 'settings-client-identity',
        label: '客户端标识',
        description:
          '管理并导入/导出设备标识和安装标识',
        icon: Shield,
        keywords: [
          'identity',
          'uuid',
          'device',
          'codex',
          'claude',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/models/$section',
            params: { section: 'client-identity' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-model-pricing',
        label: '模型定价',
        description: '同步、编辑、导入和导出官方模型价格',
        icon: Zap,
        keywords: [
          'pricing',
          'ratio',
          'models.dev',
          'official',
          'sync',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/models/$section',
            params: { section: 'model-pricing' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-global-model-configuration',
        label: '全局模型配置',
        description: '导入/导出透传、thinking 和 ping 默认配置',
        icon: Settings,
        keywords: [
          'global model',
          'passthrough',
          'thinking blacklist',
          'responses',
          'ping',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/models/$section',
            params: { section: 'global' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-claude',
        label: 'Claude 设置',
        description: '导入/导出 Claude 头部、最大 token 和 thinking 适配',
        icon: Zap,
        keywords: [
          'claude',
          'anthropic',
          'headers',
          'thinking',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/models/$section',
            params: { section: 'claude' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-gemini',
        label: 'Gemini 设置',
        description: '导入/导出 Gemini 安全、版本和 thinking 适配设置',
        icon: Zap,
        keywords: [
          'gemini',
          'safety',
          'version',
          'thinking',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/models/$section',
            params: { section: 'gemini' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-grok',
        label: 'Grok 设置',
        description: '导入/导出 Grok 违规扣减设置',
        icon: Zap,
        keywords: [
          'grok',
          'xai',
          'violation',
          'deduction',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/models/$section',
            params: { section: 'grok' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-channel-affinity',
        label: '渠道亲和',
        description: '导入/导出粘性路由规则与亲和限制',
        icon: Settings,
        keywords: [
          'channel affinity',
          'sticky',
          'routing',
          'codex',
          'claude',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/models/$section',
            params: { section: 'channel-affinity' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-official-price-sync',
        label: '官方价格同步',
        description: '打开仅同步官方上游模型价格的面板',
        icon: RefreshCw,
        keywords: [
          'official',
          'price',
          'sync',
          'models.dev',
          'ratio',
          'billing',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/models/$section',
            params: { section: 'model-pricing' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-model-deployment',
        label: '模型部署',
        description: '配置并导入/导出带脱敏 API key 的 io.net 部署设置',
        icon: Settings,
        keywords: [
          'model deployment',
          'io.net',
          'ionet',
          'deployment',
          'api key',
          'secret',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/models/$section',
            params: { section: 'model-deployment' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-quota',
        label: '额度设置',
        description: '配置并导入/导出额度与充值基础设置',
        icon: BadgeDollarSign,
        keywords: [
          'quota',
          'topup',
          'billing',
          'invite',
          'docs',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/billing/$section',
            params: { section: 'quota' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-currency-display',
        label: '货币显示',
        description: '配置并导入/导出货币显示默认值',
        icon: BadgeDollarSign,
        keywords: [
          'currency',
          'display',
          'exchange',
          'quota',
          'billing',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/billing/$section',
            params: { section: 'currency' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-payment-gateway',
        label: '支付网关',
        description: '配置并导入/导出 Epay、Stripe、Creem、Waffo 与 Waffo Pancake 网关',
        icon: BadgeDollarSign,
        keywords: [
          'payment',
          'gateway',
          'stripe',
          'creem',
          'waffo',
          'epay',
          'billing',
          'secret',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/billing/$section',
            params: { section: 'payment' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-checkin-rewards',
        label: '签到奖励',
        description: '配置并导入/导出每日签到奖励',
        icon: Gift,
        keywords: [
          'checkin',
          'check-in',
          'daily',
          'reward',
          'quota',
          'billing',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/billing/$section',
            params: { section: 'checkin' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-channel-tests',
        label: '渠道测试调度',
        description: '打开渠道页配置定时测试和恢复窗口',
        icon: Timer,
        keywords: [
          'channel',
          'test',
          'scheduler',
          'recovery',
          'retry',
          'window',
        ],
        section: '设置',
        action: () => {
          navigate({ to: '/channels' })
          close()
        },
        requiresRole: 10,
      },
      {
        id: 'settings-monitoring-alerts',
        label: '监控与告警',
        description: '配置并导入/导出渠道测试、重试规则和提醒',
        icon: BarChart3,
        keywords: [
          'monitoring',
          'alerts',
          'disable',
          'retry',
          'status code',
          'quota',
          'reminder',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/operations/$section',
            params: { section: 'monitoring' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-log-maintenance',
        label: '日志维护',
        description: '配置并导入/导出额度用量日志，破坏性清理仍需手动执行',
        icon: FileText,
        keywords: [
          'log',
          'logs',
          'maintenance',
          'consume',
          'quota usage',
          'cleanup',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/operations/$section',
            params: { section: 'logs' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-smtp-email',
        label: 'SMTP 邮件',
        description: '配置并导入/导出 SMTP 主机、发件人、认证开关和脱敏凭据',
        icon: Settings,
        keywords: [
          'smtp',
          'email',
          'mail',
          'credential',
          'secret',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/operations/$section',
            params: { section: 'email' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-basic-auth',
        label: '基础认证',
        description: '配置并导入/导出密码登录、注册、邮箱验证和域名规则',
        icon: Shield,
        keywords: [
          'basic auth',
          'authentication',
          'password',
          'registration',
          'email',
          'domain',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/auth/$section',
            params: { section: 'basic-auth' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-oauth-integrations',
        label: 'OAuth 集成',
        description: '配置并导入/导出带脱敏客户端密钥和令牌的 OAuth 提供商',
        icon: Shield,
        keywords: [
          'oauth',
          'github',
          'discord',
          'oidc',
          'telegram',
          'linuxdo',
          'wechat',
          'secret',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/auth/$section',
            params: { section: 'oauth' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-passkey-authentication',
        label: 'Passkey 认证',
        description: '配置并导入/导出 WebAuthn RP、来源和验证设置',
        icon: Key,
        keywords: [
          'passkey',
          'webauthn',
          'authentication',
          'origin',
          'rp id',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/auth/$section',
            params: { section: 'passkey' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-bot-protection',
        label: '机器人防护',
        description: '配置并导入/导出带脱敏密钥的 Turnstile 站点密钥',
        icon: Shield,
        keywords: [
          'bot',
          'turnstile',
          'captcha',
          'protection',
          'secret',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/auth/$section',
            params: { section: 'bot-protection' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-custom-oauth',
        label: '自定义 OAuth',
        description: '配置并导入/导出带脱敏客户端密钥的自定义 OAuth 提供商',
        icon: Shield,
        keywords: [
          'custom oauth',
          'oauth provider',
          'provider',
          'slug',
          'client secret',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/auth/$section',
            params: { section: 'custom-oauth' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-worker-proxy',
        label: 'Worker 代理',
        description: '配置并导入/导出 Worker URL、HTTP 图片策略和脱敏访问密钥',
        icon: Settings,
        keywords: [
          'worker',
          'proxy',
          'access key',
          'credential',
          'secret',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/operations/$section',
            params: { section: 'worker' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-claude-thinking',
        label: 'Claude Thinking 兼容',
        description: '打开渠道配置 Claude thinking 兼容能力',
        icon: Zap,
        keywords: ['claude', 'thinking', 'signature', 'anthropic', 'fallback'],
        section: '设置',
        action: () => {
          navigate({ to: '/channels' })
          close()
        },
        requiresRole: 10,
      },
      {
        id: 'settings-upstream-error-rules',
        label: '上游错误规则',
        description:
          '规范化并导入/导出不安全上游错误提示规则',
        icon: AlertTriangle,
        keywords: [
          'error',
          'upstream',
          'anti-poison',
          'security',
          'normalize',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/security/$section',
            params: { section: 'upstream-error-rules' },
          })
          close()
        },
        requiresRole: 10,
      },
      {
        id: 'settings-rate-limiting',
        label: '速率限制',
        description: '配置并导入/导出模型请求限制',
        icon: Timer,
        keywords: [
          'rate',
          'limit',
          'request limit',
          'throttle',
          'security',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/security/$section',
            params: { section: 'rate-limit' },
          })
          close()
        },
        requiresRole: 10,
      },
      {
        id: 'settings-sensitive-words',
        label: '敏感词',
        description: '配置并导入/导出关键词拦截检查',
        icon: Shield,
        keywords: [
          'sensitive',
          'words',
          'keyword',
          'filter',
          'prompt',
          'security',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/security/$section',
            params: { section: 'sensitive-words' },
          })
          close()
        },
        requiresRole: 10,
      },
      {
        id: 'settings-ssrf-protection',
        label: 'SSRF 防护',
        description:
          '配置并导入/导出抓取域名、IP 和端口规则',
        icon: Shield,
        keywords: [
          'ssrf',
          'fetch',
          'domain',
          'ip',
          'port',
          'private ip',
          'security',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/security/$section',
            params: { section: 'ssrf' },
          })
          close()
        },
        requiresRole: 10,
      },
      {
        id: 'settings-security',
        label: '安全设置',
        description: '打开安全和上游保护设置',
        icon: Shield,
        keywords: [
          'security',
          'anti-poison',
          'error rules',
          'ssrf',
          'rate limit',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/security/$section',
            params: { section: 'upstream-error-rules' },
          })
          close()
        },
        requiresRole: 10,
      },
      // Settings - Appearance
      {
        id: 'settings-dashboard-defaults',
        label: '数据看板默认值',
        description: '配置并以 JSON 导入/导出数据看板默认值',
        icon: LayoutDashboard,
        keywords: [
          'dashboard',
          'defaults',
          'refresh',
          'time range',
          'auto refresh',
          'statistics',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/content/$section',
            params: { section: 'dashboard' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-appearance',
        label: '外观设置',
        description:
          '自定义并导入/导出主题、字体、布局和界面调色板默认值',
        icon: Palette,
        keywords: [
          'theme',
          'dark',
          'light',
          'appearance',
          'color',
          'palette',
          'accent',
          'surface',
          'sidebar',
          'chart',
          'font',
          'radius',
          'density',
          'layout',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/content/$section',
            params: { section: 'appearance' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-announcements',
        label: '公告',
        description: '配置并导入/导出控制台公告',
        icon: FileText,
        keywords: [
          'announcement',
          'announcements',
          'notice',
          'console',
          'content',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/content/$section',
            params: { section: 'announcements' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-api-addresses',
        label: 'API 地址',
        description: '配置并导入/导出控制台 API 地址卡片',
        icon: Globe,
        keywords: [
          'api',
          'address',
          'addresses',
          'api info',
          'endpoint',
          'console',
          'content',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/content/$section',
            params: { section: 'api-info' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-faq',
        label: 'FAQ',
        description: '配置并导入/导出常见问题',
        icon: FileText,
        keywords: [
          'faq',
          'question',
          'answer',
          'content',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/content/$section',
            params: { section: 'faq' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-uptime-kuma',
        label: 'Uptime Kuma',
        description: '配置并导入/导出状态页分组',
        icon: LineChart,
        keywords: [
          'uptime',
          'kuma',
          'status',
          'monitoring',
          'content',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/content/$section',
            params: { section: 'uptime-kuma' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-chat-presets',
        label: '聊天预设',
        description: '配置并导入/导出聊天客户端预设',
        icon: FileText,
        keywords: [
          'chat',
          'preset',
          'presets',
          'client',
          'content',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/content/$section',
            params: { section: 'chat' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-drawing',
        label: '绘图',
        description: '配置并导入/导出绘图功能开关',
        icon: Palette,
        keywords: [
          'drawing',
          'midjourney',
          'mj',
          'image',
          'content',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/content/$section',
            params: { section: 'drawing' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-system-information',
        label: '系统信息',
        description: '配置并导入/导出站点标识、首页文案、协议与隐私政策',
        icon: FileText,
        keywords: [
          'system',
          'information',
          'site',
          'site info',
          'logo',
          'footer',
          'about',
          'homepage',
          'agreement',
          'privacy',
          'policy',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/site/$section',
            params: { section: 'system-info' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-system-notice',
        label: '系统通知',
        description: '配置并导入/导出全站通知',
        icon: FileText,
        keywords: [
          'system',
          'notice',
          'announcement',
          'site',
          'content',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/site/$section',
            params: { section: 'notice' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-performance',
        label: '性能设置',
        description: '配置并导入/导出缓存、资源监控和性能开关',
        icon: Settings,
        keywords: [
          'performance',
          'cache',
          'cpu',
          'memory',
          'disk',
          'metrics',
          'monitor',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/operations/$section',
            params: { section: 'performance' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-header-navigation',
        label: '顶部导航',
        description: '配置并导入/导出顶部导航和文档链接',
        icon: BookOpen,
        keywords: [
          'header',
          'navigation',
          'docs',
          'documentation',
          'link',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/site/$section',
            params: { section: 'header-navigation' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-sidebar-modules',
        label: '侧边栏模块',
        description: '配置并导入/导出侧边栏模块、可见性和排序',
        icon: LayoutDashboard,
        keywords: [
          'sidebar',
          'modules',
          'navigation',
          'admin menu',
          'layout',
          'order',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/site/$section',
            params: { section: 'sidebar-modules' },
          })
          close()
        },
        requiresRole: 100,
      },
      {
        id: 'settings-system-settings-navigation',
        label: '系统设置导航',
        description: '配置并导入/导出系统设置区域、分区、可见性和排序',
        icon: Settings,
        keywords: [
          'system settings',
          'settings navigation',
          'administration menu',
          'section order',
          'visibility',
          'sidebar',
          'modules',
          'json',
          'import',
          'export',
        ],
        section: '设置',
        action: () => {
          navigate({
            to: '/system-settings/site/$section',
            params: { section: 'settings-navigation' },
          })
          close()
        },
        requiresRole: 100,
      },
      // Quick Actions - Analytics
      {
        id: 'action-analytics',
        label: '查看分析',
        description: '打开详细分析控制台',
        icon: BarChart3,
        keywords: ['analytics', 'stats', 'metrics', 'chart'],
        section: '快捷操作',
        action: () => {
          navigate({ to: '/dashboard' })
          close()
        },
      },
    ]

    // Filter by role
    return baseCommands.filter((cmd) => {
      if (!cmd.requiresRole) return true
      return auth.user && auth.user.role >= cmd.requiresRole
    })
  }, [auth.user, navigate, close])

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) return commands

    const searchLower = search.toLowerCase()
    return commands.filter((cmd) => {
      const labelMatch = cmd.label.toLowerCase().includes(searchLower)
      const descMatch = cmd.description?.toLowerCase().includes(searchLower)
      const keywordMatch = cmd.keywords?.some((kw) =>
        kw.toLowerCase().includes(searchLower)
      )
      return labelMatch || descMatch || keywordMatch
    })
  }, [commands, search])

  // Group commands by section
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {}
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.section]) {
        groups[cmd.section] = []
      }
      groups[cmd.section].push(cmd)
    })
    return groups
  }, [filteredCommands])

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        useCommandPalette.getState().toggle()
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Reset search on close
  useEffect(() => {
    if (!isOpen) {
      setSearch('')
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <CommandInput
        placeholder={t('Type a command or search...')}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>{t('No results found.')}</CommandEmpty>

        {Object.entries(groupedCommands).map(([section, items], idx) => (
          <div key={section}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={section}>
              {items.map((cmd) => {
                const Icon = cmd.icon
                return (
                  <CommandItem
                    key={cmd.id}
                    onSelect={() => cmd.action()}
                    className='flex items-center gap-3 px-4 py-3'
                  >
                    {Icon && <Icon className='text-muted-foreground h-4 w-4' />}
                    <div className='flex-1'>
                      <div className='font-medium'>{cmd.label}</div>
                      {cmd.description && (
                        <div className='text-muted-foreground text-xs'>
                          {cmd.description}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
