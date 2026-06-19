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
import { USER_STATUS, isUserDeleted } from '../constants'
import type { User } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

export function UsersStats({ users }: { users: User[] }) {
  const { t } = useTranslation()
  const now = Date.now()
  const disabledUsers = users.filter(
    (user) => isUserDeleted(user) || user.status === USER_STATUS.DISABLED
  )
  const newToday = users.filter((user) => {
    if (!user.created_at) return false
    return now - user.created_at * 1000 < DAY_MS
  })

  return (
    <div className='grid grid-cols-3 gap-3'>
      <StatCard
        label={t('Total Users')}
        value={users.length}
      />
      <StatCard
        label={t('New Today')}
        value={newToday.length}
        tone='accent'
      />
      <StatCard
        label={t('Disabled')}
        value={disabledUsers.length}
        tone={disabledUsers.length > 0 ? 'warning' : 'default'}
      />
    </div>
  )
}
