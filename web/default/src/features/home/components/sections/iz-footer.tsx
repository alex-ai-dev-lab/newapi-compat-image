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

const COLUMNS = [
  {
    title: 'Product',
    links: [
      ['Models', '#models'],
      ['Routing', '#routing'],
      ['Live status', '#live'],
      ['Protocols', '#protocols'],
    ],
  },
  {
    title: 'Developers',
    links: [
      ['Docs', 'https://router.108848.xyz:1445/'],
      ['API reference', '#protocols'],
      ['Status page', '#live'],
      ['Changelog', 'https://github.com/alex-ai-dev-lab/renewapi/releases'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About', '/about'],
      ['Terms', '/user-agreement'],
      ['Privacy', '/privacy-policy'],
    ],
  },
]

export function IzFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className='iz-footer'>
      <div className='iz-wrap'>
        <div className='iz-footer-grid'>
          <div>
            <div className='iz-site-brand iz-footer-brand'>
              Interface Zero <span>v1</span>
            </div>
            <p>
              {t(
                'A unified, reliable, high-speed AI API gateway. One endpoint, every model.'
              )}
            </p>
          </div>
          {COLUMNS.map((column) => (
            <div className='iz-footer-column' key={column.title}>
              <h4>{t(column.title)}</h4>
              {column.links.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noreferrer' : undefined}
                >
                  {t(label)}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className='iz-footer-bottom'>
          <span>© {year} INTERFACE ZERO</span>
          <span>{t('All systems operational')}</span>
        </div>
      </div>
    </footer>
  )
}
