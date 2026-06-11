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
import { AnimateInView } from '@/components/animate-in-view'

const ENDPOINTS = [
  { path: '/v1/chat/completions', tag: 'OpenAI', desc: 'Chat completions, streaming, tool calls.' },
  { path: '/v1/responses', tag: 'OpenAI', desc: 'Responses API with reasoning + tool surface.' },
  { path: '/v1/messages', tag: 'Anthropic', desc: 'Claude Messages, streaming + tool use.' },
  { path: '/v1beta/models', tag: 'Gemini', desc: 'Google Gemini generateContent passthrough.' },
  { path: '/v1/embeddings', tag: 'OpenAI', desc: 'Vector embeddings for any supported model.' },
  { path: '/v1/images/generations', tag: 'OpenAI', desc: 'Image generation, multiple providers.' },
]

export function IzEndpoints() {
  const { t } = useTranslation()

  return (
    <section className='iz-endpoints'>
      <div className='iz-endpoints-inner'>
        <AnimateInView animation='fade-up'>
          <header className='iz-section-head'>
            <span className='iz-section-kicker'>
              <span className='iz-section-kicker-dot' />
              {t('Surface')}
            </span>
            <h2 className='iz-section-title'>
              {t('One base URL. Every protocol you already use.')}
            </h2>
            <p className='iz-section-sub'>
              {t(
                'Point your existing SDK at the gateway and keep your code untouched. We normalize streaming, tool calls, image generation and embeddings across upstreams.'
              )}
            </p>
          </header>
        </AnimateInView>

        <div className='iz-endpoint-grid'>
          {ENDPOINTS.map((e, i) => (
            <AnimateInView
              key={e.path}
              animation='fade-up'
              delay={i * 60}
              className='iz-endpoint-cell'
            >
              <article className='iz-endpoint'>
                <div className='iz-endpoint-head'>
                  <span className='iz-endpoint-method'>POST</span>
                  <span className='iz-endpoint-path' title={e.path}>
                    {e.path}
                  </span>
                </div>
                <p className='iz-endpoint-desc'>{t(e.desc)}</p>
                <div className='iz-endpoint-foot'>
                  <span className='iz-endpoint-tag'>{e.tag}</span>
                  <span className='iz-endpoint-status'>
                    <span className='iz-endpoint-status-dot' />
                    {t('live')}
                  </span>
                </div>
              </article>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
