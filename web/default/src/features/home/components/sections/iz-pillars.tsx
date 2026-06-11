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
import { Zap, ShieldCheck, Activity, Layers } from 'lucide-react'
import { AnimateInView } from '@/components/animate-in-view'

interface Pillar {
  icon: React.ReactNode
  title: string
  desc: string
  meta: string
}

export function IzPillars() {
  const { t } = useTranslation()

  const pillars: Pillar[] = [
    {
      icon: <Zap className='size-4' strokeWidth={1.6} />,
      title: t('Low latency by design'),
      desc: t(
        'Anycast edge entry, persistent upstream connections, zero-copy streaming. Built for long-running agent loops.'
      ),
      meta: 'p50 · 240ms',
    },
    {
      icon: <ShieldCheck className='size-4' strokeWidth={1.6} />,
      title: t('Stable under pressure'),
      desc: t(
        'Per-channel health checks, automatic failover and quota-aware retry — clients see one consistent endpoint.'
      ),
      meta: '99.9% SLO',
    },
    {
      icon: <Layers className='size-4' strokeWidth={1.6} />,
      title: t('Drop-in compatible'),
      desc: t(
        'Native OpenAI Chat & Responses, Claude Messages, Gemini and image APIs — keep your SDK, swap only the base URL.'
      ),
      meta: '6 protocols',
    },
    {
      icon: <Activity className='size-4' strokeWidth={1.6} />,
      title: t('Full observability'),
      desc: t(
        'Per-request traces, token accounting, model-level usage and cost. Audit anything that flows through the gateway.'
      ),
      meta: 'Real-time',
    },
  ]

  return (
    <section className='iz-pillars'>
      <div className='iz-pillars-inner'>
        <AnimateInView animation='fade-up'>
          <header className='iz-section-head'>
            <span className='iz-section-kicker'>
              <span className='iz-section-kicker-dot' />
              {t('Principles')}
            </span>
            <h2 className='iz-section-title'>
              {t('Built for serious, long-running AI workloads.')}
            </h2>
            <p className='iz-section-sub'>
              {t(
                'A focused set of guarantees: low and predictable latency, resilience under failure, and a single contract across every upstream provider.'
              )}
            </p>
          </header>
        </AnimateInView>

        <div className='iz-pillar-grid'>
          {pillars.map((p, i) => (
            <AnimateInView
              key={i}
              animation='fade-up'
              delay={i * 80}
              className='iz-pillar-cell'
            >
              <article className='iz-pillar'>
                <span className='iz-pillar-icon'>{p.icon}</span>
                <h3 className='iz-pillar-title'>{p.title}</h3>
                <p className='iz-pillar-desc'>{p.desc}</p>
                <span className='iz-pillar-meta'>{p.meta}</span>
                <span className='iz-pillar-glow' aria-hidden />
              </article>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
