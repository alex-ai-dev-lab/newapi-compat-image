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
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

const ENDPOINT_CYCLE = [
  ['routing', '/v1/chat/completions'],
  ['routing', '/v1/responses'],
  ['routing', '/v1/messages'],
  ['embedding', '/v1/embeddings'],
  ['rendering', '/v1/images/generations'],
] as const

interface IzHeroProps {
  isAuthenticated?: boolean
}

export function IzHero(props: IzHeroProps) {
  const { t } = useTranslation()
  const [endpointIdx, setEndpointIdx] = useState(0)
  const [copied, setCopied] = useState(false)
  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/v1`
      : 'https://router.108848.xyz:1443/v1'

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return
    const id = setInterval(() => {
      setEndpointIdx((p) => (p + 1) % ENDPOINT_CYCLE.length)
    }, 2400)
    return () => clearInterval(id)
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
    <section className='iz-hero' id='top'>
      <div className='iz-blueprint' aria-hidden />
      <div className='iz-wrap'>
        <div className='iz-hero-top'>
          <span className='iz-label iz-hero-meta'>
            <span className='iz-dot' aria-hidden />
            {t('Unified AI Gateway')}
          </span>
          <span className='iz-label'>Ref. IZ - 001</span>
        </div>

        <div className='iz-eyebrow'>
          <span className='iz-eyebrow-line' />
          {t('One API for all of them')}
        </div>
        <h1 className='iz-hero-heading'>
          {t('One endpoint, for every model.')}
        </h1>

        <div className='iz-hero-cycle'>
          <span className='iz-hero-cycle-tag'>
            <b>{t(ENDPOINT_CYCLE[endpointIdx][0])}</b>
            <span key={endpointIdx}>{ENDPOINT_CYCLE[endpointIdx][1]}</span>
          </span>
          <span>{t('now live')}</span>
        </div>

        <div className='iz-hero-grid'>
          <div>
            <p className='iz-hero-sub'>
              {t(
                'A unified, reliable, high-speed AI API gateway. Native support for OpenAI Chat, Responses and Claude Messages — keep your existing SDK, just swap one line: the Base URL.'
              )}
            </p>
            <div className='iz-hero-actions'>
              {props.isAuthenticated ? (
                <Button
                  className='iz-button iz-button-light iz-button-lg group'
                  render={<Link to='/dashboard' />}
                >
                  {t('Open Dashboard')}
                  <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
              ) : (
                <>
                  <Button
                    className='iz-button iz-button-light iz-button-lg group'
                    render={<Link to='/sign-up' />}
                  >
                    {t('Get Started')}
                    <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
                  </Button>
                  <a className='iz-text-link iz-text-link-light' href='#models'>
                    {t('Browse all models')}
                  </a>
                </>
              )}
            </div>
          </div>

          <div className='iz-baseurl'>
            <div className='iz-baseurl-label'>BASE URL</div>
            <div className='iz-baseurl-row'>
              <span className='iz-baseurl-value' title={baseUrl}>
                {baseUrl.replace('/v1', '')}
                <span>/v1</span>
              </span>
              <button
                type='button'
                onClick={handleCopy}
                className='iz-copy-button'
                aria-label='Copy base URL'
              >
                {copied ? (
                  <Check className='size-4' />
                ) : (
                  <Copy className='size-4' />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className='iz-ledger'>
          <div className='iz-ledger-item'>
            <div className='iz-ledger-value'>
              240<small>ms</small>
            </div>
            <div className='iz-ledger-key'>{t('P50 Latency')}</div>
          </div>
          <div className='iz-ledger-item'>
            <div className='iz-ledger-value'>
              99.9<small>%</small>
            </div>
            <div className='iz-ledger-key'>{t('Uptime')}</div>
          </div>
          <div className='iz-ledger-item'>
            <div className='iz-ledger-value'>
              50<small>+</small>
            </div>
            <div className='iz-ledger-key'>{t('Upstream Providers')}</div>
          </div>
          <div className='iz-ledger-item'>
            <div className='iz-ledger-value'>6</div>
            <div className='iz-ledger-key'>{t('Native Protocols')}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
