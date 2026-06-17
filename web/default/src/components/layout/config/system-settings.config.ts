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
import { type TFunction } from 'i18next'
import {
  Box,
  CreditCard,
  Layout,
  Settings,
  Shield,
  ShieldAlert,
  Wrench,
} from 'lucide-react'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { getAuthSectionNavItems } from '@/features/system-settings/auth/section-registry.tsx'
import { getBillingSectionNavItems } from '@/features/system-settings/billing/section-registry.tsx'
import { getContentSectionNavItems } from '@/features/system-settings/content/section-registry.tsx'
import {
  getSystemSettingsAreaOrder,
  getSystemSettingsSectionOrder,
  parseSystemSettingsNavigation,
} from '@/features/system-settings/maintenance/config'
import { getModelsSectionNavItems } from '@/features/system-settings/models/section-registry.tsx'
import { getOperationsSectionNavItems } from '@/features/system-settings/operations/section-registry.tsx'
import { getSecuritySectionNavItems } from '@/features/system-settings/security/section-registry.tsx'
import { getSiteSectionNavItems } from '@/features/system-settings/site/section-registry.tsx'
import type { NavCollapsible, NavGroup, SidebarView } from '../types'

/**
 * Sidebar nav groups for the System Settings nested view.
 *
 * Kept as a single group because the workspace title in the sidebar
 * header already provides top-level context — the inner group label
 * scopes the items as "administration" actions.
 */
function getSystemSettingsNavGroups(t: TFunction): NavGroup[] {
  const navigationConfig = parseSystemSettingsNavigation(
    useSystemConfigStore.getState().config.systemSettingsNavigation
  )
  const areaDefinitions: Record<string, NavCollapsible> = {
    site: {
      title: t('Site & Branding'),
      icon: Settings,
      items: getSiteSectionNavItems(t),
    },
    auth: {
      title: t('Access & Identity'),
      icon: Shield,
      items: getAuthSectionNavItems(t),
    },
    billing: {
      title: t('Billing & Payment'),
      icon: CreditCard,
      items: getBillingSectionNavItems(t),
    },
    models: {
      title: t('Models & Routing'),
      icon: Box,
      items: getModelsSectionNavItems(t),
    },
    security: {
      title: t('Security & Risk Control'),
      icon: ShieldAlert,
      items: getSecuritySectionNavItems(t),
    },
    content: {
      title: t('Console & Display'),
      icon: Layout,
      items: getContentSectionNavItems(t),
    },
    operations: {
      title: t('Operations & Maintenance'),
      icon: Wrench,
      items: getOperationsSectionNavItems(t),
    },
  }

  const areaItems = getSystemSettingsAreaOrder(navigationConfig).reduce<
    NavCollapsible[]
  >((acc, area) => {
    if (!navigationConfig.areas[area]?.enabled) return acc
    const definition = areaDefinitions[area]
    if (!definition) return acc
    const sectionOrder = getSystemSettingsSectionOrder(navigationConfig, area)
    const sectionEnabled = navigationConfig.areas[area]?.sections ?? {}
    const orderIndex = new Map(
      sectionOrder.map((section, index) => [section, index])
    )
    const items = definition.items
      .filter((item) => {
        const section = String(item.url).split('/').filter(Boolean).pop()
        return section ? sectionEnabled[section] !== false : true
      })
      .sort((a, b) => {
        const aSection = String(a.url).split('/').filter(Boolean).pop() ?? ''
        const bSection = String(b.url).split('/').filter(Boolean).pop() ?? ''
        return (
          (orderIndex.get(aSection) ?? Number.MAX_SAFE_INTEGER) -
          (orderIndex.get(bSection) ?? Number.MAX_SAFE_INTEGER)
        )
      })
    if (items.length > 0) {
      acc.push({ ...definition, items })
    }
    return acc
  }, [])

  return [
    {
      id: 'system-administration',
      title: t('System Administration'),
      items: areaItems,
    },
  ]
}

/**
 * Nested sidebar view for `/system-settings/*`.
 *
 * Activates the Vercel / Cloudflare-style drill-in sidebar:
 * the root navigation is replaced by the system administration
 * groups, with a "Back to Dashboard" affordance in the header.
 */
export const SYSTEM_SETTINGS_VIEW: SidebarView = {
  id: 'system-settings',
  pathPattern: /^\/system-settings(\/|$)/,
  parent: {
    to: '/dashboard/overview',
    label: 'Back to Dashboard',
  },
  getNavGroups: getSystemSettingsNavGroups,
}
