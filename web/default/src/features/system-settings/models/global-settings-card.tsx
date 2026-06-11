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
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Download, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/status-badge'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import {
  SettingsPageActionsPortal,
  SettingsPageFormActions,
} from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const thinkingBlacklistExample = JSON.stringify(
  ['moonshotai/kimi-k2-thinking', 'kimi-k2-thinking'],
  null,
  2
)

const chatToResponsesPolicyExample = JSON.stringify(
  {
    enabled: true,
    all_channels: false,
    channel_ids: [1, 2],
    model_patterns: ['^gpt-4o.*$', '^gpt-5.*$'],
  },
  null,
  2
)

const chatToResponsesPolicyAllChannelsExample = JSON.stringify(
  {
    enabled: true,
    all_channels: true,
    model_patterns: ['^gpt-4o.*$', '^gpt-5.*$'],
  },
  null,
  2
)

const jsonString = z.string().refine((value) => {
  const trimmed = value.trim()
  if (!trimmed) return true
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}, 'Invalid JSON format')

const schema = z.object({
  global: z.object({
    pass_through_request_enabled: z.boolean(),
    thinking_model_blacklist: jsonString,
    chat_completions_to_responses_policy: jsonString,
  }),
  general_setting: z.object({
    ping_interval_enabled: z.boolean(),
    ping_interval_seconds: z.coerce.number().min(1),
  }),
})

type GlobalModelSettingsFormValues = z.output<typeof schema>
type GlobalModelSettingsFormInput = z.input<typeof schema>

type FlatGlobalModelSettings = {
  'global.pass_through_request_enabled': boolean
  'global.thinking_model_blacklist': string
  'global.chat_completions_to_responses_policy': string
  'general_setting.ping_interval_enabled': boolean
  'general_setting.ping_interval_seconds': number
}

type GlobalModelSettingsPayload = Partial<FlatGlobalModelSettings> & {
  GlobalModelConfiguration?: Partial<FlatGlobalModelSettings>
  global?: Partial<GlobalModelSettingsFormInput['global']>
  general_setting?: Partial<GlobalModelSettingsFormInput['general_setting']>
}

const flattenGlobalValues = (
  values: GlobalModelSettingsFormValues
): FlatGlobalModelSettings => ({
  'global.pass_through_request_enabled':
    values.global.pass_through_request_enabled,
  'global.thinking_model_blacklist': normalizeJsonText(
    values.global.thinking_model_blacklist,
    '[]'
  ),
  'global.chat_completions_to_responses_policy': normalizeJsonText(
    values.global.chat_completions_to_responses_policy,
    '{}'
  ),
  'general_setting.ping_interval_enabled':
    values.general_setting.ping_interval_enabled,
  'general_setting.ping_interval_seconds':
    values.general_setting.ping_interval_seconds,
})

function normalizeJsonText(value: string, fallback: string) {
  const trimmed = (value ?? '').toString().trim()
  return trimmed ? trimmed : fallback
}

