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
import { useEffect, useRef, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Download, Upload } from 'lucide-react'
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
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsControlGroup,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import {
  SettingsPageActionsPortal,
  SettingsPageFormActions,
} from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  formatJsonForTextarea,
  normalizeJsonString,
  validateJsonString,
} from './utils'

const schema = z.object({
  claude: z.object({
    model_headers_settings: z.string().superRefine((value, ctx) => {
      const result = validateJsonString(value)
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message || 'Invalid JSON',
        })
      }
    }),
    default_max_tokens: z.string().superRefine((value, ctx) => {
      const result = validateJsonString(value)
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message || 'Invalid JSON',
        })
      }
    }),
    thinking_adapter_enabled: z.boolean(),
    thinking_adapter_budget_tokens_percentage: z.coerce
      .number()
      .min(0.1, { message: 'Must be at least 0.1' })
      .max(1, { message: 'Must be 1 or less' }),
  }),
})

type ClaudeSettingsFormValues = z.output<typeof schema>
type ClaudeSettingsFormInput = z.input<typeof schema>

type FlatClaudeSettings = {
  'claude.model_headers_settings': string
  'claude.default_max_tokens': string
  'claude.thinking_adapter_enabled': boolean
  'claude.thinking_adapter_budget_tokens_percentage': number
}

type ClaudeSettingsPayload = Partial<FlatClaudeSettings> & {
  Claude?: Partial<FlatClaudeSettings>
  claude?: Partial<ClaudeSettingsFormInput['claude']>
}

type ClaudeSettingsCardProps = {
  defaultValues: ClaudeSettingsFormInput
}

