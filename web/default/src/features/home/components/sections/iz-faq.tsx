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

const FAQS = [
  {
    question: 'Do I need to change my code?',
    answer:
      'No. Keep your existing OpenAI, Anthropic or Gemini SDK and just point the Base URL to this gateway. Streaming, tool calls, embeddings and the Image API behave identically.',
  },
  {
    question: 'How does failover work?',
    answer:
      'Every upstream channel is continuously health-checked at both the channel and channel-model level. When a provider degrades or hits a quota, requests reroute automatically to a healthy channel.',
  },
  {
    question: 'Which providers are supported?',
    answer:
      '50+ upstreams including OpenAI, Anthropic, Google Gemini, DeepSeek, Qwen, Mistral, Meta Llama, xAI, Doubao, Kimi and more through one Base URL and one key.',
  },
  {
    question: 'How are usage and cost tracked?',
    answer:
      'Every request carries trace and token accounting, with model-level usage and cost you can audit in real time from the console.',
  },
]

export function IzFaq() {
  const { t } = useTranslation()

  return (
    <section className='iz-block' id='faq'>
      <div className='iz-wrap'>
        <AnimateInView animation='fade-up'>
          <header className='iz-section-head'>
            <span className='iz-watermark'>06</span>
            <div className='iz-section-left'>
              <span className='iz-index'>06 - FAQ</span>
              <span className='iz-section-tag'>{t('Things you might be wondering')}</span>
            </div>
            <div>
              <h2>{t('A few honest answers.')}</h2>
            </div>
          </header>
        </AnimateInView>

        <AnimateInView animation='fade-up' delay={100}>
          <div className='iz-faq'>
            {FAQS.map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary>
                  {t(item.question)}
                  <span>+</span>
                </summary>
                <div className='iz-faq-answer'>{t(item.answer)}</div>
              </details>
            ))}
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