function formatJsonText(value: unknown, fallback: string) {
  const raw =
    typeof value === 'string' ? value.trim() : JSON.stringify(value ?? '')
  if (!raw) return fallback
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

type GlobalSettingsCardProps = {
  defaultValues: GlobalModelSettingsFormValues
}

export function GlobalSettingsCard({ defaultValues }: GlobalSettingsCardProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const form = useForm<
    GlobalModelSettingsFormInput,
    unknown,
    GlobalModelSettingsFormValues
  >({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as GlobalModelSettingsFormInput,
  })

  useEffect(() => {
    form.reset(defaultValues as GlobalModelSettingsFormInput)
  }, [defaultValues, form])

  const pingEnabled = form.watch('general_setting.ping_interval_enabled')

  const buildExportPayload = () =>
    flattenGlobalValues(schema.parse(form.getValues()))

  const exportConfig = async () => {
    const text = JSON.stringify(buildExportPayload(), null, 2)

    try {
      await navigator.clipboard?.writeText(text)
    } catch {
      /* Clipboard can be unavailable on non-secure origins. */
    }

    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'newapi-global-model-configuration.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('Global model configuration exported'))
  }

  const importConfig = () => {
    try {
      const raw = JSON.parse(importText) as GlobalModelSettingsPayload
      const payload = (raw.GlobalModelConfiguration ??
        raw) as Partial<FlatGlobalModelSettings>
      const nestedGlobal = raw.global
      const nestedGeneral = raw.general_setting
      const current = form.getValues()
      const next: GlobalModelSettingsFormInput = {
        global: {
          pass_through_request_enabled:
            payload['global.pass_through_request_enabled'] ??
            nestedGlobal?.pass_through_request_enabled ??
            current.global.pass_through_request_enabled,
          thinking_model_blacklist: formatJsonText(
            payload['global.thinking_model_blacklist'] ??
              nestedGlobal?.thinking_model_blacklist ??
              current.global.thinking_model_blacklist,
            '[]'
          ),
          chat_completions_to_responses_policy: formatJsonText(
            payload['global.chat_completions_to_responses_policy'] ??
              nestedGlobal?.chat_completions_to_responses_policy ??
              current.global.chat_completions_to_responses_policy,
            '{}'
          ),
        },
        general_setting: {
          ping_interval_enabled:
            payload['general_setting.ping_interval_enabled'] ??
            nestedGeneral?.ping_interval_enabled ??
            current.general_setting.ping_interval_enabled,
          ping_interval_seconds:
            payload['general_setting.ping_interval_seconds'] ??
            nestedGeneral?.ping_interval_seconds ??
            current.general_setting.ping_interval_seconds,
        },
      }

      const parsed = schema.parse(next)
      form.setValue(
        'global.pass_through_request_enabled',
        parsed.global.pass_through_request_enabled,
        { shouldDirty: true, shouldValidate: true }
      )
      form.setValue(
        'global.thinking_model_blacklist',
        parsed.global.thinking_model_blacklist,
        { shouldDirty: true, shouldValidate: true }
      )
      form.setValue(
        'global.chat_completions_to_responses_policy',
        parsed.global.chat_completions_to_responses_policy,
        { shouldDirty: true, shouldValidate: true }
      )
      form.setValue(
        'general_setting.ping_interval_enabled',
        parsed.general_setting.ping_interval_enabled,
        { shouldDirty: true, shouldValidate: true }
      )
      form.setValue(
        'general_setting.ping_interval_seconds',
        parsed.general_setting.ping_interval_seconds,
        { shouldDirty: true, shouldValidate: true }
      )
      setImportOpen(false)
      toast.success(t('Global model configuration imported'))
    } catch {
      toast.error(t('Invalid global model configuration JSON'))
    }
  }

  const formatJsonField = (
    field:
      | 'global.thinking_model_blacklist'
      | 'global.chat_completions_to_responses_policy'
  ) => {
    const raw = form.getValues(field)
    if (!raw || !raw.trim()) return
    try {
      const formatted = JSON.stringify(JSON.parse(raw), null, 2)
      form.setValue(field, formatted, { shouldDirty: true })
    } catch {
      toast.error(t('Invalid JSON format'))
    }
  }

  const onSubmit = async (values: GlobalModelSettingsFormValues) => {
    const flattenedDefaults = flattenGlobalValues(defaultValues)
    const flattenedValues = flattenGlobalValues(values)
    const updates = Object.entries(flattenedValues).filter(
      ([key, value]) =>
        value !== flattenedDefaults[key as keyof FlatGlobalModelSettings]
    )

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({
        key,
        value,
      })
    }
  }

  return (
    <SettingsSection title={t('Global Model Configuration')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <SettingsPageActionsPortal>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={exportConfig}
            >
              <Download data-icon='inline-start' />
              <span>{t('Export JSON')}</span>
            </Button>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => {
                setImportText('')
                setImportOpen(true)
              }}
            >
              <Upload data-icon='inline-start' />
              <span>{t('Import JSON')}</span>
            </Button>
          </SettingsPageActionsPortal>
          <FormField
            control={form.control}
            name='global.pass_through_request_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Request Passthrough')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Forward requests directly to upstream providers without any post-processing.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='global.thinking_model_blacklist'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Disable thinking processing models')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder={`${t('Example:')}\n${thinkingBlacklistExample}`}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Models listed here will not automatically append or remove -thinking / -nothinking suffixes.'
                  )}
                </FormDescription>
                <div className='flex flex-wrap gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      formatJsonField('global.thinking_model_blacklist')
                    }
                  >
                    {t('Format JSON')}
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          <div className='space-y-4'>
            <div className='flex items-center gap-2'>
              <h3 className='text-base font-semibold'>
                {t('ChatCompletions -> Responses Compatibility')}
              </h3>
              <StatusBadge
                label={t('Preview')}
                variant='neutral'
                copyable={false}
              />
            </div>

            <Alert>
              <AlertTitle>{t('Warning')}</AlertTitle>
              <AlertDescription>
                {t(
                  'This feature is experimental. Configuration format and behavior may change.'
                )}
              </AlertDescription>
            </Alert>

            <FormField
              control={form.control}
              name='global.chat_completions_to_responses_policy'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Policy JSON')}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={8}
                      placeholder={`${t('Example (specific channels):')}\n${chatToResponsesPolicyExample}\n\n${t('Example (all channels):')}\n${chatToResponsesPolicyAllChannelsExample}`}
                      {...field}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Empty value will be saved as {}.')}
                  </FormDescription>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        form.setValue(
                          'global.chat_completions_to_responses_policy',
                          chatToResponsesPolicyExample,
                          { shouldDirty: true }
                        )
                      }
                    >
                      {t('Fill example (specific channels)')}
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        form.setValue(
                          'global.chat_completions_to_responses_policy',
                          chatToResponsesPolicyAllChannelsExample,
                          { shouldDirty: true }
                        )
                      }
                    >
                      {t('Fill example (all channels)')}
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        formatJsonField(
                          'global.chat_completions_to_responses_policy'
                        )
                      }
                    >
                      {t('Format JSON')}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          <FormField
            control={form.control}
            name='general_setting.ping_interval_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Keep-alive Ping')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Periodically send ping frames to keep streaming connections active.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='general_setting.ping_interval_seconds'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Ping Interval (seconds)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    disabled={!pingEnabled}
                    className='w-24'
                    value={
                      field.value === undefined || field.value === null
                        ? ''
                        : String(field.value)
                    }
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Recommended to keep this high to avoid upstream throttling.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Import global model configuration')}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={t('Paste global model configuration JSON')}
            className='min-h-[220px] font-mono text-sm'
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
