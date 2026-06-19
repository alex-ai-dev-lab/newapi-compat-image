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
import { InlineStatsBar } from '@/components/inline-stats-bar'
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
    <InlineStatsBar
      items={[
        { label: t('Total Codes'), value: redemptions.length },
        { label: t('Unused'), value: available.length, tone: 'success' },
        { label: t('Used'), value: used.length, tone: 'accent' },
        {
          label: t('Expired'),
          value: expired.length,
          tone: expired.length > 0 ? 'destructive' : 'default',
        },
      ]}
    />
  )
}
