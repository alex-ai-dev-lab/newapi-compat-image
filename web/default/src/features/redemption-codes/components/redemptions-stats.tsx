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
import { REDEMPTION_STATUS } from '../constants'
import { isRedemptionExpired } from '../lib'
import type { Redemption } from '../types'

export function RedemptionsStats({
  redemptions,
}: {
  redemptions: Redemption[]
}) {
  const { t } = useTranslation()
  const expired = redemptions.filter((item) =>
    isRedemptionExpired(item.expired_time, item.status)
  )
  const used = redemptions.filter((item) => item.status === REDEMPTION_STATUS.USED)
  const available = redemptions.filter(
    (item) =>
      item.status === REDEMPTION_STATUS.ENABLED &&
      !isRedemptionExpired(item.expired_time, item.status)
  )

  return (
    <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
      <StatCard
        label={t('Total Codes')}
        value={redemptions.length}
        description={t('当前筛选结果中的兑换码总数')}
      />
      <StatCard
        label={t('Unused')}
        value={available.length}
        description={t('仍可被兑换的兑换码')}
        tone='success'
      />
      <StatCard
        label={t('Used')}
        value={used.length}
        description={t('已经被用户兑换')}
        tone='accent'
      />
      <StatCard
        label={t('Expired')}
        value={expired.length}
        description={t('已过期或不再可兑换')}
        tone={expired.length > 0 ? 'warning' : 'default'}
      />
    </div>
  )
}
