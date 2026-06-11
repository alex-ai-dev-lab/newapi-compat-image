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
import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

const ENDPOINT_CYCLE = [
  '/v1/chat/completions',
  '/v1/responses',
  '/v1/messages',
  '/v1beta/models',
  '/v1/embeddings',
  '/v1/images/generations',
]

interface IzHeroProps {
  isAuthenticated?: boolean
}

export function IzHero(props: IzHeroProps) {
  const { t } = useTranslation()
  const [endpointIdx, setEndpointIdx] = useState(0)
  const [copied, setCopied] = useState(false)
  const heroRef = useRef<HTMLElement>(null)
  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://your.gateway'

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return
    const id = setInterval(() => {
      setEndpointIdx((p) => (p + 1) % ENDPOINT_CYCLE.length)
    }, 2400)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return
    let raf = 0
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const x = ((e.clientX - r.left) / r.width) * 100
      const y = ((e.clientY - r.top) / r.height) * 100
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--iz-mx', `${x}%`)
        el.style.setProperty('--iz-my', `${y}%`)
      })
    }
    el.addEventListener('mousemove', onMove)
    return () => {
      el.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(baseUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* noop */
    }
  }

  return (
    <section
      ref={heroRef}
      className='iz-hero'
      style={{ ['--iz-mx' as never]: '50%', ['--iz-my' as never]: '30%' }}
    >
      <div className='iz-hero-bg' aria-hidden />
      <div className='iz-hero-grid' aria-hidden />
      <div className='iz-hero-spot' aria-hidden />
      <div className='iz-hero-noise' aria-hidden />

      <div className='iz-hero-inner'>
        <div className='iz-hero-eyebrow'>
          <span className='iz-hero-dot' />
          <span className='iz-hero-eyebrow-txt'>
            {t('All systems operational')}
          </span>
          <span className='iz-hero-eyebrow-sep' />
          <span className='iz-hero-eyebrow-tag'>v1 · Unified Gateway</span>
        </div>

        <h1 className='iz-hero-title'>
          <span className='iz-hero-title-line iz-hero-title-line-1'>
            <span className='iz-hero-title-word'>{t('One')}</span>
            <span className='iz-hero-title-accent'>{t('endpoint.')}</span>
          </span>
          <span className='iz-hero-title-line iz-hero-title-line-2'>
            <span className='iz-hero-title-word'>{t('Every')}</span>
            <span className='iz-hero-title-glow'>{t('model.')}</span>
          </span>
        </h1>

        <p className='iz-hero-sub'>
          {t(
            'A unified, stable, and fast AI API gateway. Compatible with OpenAI Chat, Responses, Claude Messages and more — drop in your existing SDK, change only the base URL.'
          )}
        </p>

        <div className='iz-hero-base'>
          <div className='iz-hero-base-frame'>
            <span className='iz-hero-base-label'>BASE URL</span>
            <span className='iz-hero-base-url' title={baseUrl}>
              {baseUrl}
            </span>
            <span className='iz-hero-base-mount'>
              <span className='iz-hero-base-mount-prefix'>+</span>
              <span key={endpointIdx} className='iz-hero-base-mount-path'>
                {ENDPOINT_CYCLE[endpointIdx]}
              </span>
            </span>
            <button
              type='button'
              onClick={handleCopy}
              className='iz-hero-base-copy'
              aria-label='Copy base URL'
            >
              {copied ? <Check className='size-3.5' /> : <Copy className='size-3.5' />}
            </button>
          </div>
        </div>

        <div className='iz-hero-cta'>
          {props.isAuthenticated ? (
            <Button className='iz-btn iz-btn-primary group' render={<Link to='/dashboard' />}>
              {t('Open Dashboard')}
              <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
          ) : (
            <>
              <Button className='iz-btn iz-btn-primary group' render={<Link to='/sign-up' />}>
                {t('Get Started')}
                <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
              <Button
                variant='outline'
                className='iz-btn iz-btn-ghost'
                render={<Link to='/pricing' />}
              >
                {t('View Models')}
              </Button>
            </>
          )}
        </div>

        <div className='iz-hero-stats'>
          <div className='iz-hero-stat'>
            <span className='iz-hero-stat-num'>~240<i>ms</i></span>
            <span className='iz-hero-stat-lbl'>{t('p50 latency')}</span>
          </div>
          <span className='iz-hero-stat-sep' />
          <div className='iz-hero-stat'>
            <span className='iz-hero-stat-num'>99.9<i>%</i></span>
            <span className='iz-hero-stat-lbl'>{t('uptime')}</span>
          </div>
          <span className='iz-hero-stat-sep' />
          <div className='iz-hero-stat'>
            <span className='iz-hero-stat-num'>50<i>+</i></span>
            <span className='iz-hero-stat-lbl'>{t('upstream providers')}</span>
          </div>
        </div>
      </div>

      <div className='iz-hero-scroll' aria-hidden>
        <span />
      </div>
    </section>
  )
}
