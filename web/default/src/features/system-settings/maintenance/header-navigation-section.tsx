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
import { useEffect, useMemo, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  SettingsControlChildren,
  SettingsForm,
  SettingsSwitchContent,
  SettingsControlGroup,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  HEADER_NAV_DEFAULT,
  HEADER_NAV_ORDER_DEFAULT,
  type HeaderNavModulesConfig,
  normalizeHeaderNavOrder,
  parseHeaderNavModules,
  serializeHeaderNavModules,
} from './config'
import { Textarea } from '@/components/ui/textarea'

const headerNavSchema = z.object({
  home: z.boolean(),
  console: z.boolean(),
  pricingEnabled: z.boolean(),
  pricingRequireAuth: z.boolean(),
  rankingsEnabled: z.boolean(),
  rankingsRequireAuth: z.boolean(),
  docs: z.boolean(),
  docsLink: z.string(),
  about: z.boolean(),
})

type HeaderNavFormValues = z.infer<typeof headerNavSchema>
type HeaderNavBooleanKey = Exclude<keyof HeaderNavFormValues, 'docsLink'>
type HeaderNavOrderKey = (typeof HEADER_NAV_ORDER_DEFAULT)[number]

type HeaderNavigationSectionProps = {
  config: HeaderNavModulesConfig
  initialSerialized: string
  docsLink: string
}

type HeaderNavImportExportPayload = {
  HeaderNavModules?: HeaderNavModulesConfig | string
  docs_link?: string
  'general_setting.docs_link'?: string
}

const toFormValues = (
  config: HeaderNavModulesConfig,
  docsLink = ''
): HeaderNavFormValues => ({
  home:
    config.home === undefined ? HEADER_NAV_DEFAULT.home : Boolean(config.home),
  console:
    config.console === undefined
      ? HEADER_NAV_DEFAULT.console
      : Boolean(config.console),
  pricingEnabled:
    config.pricing?.enabled === undefined
      ? HEADER_NAV_DEFAULT.pricing.enabled
      : Boolean(config.pricing.enabled),
  pricingRequireAuth:
    config.pricing?.requireAuth === undefined
      ? HEADER_NAV_DEFAULT.pricing.requireAuth
      : Boolean(config.pricing.requireAuth),
  rankingsEnabled:
    config.rankings?.enabled === undefined
      ? HEADER_NAV_DEFAULT.rankings.enabled
      : Boolean(config.rankings.enabled),
  rankingsRequireAuth:
    config.rankings?.requireAuth === undefined
      ? HEADER_NAV_DEFAULT.rankings.requireAuth
      : Boolean(config.rankings.requireAuth),
  docs:
    config.docs === undefined ? HEADER_NAV_DEFAULT.docs : Boolean(config.docs),
  docsLink,
  about:
    config.about === undefined
      ? HEADER_NAV_DEFAULT.about
      : Boolean(config.about),
})

