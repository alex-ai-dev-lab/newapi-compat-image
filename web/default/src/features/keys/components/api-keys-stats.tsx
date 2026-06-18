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
import { API_KEY_STATUS } from '../constants'
import type { ApiKey } from '../types'

export function ApiKeysStats({ apiKeys }: { apiKeys: ApiKey[] }) {
  const { t } = useTranslation()
  const enabled = apiKeys.filter((item) => item.status === API_KEY_STATUS.ENABLED)
  const limited = apiKeys.filter((item) => !item.unlimited_quota)
  const exhausted = apiKeys.filter(
    (item) =>
      !item.unlimited_quota &&
      item.remain_quota <= 0 &&
      item.status !== API_KEY_STATUS.ENABLED
  )

  return (
    <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
      <StatCard
        label={t('Total Keys')}
        value={apiKeys.length}
        description={t('当前查询返回的密钥总数')}
      />
      <StatCard
        label={t('Enabled')}
        value={enabled.length}
        description={t('当前可用于请求流量')}
        tone='success'
      />
      <StatCard
        label={t('Quota-limited')}
        value={limited.length}
        description={t('需要按有限额度跟踪用量')}
        tone='accent'
      />
      <StatCard
        label={t('Exhausted')}
        value={exhausted.length}
        description={t('因额度耗尽或过期而不可用')}
        tone={exhausted.length > 0 ? 'warning' : 'default'}
      />
    </div>
  )
}
