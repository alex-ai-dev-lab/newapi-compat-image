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
import { useTranslation } from 'react-i18next'
import { StatCard } from '@/components/page-primitives'
import type { Model, Vendor } from '../types'

export function ModelsStats({
  models,
  vendors,
}: {
  models: Model[]
  vendors: Vendor[]
}) {
  const { t } = useTranslation()
  const enabledModels = models.filter((model) => model.status === 1)
  const syncedModels = models.filter((model) => model.sync_official === 1)
  const activeVendorIds = new Set(models.map((model) => model.vendor_id).filter(Boolean))

  return (
    <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
      <StatCard
        label={t('Total Models')}
        value={models.length}
        description={t('当前结果中的模型元数据条目')}
      />
      <StatCard
        label={t('Enabled')}
        value={enabledModels.length}
        description={t('可用于路由与匹配的模型')}
        tone='success'
      />
      <StatCard
        label={t('Official Sync')}
        value={syncedModels.length}
        description={t('正在接收上游同步更新')}
        tone='accent'
      />
      <StatCard
        label={t('Active Vendors')}
        value={activeVendorIds.size || vendors.length}
        description={t('当前视图中覆盖的供应商')}
      />
    </div>
  )
}
