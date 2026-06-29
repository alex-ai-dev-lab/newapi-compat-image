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

const ROWS = [
  {
    endpoint: '/v1/chat/completions',
    capability: 'Chat completions with streaming and tool calls',
    provider: 'OpenAI',
  },
  {
    endpoint: '/v1/responses',
    capability: 'Responses API, with reasoning and tool surfaces',
    provider: 'OpenAI',
  },
  {
    endpoint: '/v1/messages',
    capability: 'Claude Messages, streaming and tool use',
    provider: 'Anthropic',
  },
  {
    endpoint: '/v1beta/models',
    capability: 'Gemini generateContent passthrough',
    provider: 'Gemini',
  },
  {
    endpoint: '/v1/embeddings',
    capability: 'Embeddings for any supported model',
    provider: 'OpenAI',
  },
  {
    endpoint: '/v1/images/generations',
    capability: 'Image generation across multiple providers',
    provider: 'Multiple',
  },
]

export function IzProtocols() {
  const { t } = useTranslation()

  return (
    <section className='iz-block' id='protocols'>
      <div className='iz-wrap'>
        <AnimateInView animation='fade-up'>
          <header className='iz-section-head'>
            <span className='iz-watermark'>04</span>
            <div className='iz-section-left'>
              <span className='iz-index'>04 - Protocols</span>
              <span className='iz-section-tag'>{t('One Base URL')}</span>
            </div>
            <div>
              <h2>{t('Every protocol you already use, supported as-is.')}</h2>
              <p className='iz-section-desc'>
                {t(
                  'Point your existing SDK at the gateway and leave your code untouched. We unify streaming, tool calls, image generation and embeddings across every upstream.'
                )}
              </p>
            </div>
          </header>
        </AnimateInView>

        <AnimateInView animation='fade-up' delay={100}>
          <div className='iz-matrix'>
            <div className='iz-matrix-head' aria-hidden>
              <span>Endpoint</span>
              <span>Capability</span>
              <span>Provider</span>
              <span>Status</span>
            </div>
            {ROWS.map((row) => (
              <div className='iz-matrix-row' key={row.endpoint}>
                <div className='iz-matrix-endpoint'>
                  <b>POST</b>
                  {row.endpoint}
                </div>
                <div className='iz-matrix-desc'>{t(row.capability)}</div>
                <div className='iz-matrix-provider'>{row.provider}</div>
                <div className='iz-matrix-status'>
                  <span aria-hidden />
                  {t('Operational')}
                </div>
              </div>
            ))}
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
