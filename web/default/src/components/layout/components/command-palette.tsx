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
        label: 'Dashboard',
        description: 'Go to overview dashboard',
        icon: LayoutDashboard,
        keywords: ['home', 'overview', 'stats'],
        section: 'Navigation',
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
        label: 'Channels',
        description: 'Manage API channels',
        icon: Radio,
        keywords: ['channel', 'api', 'upstream'],
        section: 'Navigation',
        action: () => {
          navigate({ to: '/channels' })
          close()
        },
        requiresRole: 10,
      },
      // Navigation - Keys/Tokens
      {
        id: 'nav-keys',
        label: 'API Keys',
        description: 'Manage API keys and tokens',
        icon: Key,
        keywords: ['key', 'token', 'api', 'access'],
        section: 'Navigation',
        action: () => {
          navigate({ to: '/keys' })
          close()
        },
      },
      // Navigation - Users
      {
        id: 'nav-users',
        label: 'Users',
        description: 'Manage users and permissions',
        icon: Users,
        keywords: ['user', 'account', 'permission'],
        section: 'Navigation',
        action: () => {
          navigate({ to: '/users' })
          close()
        },
        requiresRole: 10,
      },
      // Navigation - Logs
      {
        id: 'nav-logs',
        label: 'Logs',
        description: 'View request logs and analytics',
        icon: FileText,
        keywords: ['log', 'request', 'history', 'analytics'],
        section: 'Navigation',
        action: () => {
          navigate({ to: '/console/log' })
          close()
        },
      },
      {
        id: 'nav-usage-logs',
        label: 'Usage Logs',
        description:
          'Open raw API call logs with model, channel, and user filters',
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
        section: 'Navigation',
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
        label: 'System Settings',
        description: 'Configure system-wide settings',
        icon: Settings,
        keywords: ['settings', 'config', 'system'],
        section: 'Settings',
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
            params: { section: 'overview' },
          })
          close()
        },
        requiresRole: 100,
      },
      // Settings - Models
      {
        id: 'settings-models',
        label: 'Model Settings',
        description: 'Open the model control center',
        icon: Zap,
        keywords: ['model', 'operations', 'pricing', 'ratio', 'claude', 'gpt'],
        section: 'Settings',
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
        label: 'Model Pricing',
        description: 'Sync, edit, import, and export official model prices',
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
        section: 'Settings',
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
        label: 'Global Model Configuration',
        description: 'Import/export passthrough, thinking, and ping defaults',
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
        section: 'Settings',
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
        label: 'Claude Settings',
        description:
          'Import/export Claude headers, max tokens, and thinking adapter',
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
        section: 'Settings',
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
        label: 'Gemini Settings',
        description:
          'Import/export Gemini safety, version, and thinking adapter settings',
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
        section: 'Settings',
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
        label: 'Grok Settings',
        description: 'Import/export Grok violation deduction settings',
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
        section: 'Settings',
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
        label: 'Channel Affinity',
        description: 'Import/export sticky routing rules and affinity limits',
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
        section: 'Settings',
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
        label: 'Official Price Sync',
        description: 'Open the official-only upstream model price sync panel',
        icon: RefreshCw,
        keywords: [
          'official',
          'price',
          'sync',
          'models.dev',
          'ratio',
          'billing',
        ],
        section: 'Settings',
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
        label: 'Model Deployment',
        description:
          'Configure and import/export io.net deployment settings with a redacted API key',
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
        section: 'Settings',
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
        label: 'Quota Settings',
        description: 'Configure and import/export quota and top-up basics',
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
        section: 'Settings',
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
        label: 'Currency Display',
        description: 'Configure and import/export currency display defaults',
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
        section: 'Settings',
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
        label: 'Payment Gateway',
        description:
          'Configure and import/export Epay, Stripe, Creem, Waffo, and Waffo Pancake gateways',
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
        section: 'Settings',
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
        label: 'Check-in Rewards',
        description: 'Configure and import/export daily check-in rewards',
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
        section: 'Settings',
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
        label: 'Channel Test Scheduler',
        description:
          'Open channels to configure scheduled tests and recovery windows',
        icon: Timer,
        keywords: [
          'channel',
          'test',
          'scheduler',
          'recovery',
          'retry',
          'window',
        ],
        section: 'Settings',
        action: () => {
          navigate({ to: '/channels' })
          close()
        },
        requiresRole: 10,
      },
      {
        id: 'settings-monitoring-alerts',
        label: 'Monitoring & Alerts',
        description:
          'Configure and import/export channel tests, retry rules, and reminders',
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
        section: 'Settings',
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
        label: 'Log Maintenance',
        description:
          'Configure and import/export quota usage logging; destructive cleanup stays manual',
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
        section: 'Settings',
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
        label: 'SMTP Email',
        description:
          'Configure and import/export SMTP host, sender, auth flags, and redacted credentials',
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
        section: 'Settings',
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
        label: 'Basic Authentication',
        description:
          'Configure and import/export password login, registration, email verification, and domain rules',
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
        section: 'Settings',
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
        label: 'OAuth Integrations',
        description:
          'Configure and import/export OAuth providers with redacted client secrets and tokens',
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
        section: 'Settings',
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
        label: 'Passkey Authentication',
        description:
          'Configure and import/export WebAuthn relying party, origins, and verification settings',
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
        section: 'Settings',
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
        label: 'Bot Protection',
        description:
          'Configure and import/export Turnstile site key with redacted secret key',
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
        section: 'Settings',
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
        label: 'Custom OAuth',
        description:
          'Configure and import/export custom OAuth providers with redacted client secrets',
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
        section: 'Settings',
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
        label: 'Worker Proxy',
        description:
          'Configure and import/export Worker URL, HTTP image policy, and redacted access key',
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
        section: 'Settings',
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
        label: 'Announcements',
        description: 'Configure and import/export console announcements',
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
        section: 'Settings',
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
        label: 'API Addresses',
        description: 'Configure and import/export console API address cards',
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
        section: 'Settings',
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
        description: 'Configure and import/export frequently asked questions',
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
        section: 'Settings',
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
        description: 'Configure and import/export status page groups',
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
        section: 'Settings',
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
        label: 'Chat Presets',
        description: 'Configure and import/export chat client presets',
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
        section: 'Settings',
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
        label: 'Drawing',
        description: 'Configure and import/export drawing feature switches',
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
        section: 'Settings',
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
        label: 'System Information',
        description:
          'Configure and import/export site identity, homepage copy, agreement, and privacy policy',
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
        section: 'Settings',
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
        label: 'System Notice',
        description: 'Configure and import/export the site-wide notice',
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
        section: 'Settings',
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
        label: 'Performance Settings',
        description:
          'Configure and import/export cache, resource monitors, and performance knobs',
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
        section: 'Settings',
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
        label: 'Header Navigation',
        description:
          'Configure and import/export top navigation and documentation link',
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
        section: 'Settings',
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
        label: 'Sidebar Modules',
        description:
          'Configure and import/export sidebar modules, visibility, and order',
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
        section: 'Settings',
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
        label: 'System Settings Navigation',
        description:
          'Configure and import/export System Settings areas, sections, visibility, and order',
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
        section: 'Settings',
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
        label: 'View Analytics',
        description: 'Open detailed analytics dashboard',
        icon: BarChart3,
        keywords: ['analytics', 'stats', 'metrics', 'chart'],
        section: 'Quick Actions',
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

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <CommandInput
        placeholder='Type a command or search...'
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

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