export function HeaderNavigationSection({
  config,
  initialSerialized,
  docsLink,
}: HeaderNavigationSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const formDefaults = useMemo(
    () => toFormValues(config, docsLink),
    [config, docsLink]
  )
  const [headerOrder, setHeaderOrder] = useState<HeaderNavOrderKey[]>(
    normalizeHeaderNavOrder(config.order)
  )
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const form = useForm<HeaderNavFormValues>({
    resolver: zodResolver(headerNavSchema),
    defaultValues: formDefaults,
  })

  useEffect(() => {
    form.reset(formDefaults)
    setHeaderOrder(normalizeHeaderNavOrder(config.order))
  }, [config.order, formDefaults, form])

  const buildPayload = (values: HeaderNavFormValues): HeaderNavModulesConfig => {
    return {
      ...config,
      order: normalizeHeaderNavOrder(headerOrder),
      home: values.home,
      console: values.console,
      docs: values.docs,
      about: values.about,
      pricing: {
        ...(config.pricing ?? HEADER_NAV_DEFAULT.pricing),
        enabled: values.pricingEnabled,
        requireAuth: values.pricingRequireAuth,
      },
      rankings: {
        ...(config.rankings ?? HEADER_NAV_DEFAULT.rankings),
        enabled: values.rankingsEnabled,
        requireAuth: values.rankingsRequireAuth,
      },
    }
  }

  const onSubmit = async (values: HeaderNavFormValues) => {
    const payload = buildPayload(values)
    const serialized = serializeHeaderNavModules(payload)
    const nextDocsLink = values.docsLink.trim()
    const docsLinkChanged = nextDocsLink !== docsLink

    if (serialized === initialSerialized && !docsLinkChanged) {
      return
    }

    if (serialized !== initialSerialized) {
      await updateOption.mutateAsync({
        key: 'HeaderNavModules',
        value: serialized,
      })
    }

    if (docsLinkChanged) {
      await updateOption.mutateAsync({
        key: 'general_setting.docs_link',
        value: nextDocsLink,
      })
    }
  }

  const resetToDefault = () => {
    form.reset(toFormValues(HEADER_NAV_DEFAULT, ''))
    setHeaderOrder(normalizeHeaderNavOrder(HEADER_NAV_DEFAULT.order))
  }

  const exportConfig = async () => {
    const values = form.getValues()
    const payload = buildPayload(values)
    const text = JSON.stringify(
      {
        HeaderNavModules: JSON.parse(serializeHeaderNavModules(payload)),
        docs_link: values.docsLink.trim(),
      },
      null,
      2
    )

    try {
      await navigator.clipboard?.writeText(text)
    } catch {
      /* Clipboard can be unavailable on non-secure origins. */
    }

    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'newapi-header-navigation.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('Header navigation exported'))
  }

  const openImportDialog = () => {
    setImportText('')
    setImportOpen(true)
  }

  const importConfig = () => {
    try {
      const raw = JSON.parse(importText) as HeaderNavImportExportPayload
      const rawModules =
        raw.HeaderNavModules ??
        Object.fromEntries(
          Object.entries(raw).filter(
            ([key]) => key !== 'docs_link' && key !== 'general_setting.docs_link'
          )
        )
      const importedConfig =
        typeof rawModules === 'string'
          ? parseHeaderNavModules(rawModules)
          : parseHeaderNavModules(JSON.stringify(rawModules))
      const importedDocsLink =
        raw.docs_link ??
        raw['general_setting.docs_link'] ??
        form.getValues().docsLink

      form.reset(toFormValues(importedConfig, importedDocsLink))
      setHeaderOrder(normalizeHeaderNavOrder(importedConfig.order))
      setImportOpen(false)
      toast.success(t('Header navigation imported'))
    } catch {
      toast.error(t('Invalid header navigation JSON'))
    }
  }

  const moveHeaderModule = (moduleKey: HeaderNavOrderKey, direction: -1 | 1) => {
    setHeaderOrder((current) => {
      const next = normalizeHeaderNavOrder(current)
      const currentIndex = next.indexOf(moduleKey)
      const targetIndex = currentIndex + direction
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= next.length) {
        return next
      }
      const [item] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, item)
      return next
    })
  }

  const simpleModules: Array<{
    key: HeaderNavBooleanKey
    title: string
    description: string
  }> = [
    {
      key: 'home',
      title: t('Home'),
      description: t('Landing page with system overview.'),
    },
    {
      key: 'console',
      title: t('Console'),
      description: t('User dashboard and quota controls.'),
    },
    {
      key: 'docs',
      title: t('Docs'),
      description: t('Documentation or external knowledge base.'),
    },
    {
      key: 'about',
      title: t('About'),
      description: t('Static page describing the platform.'),
    },
  ]

  const accessModules: Array<{
    enabledKey: HeaderNavBooleanKey
    requireAuthKey: HeaderNavBooleanKey
    requireAuthDependsOn: 'pricingEnabled' | 'rankingsEnabled'
    title: string
    description: string
    requireAuthTitle: string
    requireAuthDescription: string
  }> = [
    {
      enabledKey: 'pricingEnabled',
      requireAuthKey: 'pricingRequireAuth',
      requireAuthDependsOn: 'pricingEnabled',
      title: t('Model Square'),
      description: t('Public model catalog and pricing page.'),
      requireAuthTitle: t('Require login to view models'),
      requireAuthDescription: t(
        'Visitors must authenticate before accessing the pricing directory.'
      ),
    },
    {
      enabledKey: 'rankingsEnabled',
      requireAuthKey: 'rankingsRequireAuth',
      requireAuthDependsOn: 'rankingsEnabled',
      title: t('Rankings'),
      description: t('Public rankings page based on live usage data.'),
      requireAuthTitle: t('Require login to view rankings'),
      requireAuthDescription: t(
        'Visitors must authenticate before accessing the rankings page.'
      ),
    },
  ]

  const orderLabels: Record<HeaderNavOrderKey, string> = {
    home: t('Home'),
    console: t('Console'),
    pricing: t('Model Square'),
    rankings: t('Rankings'),
    docs: t('Docs'),
    about: t('About'),
  }

  return (
    <SettingsSection title={t('Header navigation')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            onReset={resetToDefault}
            isSaving={updateOption.isPending}
            resetLabel='Reset to default'
            saveLabel='Save navigation'
          />
          <div className='flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <p className='text-sm font-medium'>{t('Import / export')}</p>
              <p className='text-muted-foreground mt-1 text-sm'>
                {t('Backup or restore top navigation modules, order, and Docs URL as JSON.')}
              </p>
            </div>
            <div className='flex shrink-0 gap-2'>
              <Button type='button' variant='outline' onClick={exportConfig}>
                <Download className='mr-2 h-4 w-4' />
                {t('Export JSON')}
              </Button>
              <Button type='button' variant='outline' onClick={openImportDialog}>
                <Upload className='mr-2 h-4 w-4' />
                {t('Import JSON')}
              </Button>
            </div>
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            {simpleModules.map((module) => (
              <FormField
                key={module.key}
                control={form.control}
                name={module.key}
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{module.title}</FormLabel>
                      <FormDescription>{module.description}</FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </SettingsSwitchItem>
                )}
              />
            ))}
          </div>

          <FormField
            control={form.control}
            name='docsLink'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Documentation URL')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('https://docs.example.com')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Used by the top navigation Docs link and default footer documentation links.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='space-y-3 rounded-lg border p-4'>
            <div>
              <p className='text-sm font-medium'>{t('Navigation order')}</p>
              <p className='text-muted-foreground mt-1 text-sm'>
                {t('Controls the left-to-right order of enabled top navigation modules.')}
              </p>
            </div>
            <div className='grid gap-2'>
              {headerOrder.map((moduleKey, index) => (
                <div
                  key={moduleKey}
                  className='flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2'
                >
                  <div className='min-w-0'>
                    <p className='text-sm font-medium'>
                      {index + 1}. {orderLabels[moduleKey] ?? moduleKey}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {moduleKey}
                    </p>
                  </div>
                  <div className='flex shrink-0 gap-1'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      disabled={index === 0}
                      onClick={() => moveHeaderModule(moduleKey, -1)}
                    >
                      <ArrowUp className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      disabled={index === headerOrder.length - 1}
                      onClick={() => moveHeaderModule(moduleKey, 1)}
                    >
                      <ArrowDown className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className='grid gap-4 lg:grid-cols-2'>
            {accessModules.map((module) => (
              <SettingsControlGroup key={module.enabledKey}>
                <FormField
                  control={form.control}
                  name={module.enabledKey}
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{module.title}</FormLabel>
                        <FormDescription>{module.description}</FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </SettingsSwitchItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={module.requireAuthKey}
                  render={({ field }) => (
                    <SettingsControlChildren>
                      <SettingsSwitchItem className='border-b-0 py-2'>
                        <SettingsSwitchContent>
                          <FormLabel>{module.requireAuthTitle}</FormLabel>
                          <FormDescription>
                            {module.requireAuthDescription}
                          </FormDescription>
                        </SettingsSwitchContent>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!form.watch(module.requireAuthDependsOn)}
                          />
                        </FormControl>
                        <FormMessage />
                      </SettingsSwitchItem>
                    </SettingsControlChildren>
                  )}
                />
              </SettingsControlGroup>
            ))}
          </div>
        </SettingsForm>
      </Form>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{t('Import header navigation')}</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={12}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder='{ "HeaderNavModules": {}, "docs_link": "https://docs.example.com" }'
            className='font-mono text-xs'
          />
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setImportOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button type='button' onClick={importConfig}>
              {t('Import')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  )
}
