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
import { useAuthStore } from '@/stores/auth-store'
import { Markdown } from '@/components/ui/markdown'
import { PublicLayout } from '@/components/layout'
import { IzHeader } from './components/sections/iz-header'
import { IzHero } from './components/sections/iz-hero'
import { IzModels } from './components/sections/iz-models'
import { IzPillars } from './components/sections/iz-pillars'
import { IzRouting } from './components/sections/iz-routing'
import { IzLive } from './components/sections/iz-live'
import { IzProtocols } from './components/sections/iz-protocols'
import { IzQuickstart } from './components/sections/iz-quickstart'
import { IzFaq } from './components/sections/iz-faq'
import { IzClosing } from './components/sections/iz-closing'
import { IzFooter } from './components/sections/iz-footer'
import { useHomePageContent } from './hooks'

export function Home() {
  const { t } = useTranslation()
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user
  const { content, isLoaded, isUrl } = useHomePageContent({
    showErrorToast: false,
  })

  if (!isLoaded) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='flex min-h-screen items-center justify-center'>
          <div className='text-muted-foreground'>{t('Loading...')}</div>
        </main>
      </PublicLayout>
    )
  }

  if (content) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='overflow-x-hidden'>
          {isUrl ? (
            <iframe
              src={content}
              className='h-screen w-full border-none'
              title={t('Custom Home Page')}
            />
          ) : (
            <div className='container mx-auto py-8'>
              <Markdown className='custom-home-content'>{content}</Markdown>
            </div>
          )}
        </main>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout
      showMainContainer={false}
      showHeader={false}
    >
      <IzHeader isAuthenticated={isAuthenticated} />
      <main id='main-content' className='iz-root'>
        <IzHero isAuthenticated={isAuthenticated} />
        <IzModels />
        <IzPillars />
        <IzRouting />
        <IzLive />
        <IzProtocols />
        <IzQuickstart />
        <IzFaq />
        <IzClosing isAuthenticated={isAuthenticated} />
      </main>
      <IzFooter />
    </PublicLayout>
  )
}
