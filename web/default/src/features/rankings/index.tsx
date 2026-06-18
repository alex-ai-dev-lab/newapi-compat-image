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
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { EmptyState, PageContainer, StatCard } from '@/components/page-primitives'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import {
  MarketShareSection,
  ModelsSection,
  PulseSection,
  RankingsHero,
} from './components'
import { useRankings } from './hooks/use-rankings'
import type { RankingPeriod } from './types'

const VALID_PERIODS: RankingPeriod[] = ['today', 'week', 'month', 'year', 'all']

export function Rankings() {
  const { t } = useTranslation()
  const search = useSearch({ from: '/rankings/' })
  const navigate = useNavigate()

  const period: RankingPeriod = VALID_PERIODS.includes(
    search.period as RankingPeriod
  )
    ? (search.period as RankingPeriod)
    : 'week'

  const rankingsQuery = useRankings(period)
  const snapshot = rankingsQuery.data?.data

  const handlePeriodChange = (next: RankingPeriod) => {
    navigate({
      to: '/rankings',
      search: (prev) => ({ ...prev, period: next }),
    })
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative'>
        <PageTransition>
          <PageContainer className='pt-16 sm:pt-20'>
          <RankingsHero period={period} onPeriodChange={handlePeriodChange} />

          {rankingsQuery.isLoading ? (
            <RankingsLoading />
          ) : !snapshot ? (
            <RankingsError
              message={
                rankingsQuery.error instanceof Error
                  ? rankingsQuery.error.message
                  : t('Unable to load rankings data')
              }
            />
          ) : (
            <>
              {/* KPI Bar */}
              <div className='grid gap-4 sm:grid-cols-3'>
                <StatCard
                  label={t('Total Tokens')}
                  value={snapshot.models
                    .reduce((sum, m) => sum + m.total_tokens, 0)
                    .toLocaleString()}
                  tone='accent'
                />
                <StatCard
                  label={t('Active Models')}
                  value={snapshot.models.length}
                  tone='default'
                />
                <StatCard
                  label={t('Top Vendor')}
                  value={snapshot.vendors[0]?.vendor || '-'}
                  tone='success'
                />
              </div>

              {/* Side-by-side: Top Models + Market Share */}
              <div className='grid gap-6 xl:grid-cols-2'>
                <ModelsSection
                  history={snapshot.models_history}
                  rows={snapshot.models}
                  period={period}
                />

                <MarketShareSection
                  history={snapshot.vendor_share_history}
                  rows={snapshot.vendors}
                  period={period}
                />
              </div>

              {/* Pulse Section: bottom compact dual cards */}
              <PulseSection
                movers={snapshot.top_movers}
                droppers={snapshot.top_droppers}
              />
            </>
          )}
          </PageContainer>
        </PageTransition>
      </div>
    </PublicLayout>
  )
}

function RankingsLoading() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-[420px] w-full rounded-xl' />
      <Skeleton className='h-[360px] w-full rounded-xl' />
      <Skeleton className='h-[180px] w-full rounded-xl' />
    </div>
  )
}

function RankingsError(props: { message: string }) {
  const { t } = useTranslation()
  return (
    <EmptyState
      title={t('Unable to load rankings')}
      description={props.message}
    />
  )
}
