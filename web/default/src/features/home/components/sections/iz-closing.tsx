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
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnimateInView } from '@/components/animate-in-view'

interface IzClosingProps {
  isAuthenticated?: boolean
}

export function IzClosing(props: IzClosingProps) {
  const { t } = useTranslation()

  return (
    <section className='iz-closing'>
      <div className='iz-closing-bg' aria-hidden />
      <div className='iz-closing-grid' aria-hidden />
      <div className='iz-closing-inner'>
        <AnimateInView animation='fade-up'>
          <p className='iz-closing-kicker'>
            <span className='iz-closing-kicker-dot' />
            {t('Ready when you are')}
          </p>
          <h2 className='iz-closing-title'>
            {t('Replace your base URL. Keep your stack.')}
          </h2>
          <p className='iz-closing-sub'>
            {t(
              'Issue an API key in under a minute. Bring your own models, your own SDK, your own workflow.'
            )}
          </p>
          <div className='iz-closing-cta'>
            {props.isAuthenticated ? (
              <Button className='iz-btn iz-btn-primary group' render={<Link to='/dashboard' />}>
                {t('Open Dashboard')}
                <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
            ) : (
              <>
                <Button className='iz-btn iz-btn-primary group' render={<Link to='/sign-up' />}>
                  {t('Create your key')}
                  <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                <Button
                  variant='outline'
                  className='iz-btn iz-btn-ghost'
                  render={<Link to='/pricing' />}
                >
                  {t('Browse models')}
                </Button>
              </>
            )}
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
