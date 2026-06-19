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
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
      <StatCard
        label={t('Total Models')}
        value={models.length}
      />
      <StatCard
        label={t('Enabled')}
        value={enabledModels.length}
        tone='success'
      />
      <StatCard
        label={t('Official Sync')}
        value={syncedModels.length}
        tone='accent'
      />
      <StatCard
        label={t('Active Vendors')}
        value={activeVendorIds.size || vendors.length}
      />
    </div>
  )
}