export function ClaudeSettingsCard({ defaultValues }: ClaudeSettingsCardProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const normalizedDefaultsRef = useRef<FlatClaudeSettings>({
    'claude.model_headers_settings': normalizeJsonString(
      defaultValues.claude.model_headers_settings
    ),
    'claude.default_max_tokens': normalizeJsonString(
      defaultValues.claude.default_max_tokens
    ),
    'claude.thinking_adapter_enabled':
      defaultValues.claude.thinking_adapter_enabled,
    'claude.thinking_adapter_budget_tokens_percentage': Number(
      defaultValues.claude.thinking_adapter_budget_tokens_percentage
    ),
  })

  const buildFormDefaults = (
    values: ClaudeSettingsFormInput
  ): ClaudeSettingsFormInput => ({
    claude: {
      model_headers_settings: formatJsonForTextarea(
        values.claude.model_headers_settings
      ),
      default_max_tokens: formatJsonForTextarea(
        values.claude.default_max_tokens
      ),
      thinking_adapter_enabled: values.claude.thinking_adapter_enabled,
      thinking_adapter_budget_tokens_percentage:
        values.claude.thinking_adapter_budget_tokens_percentage,
    },
  })

  const form = useForm<
    ClaudeSettingsFormInput,
    unknown,
    ClaudeSettingsFormValues
  >({
    resolver: zodResolver(schema),
    defaultValues: buildFormDefaults(defaultValues),
  })

  useEffect(() => {
    normalizedDefaultsRef.current = {
      'claude.model_headers_settings': normalizeJsonString(
        defaultValues.claude.model_headers_settings
      ),
      'claude.default_max_tokens': normalizeJsonString(
        defaultValues.claude.default_max_tokens
      ),
      'claude.thinking_adapter_enabled':
        defaultValues.claude.thinking_adapter_enabled,
      'claude.thinking_adapter_budget_tokens_percentage': Number(
        defaultValues.claude.thinking_adapter_budget_tokens_percentage
      ),
    }

    form.reset(buildFormDefaults(defaultValues))
  }, [defaultValues, form])

  const onSubmit = async (values: ClaudeSettingsFormValues) => {
    const normalized: FlatClaudeSettings = {
      'claude.model_headers_settings': normalizeJsonString(
        values.claude.model_headers_settings
      ),
      'claude.default_max_tokens': normalizeJsonString(
        values.claude.default_max_tokens
      ),
      'claude.thinking_adapter_enabled': values.claude.thinking_adapter_enabled,
      'claude.thinking_adapter_budget_tokens_percentage':
        values.claude.thinking_adapter_budget_tokens_percentage,
    }

    const updates = (
      Object.keys(normalized) as Array<keyof FlatClaudeSettings>
    ).filter((key) => normalized[key] !== normalizedDefaultsRef.current[key])

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of updates) {
      await updateOption.mutateAsync({ key, value: normalized[key] })
    }
  }

  const buildExportPayload = () => ({
    'claude.model_headers_settings': normalizeJsonString(
      form.getValues('claude.model_headers_settings')
    ),
    'claude.default_max_tokens': normalizeJsonString(
      form.getValues('claude.default_max_tokens')
    ),
    'claude.thinking_adapter_enabled': form.getValues(
      'claude.thinking_adapter_enabled'
    ),
    'claude.thinking_adapter_budget_tokens_percentage': Number(
      form.getValues('claude.thinking_adapter_budget_tokens_percentage')
    ),
  })

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
    link.download = 'newapi-claude-settings.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('Claude settings exported'))
  }

  const importConfig = () => {
    try {
      const raw = JSON.parse(importText) as ClaudeSettingsPayload
      const payload = (raw.Claude ?? raw) as Partial<FlatClaudeSettings>
      const nested = raw.claude
      const current = form.getValues()
      const next: ClaudeSettingsFormInput = {
        claude: {
          model_headers_settings: formatJsonForTextarea(
            payload['claude.model_headers_settings'] ??
              nested?.model_headers_settings ??
              current.claude.model_headers_settings
          ),
          default_max_tokens: formatJsonForTextarea(
            payload['claude.default_max_tokens'] ??
              nested?.default_max_tokens ??
              current.claude.default_max_tokens
          ),
          thinking_adapter_enabled:
            payload['claude.thinking_adapter_enabled'] ??
            nested?.thinking_adapter_enabled ??
            current.claude.thinking_adapter_enabled,
          thinking_adapter_budget_tokens_percentage:
            payload['claude.thinking_adapter_budget_tokens_percentage'] ??
            nested?.thinking_adapter_budget_tokens_percentage ??
            current.claude.thinking_adapter_budget_tokens_percentage,
        },
      }
      const parsed = schema.parse(next)
      form.setValue(
        'claude.model_headers_settings',
        parsed.claude.model_headers_settings,
        { shouldDirty: true, shouldValidate: true }
      )
      form.setValue(
        'claude.default_max_tokens',
        parsed.claude.default_max_tokens,
        { shouldDirty: true, shouldValidate: true }
      )
      form.setValue(
        'claude.thinking_adapter_enabled',
        parsed.claude.thinking_adapter_enabled,
        { shouldDirty: true, shouldValidate: true }
      )
      form.setValue(
        'claude.thinking_adapter_budget_tokens_percentage',
        parsed.claude.thinking_adapter_budget_tokens_percentage,
        { shouldDirty: true, shouldValidate: true }
      )
      setImportOpen(false)
      toast.success(t('Claude settings imported'))
    } catch {
      toast.error(t('Invalid Claude settings JSON'))
    }
  }

  return (
    <SettingsSection title={t('Claude')}>
      <Form {...form}>
        {/* eslint-disable-next-line react-hooks/refs */}
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
            name='claude.model_headers_settings'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Request Header Overrides')}</FormLabel>
                <FormControl>
                  <Textarea rows={8} {...field} />
                </FormControl>
                <FormDescription>
                  {t(
                    'Provide per-model header overrides as JSON. Useful for enabling beta features such as expanded context windows.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='claude.default_max_tokens'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Default Max Tokens')}</FormLabel>
                <FormControl>
                  <Textarea rows={8} {...field} />
                </FormControl>
                <FormDescription>
                  {t('Example')}{' '}
                  {`{ "default": 8192, "claude-3-haiku-20240307": 4096, "claude-3-opus-20240229": 4096, "claude-3-7-sonnet-20250219-thinking": 8192 }`}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <SettingsControlGroup>
            <FormField
              control={form.control}
              name='claude.thinking_adapter_enabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Thinking Adapter')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Translate `-thinking` suffixes into Anthropic native thinking models while keeping pricing predictable.'
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
              name='claude.thinking_adapter_budget_tokens_percentage'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Budget Tokens Ratio')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={String(field.value ?? '')}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Budget tokens = max tokens × ratio. Accepts a decimal between 0.1 and 1.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsControlGroup>
        </SettingsForm>
      </Form>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Import Claude settings')}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={t('Paste Claude settings JSON')}
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
