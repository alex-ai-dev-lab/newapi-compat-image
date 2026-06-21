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
import { useForm, useWatch } from 'react-hook-form'
import { ArrowDown, ArrowUp, Download, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  FormLabel,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
  SIDEBAR_MODULES_DEFAULT,
  SIDEBAR_SECTION_ORDER_DEFAULT,
  type SidebarModulesAdminConfig,
  getSidebarSectionOrder,
  parseSidebarModulesAdmin,
  parseSidebarSectionOrder,
  serializeSidebarModulesAdmin,
  serializeSidebarSectionOrder,
} from './config'

type SidebarModulesSectionProps = {
  config: SidebarModulesAdminConfig
  initialSerialized: string
  sectionOrder: string[]
  initialSectionOrderSerialized: string
}

type SidebarFormValues = SidebarModulesAdminConfig

type SidebarImportExportPayload = {
  SidebarModulesAdmin?: SidebarModulesAdminConfig | string
  SidebarSectionOrder?: string | string[]
}

const toTitleCase = (value: string) =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

export function SidebarModulesSection({
  config,
  initialSerialized,
  sectionOrder,
  initialSectionOrderSerialized,
}: SidebarModulesSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const sectionMeta: Record<string, { title: string; description: string }> = {
    chat: {
      title: t('Chat area'),
      description: t('Playground experiments and live conversations.'),
    },
    console: {
      title: t('Console area'),
      description: t('Dashboards, tokens, and usage analytics.'),
    },
    personal: {
      title: t('Personal area'),
      description: t('Wallet management and personal preferences.'),
    },
    admin: {
      title: t('Admin area'),
      description: t('Global configuration and administrative tools.'),
    },
  }

  const moduleMeta: Record<
    string,
    Record<string, { title: string; description: string }>
  > = {
    chat: {
      playground: {
        title: t('Playground'),
        description: t('Experiment with prompts and models in real time.'),
      },
      chat: {
        title: t('Chat'),
        description: t('Access previous conversations and start new ones.'),
      },
    },
    console: {
      detail: {
        title: t('Dashboard'),
        description: t('Aggregated usage metrics and trend charts.'),
      },
      token: {
        title: t('Token management'),
        description: t('Create, revoke, and audit API tokens.'),
      },
      log: {
        title: t('Usage logs'),
        description: t('Detailed request logs for investigations.'),
      },
      midjourney: {
        title: t('Drawing logs'),
        description: t('History of Midjourney-style image tasks.'),
      },
      task: {
        title: t('Task logs'),
        description: t('Background job tracker for queued work.'),
      },
    },
    personal: {
      topup: {
        title: t('Wallet'),
        description: t('Top up balance and view billing history.'),
      },
      personal: {
        title: t('Profile'),
        description: t('Personal settings and profile management.'),
      },
    },
    admin: {
      channel: {
        title: t('Channels'),
        description: t('Configure upstream providers and routing.'),
      },
      models: {
        title: t('Models'),
        description: t('Manage catalog visibility and pricing.'),
      },
      redemption: {
        title: t('Redeem codes'),
        description: t('Create and review invite or credit codes.'),
      },
      user: {
        title: t('Users'),
        description: t('Administer user accounts and roles.'),
      },
      setting: {
        title: t('System settings'),
        description: t('Advanced platform configuration.'),
      },
      subscription: {
        title: t('Subscription Management'),
        description: t('Manage subscription plans and pricing.'),
      },
    },
  }
  const formDefaults = useMemo(() => config, [config])
  const [currentSectionOrder, setCurrentSectionOrder] =
    useState<string[]>(sectionOrder)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const form = useForm<SidebarFormValues>({
    defaultValues: formDefaults,
  })
  const watchedConfig = useWatch({ control: form.control }) as
    | SidebarFormValues
    | undefined

  useEffect(() => {
    form.reset(formDefaults)
  }, [formDefaults, form])

  useEffect(() => {
    setCurrentSectionOrder(sectionOrder)
  }, [sectionOrder])

  const onSubmit = async (values: SidebarFormValues) => {
    const serialized = serializeSidebarModulesAdmin(values)
    const sectionOrderSerialized = serializeSidebarSectionOrder(
      currentSectionOrder,
      Object.keys(values)
    )

    if (
      serialized === initialSerialized &&
      sectionOrderSerialized === initialSectionOrderSerialized
    ) {
      return
    }

    if (serialized !== initialSerialized) {
      await updateOption.mutateAsync({
        key: 'SidebarModulesAdmin',
        value: serialized,
      })
    }

    if (sectionOrderSerialized !== initialSectionOrderSerialized) {
      await updateOption.mutateAsync({
        key: 'SidebarSectionOrder',
        value: sectionOrderSerialized,
      })
    }
  }

  const resetToDefault = () => {
    form.reset(SIDEBAR_MODULES_DEFAULT)
    setCurrentSectionOrder(SIDEBAR_SECTION_ORDER_DEFAULT)
  }

  const buildExportPayload = () => {
    const currentConfig = form.getValues()
    const serialized = serializeSidebarModulesAdmin(currentConfig)
    const availableSections = Object.keys(currentConfig)
    return {
      SidebarModulesAdmin: JSON.parse(serialized) as SidebarModulesAdminConfig,
      SidebarSectionOrder: serializeSidebarSectionOrder(
        currentSectionOrder,
        availableSections
      ),
    }
  }

  const exportConfig = async () => {
    const payload = buildExportPayload()
    const text = JSON.stringify(payload, null, 2)
    try {
      await navigator.clipboard?.writeText(text)
    } catch {
      /* Clipboard can be unavailable on non-secure origins. */
    }

    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'renewapi-sidebar-modules.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('Sidebar configuration exported'))
  }

  const openImportDialog = () => {
    setImportText('')
    setImportOpen(true)
  }

  const importConfig = () => {
    try {
      const raw = JSON.parse(importText) as SidebarImportExportPayload
      const rawModules = raw.SidebarModulesAdmin ?? raw
      const importedConfig =
        typeof rawModules === 'string'
          ? parseSidebarModulesAdmin(rawModules)
          : parseSidebarModulesAdmin(JSON.stringify(rawModules))
      const availableSections = Object.keys(importedConfig)
      const importedOrder = Array.isArray(raw.SidebarSectionOrder)
        ? raw.SidebarSectionOrder.join(',')
        : raw.SidebarSectionOrder

      form.reset(importedConfig)
      setCurrentSectionOrder(
        parseSidebarSectionOrder(importedOrder, availableSections)
      )
      setImportOpen(false)
      toast.success(t('Sidebar configuration imported'))
    } catch {
      toast.error(t('Invalid sidebar configuration JSON'))
    }
  }

  const moveSection = (sectionKey: string, direction: 'up' | 'down') => {
    const availableSections = Object.keys(form.getValues())
    const order = parseSidebarSectionOrder(
      currentSectionOrder.join(','),
      availableSections
    )
    const currentIndex = order.indexOf(sectionKey)
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length) {
      return
    }

    const nextOrder = [...order]
    ;[nextOrder[currentIndex], nextOrder[nextIndex]] = [
      nextOrder[nextIndex],
      nextOrder[currentIndex],
    ]
    setCurrentSectionOrder(nextOrder)
  }

  const moveModule = (
    sectionKey: string,
    moduleKey: string,
    direction: 'up' | 'down'
  ) => {
    const sectionConfig = form.getValues(
      sectionKey as keyof SidebarFormValues
    ) as SidebarFormValues[string]
    if (!sectionConfig) return

    const order = getSidebarSectionOrder(sectionConfig)
    const currentIndex = order.indexOf(moduleKey)
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length) {
      return
    }

    const nextOrder = [...order]
    ;[nextOrder[currentIndex], nextOrder[nextIndex]] = [
      nextOrder[nextIndex],
      nextOrder[currentIndex],
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.setValue(`${sectionKey}.order` as any, nextOrder, {
      shouldDirty: true,
      shouldTouch: true,
    })
  }

  const activeConfig = watchedConfig ?? config
  const sections = parseSidebarSectionOrder(
    currentSectionOrder.join(','),
    Object.keys(activeConfig)
  )
    .map((sectionKey) => [sectionKey, activeConfig[sectionKey]] as const)
    .filter(([, sectionConfig]) => Boolean(sectionConfig))

  return (
    <SettingsSection title={t('Sidebar modules')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            onReset={resetToDefault}
            isSaving={updateOption.isPending}
            resetLabel='Reset to default'
            saveLabel='Save sidebar modules'
          />
          <div className='flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <p className='text-sm font-medium'>{t('Import / export')}</p>
              <p className='text-muted-foreground mt-1 text-sm'>
                {t('Backup or restore sidebar visibility and ordering as JSON.')}
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
          {sections.map(([sectionKey, sectionConfig], sectionIndex) => {
            const sectionInfo = sectionMeta[sectionKey] ?? {
              title: toTitleCase(sectionKey),
              description: t('Custom sidebar section'),
            }
            const modules = getSidebarSectionOrder(sectionConfig).filter(
              (moduleKey) => typeof sectionConfig[moduleKey] === 'boolean'
            )

            return (
              <SettingsControlGroup key={sectionKey}>
                <FormField
                  control={form.control}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  name={`${sectionKey}.enabled` as any}
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{sectionInfo.title}</FormLabel>
                        <FormDescription>
                          {sectionInfo.description}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <div className='flex shrink-0 items-center gap-1'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-sm'
                            aria-label={t('Move section up')}
                            title={t('Move section up')}
                            disabled={sectionIndex === 0}
                            onClick={() => moveSection(sectionKey, 'up')}
                          >
                            <ArrowUp className='h-4 w-4' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-sm'
                            aria-label={t('Move section down')}
                            title={t('Move section down')}
                            disabled={sectionIndex === sections.length - 1}
                            onClick={() => moveSection(sectionKey, 'down')}
                          >
                            <ArrowDown className='h-4 w-4' />
                          </Button>
                          <Switch
                            checked={Boolean(field.value)}
                            onCheckedChange={field.onChange}
                          />
                        </div>
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <SettingsControlChildren className='grid gap-3 md:grid-cols-2'>
                  {modules.map((moduleKey, moduleIndex) => {
                    const moduleInfo = moduleMeta[sectionKey]?.[moduleKey] ?? {
                      title: toTitleCase(moduleKey),
                      description: t('Custom module'),
                    }
                    return (
                      <FormField
                        key={`${sectionKey}.${moduleKey}`}
                        control={form.control}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        name={`${sectionKey}.${moduleKey}` as any}
                        render={({ field }) => (
                          <SettingsSwitchItem className='border-b-0 py-2'>
                            <SettingsSwitchContent>
                              <FormLabel>{moduleInfo.title}</FormLabel>
                              <FormDescription>
                                {moduleInfo.description}
                              </FormDescription>
                            </SettingsSwitchContent>
                            <FormControl>
                              <div className='flex shrink-0 items-center gap-1'>
                                <Button
                                  type='button'
                                  variant='ghost'
                                  size='icon-sm'
                                  aria-label={t('Move up')}
                                  title={t('Move up')}
                                  disabled={moduleIndex === 0}
                                  onClick={() =>
                                    moveModule(sectionKey, moduleKey, 'up')
                                  }
                                >
                                  <ArrowUp className='h-4 w-4' />
                                </Button>
                                <Button
                                  type='button'
                                  variant='ghost'
                                  size='icon-sm'
                                  aria-label={t('Move down')}
                                  title={t('Move down')}
                                  disabled={moduleIndex === modules.length - 1}
                                  onClick={() =>
                                    moveModule(sectionKey, moduleKey, 'down')
                                  }
                                >
                                  <ArrowDown className='h-4 w-4' />
                                </Button>
                                <Switch
                                  checked={Boolean(field.value)}
                                  onCheckedChange={field.onChange}
                                  disabled={
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    !form.watch(`${sectionKey}.enabled` as any)
                                  }
                                />
                              </div>
                            </FormControl>
                          </SettingsSwitchItem>
                        )}
                      />
                    )
                  })}
                </SettingsControlChildren>
              </SettingsControlGroup>
            )
          })}
        </SettingsForm>
      </Form>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{t('Import sidebar configuration')}</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={12}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder='{ "SidebarModulesAdmin": {}, "SidebarSectionOrder": "chat,console,personal,admin" }'
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
