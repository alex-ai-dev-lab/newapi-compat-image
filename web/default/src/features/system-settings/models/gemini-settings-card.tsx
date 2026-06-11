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
import { useEffect, useMemo, useRef, useState } from 'react'
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
  gemini: z.object({
    safety_settings: z.string().superRefine((value, ctx) => {
      const result = validateJsonString(value)
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message || 'Invalid JSON',
        })
      }
    }),
    version_settings: z.string().superRefine((value, ctx) => {
      const result = validateJsonString(value)
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message || 'Invalid JSON',
        })
      }
    }),
    supported_imagine_models: z.string().superRefine((value, ctx) => {
      const result = validateJsonString(value, {
        predicate: (parsed) =>
          Array.isArray(parsed) &&
          parsed.every((item) => typeof item === 'string'),
        predicateMessage: 'Expected a JSON array of model identifiers',
      })
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message || 'Invalid JSON array',
        })
      }
    }),
    thinking_adapter_enabled: z.boolean(),
    thinking_adapter_budget_tokens_percentage: z.coerce
      .number()
      .min(0.002, { message: 'Must be at least 0.002' })
      .max(1, { message: 'Must be 1 or less' }),
    function_call_thought_signature_enabled: z.boolean(),
    remove_function_response_id_enabled: z.boolean(),
  }),
})

type GeminiSettingsFormValues = z.output<typeof schema>
type GeminiSettingsFormInput = z.input<typeof schema>

type FlatGeminiSettings = {
  'gemini.safety_settings': string
  'gemini.version_settings': string
  'gemini.supported_imagine_models': string
  'gemini.thinking_adapter_enabled': boolean
  'gemini.thinking_adapter_budget_tokens_percentage': number
  'gemini.function_call_thought_signature_enabled': boolean
  'gemini.remove_function_response_id_enabled': boolean
}

type GeminiSettingsPayload = Partial<FlatGeminiSettings> & {
  Gemini?: Partial<FlatGeminiSettings>
  gemini?: Partial<GeminiSettingsFormInput['gemini']>
}

type GeminiSettingsCardProps = {
  defaultValues: GeminiSettingsFormInput
}

export function GeminiSettingsCard({ defaultValues }: GeminiSettingsCardProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const normalizedDefaultsRef = useRef<FlatGeminiSettings>({
    'gemini.safety_settings': normalizeJsonString(
      defaultValues.gemini.safety_settings
    ),
    'gemini.version_settings': normalizeJsonString(
      defaultValues.gemini.version_settings
    ),
    'gemini.supported_imagine_models': normalizeJsonString(
      defaultValues.gemini.supported_imagine_models
    ),
    'gemini.thinking_adapter_enabled':
      defaultValues.gemini.thinking_adapter_enabled,
    'gemini.thinking_adapter_budget_tokens_percentage': Number(
      defaultValues.gemini.thinking_adapter_budget_tokens_percentage
    ),
    'gemini.function_call_thought_signature_enabled':
      defaultValues.gemini.function_call_thought_signature_enabled ?? true,
    'gemini.remove_function_response_id_enabled':
      defaultValues.gemini.remove_function_response_id_enabled ?? true,
  })

  const buildFormDefaults = (
    values: GeminiSettingsFormInput
  ): GeminiSettingsFormInput => ({
    gemini: {
      safety_settings: formatJsonForTextarea(values.gemini.safety_settings),
      version_settings: formatJsonForTextarea(values.gemini.version_settings),
      supported_imagine_models: formatJsonForTextarea(
        values.gemini.supported_imagine_models
      ),
      thinking_adapter_enabled: values.gemini.thinking_adapter_enabled,
      thinking_adapter_budget_tokens_percentage:
        values.gemini.thinking_adapter_budget_tokens_percentage,
      function_call_thought_signature_enabled:
        values.gemini.function_call_thought_signature_enabled ?? true,
      remove_function_response_id_enabled:
        values.gemini.remove_function_response_id_enabled ?? true,
    },
  })

  const form = useForm<
    GeminiSettingsFormInput,
    unknown,
    GeminiSettingsFormValues
  >({
    resolver: zodResolver(schema),
    defaultValues: buildFormDefaults(defaultValues),
  })

  useEffect(() => {
    normalizedDefaultsRef.current = {
      'gemini.safety_settings': normalizeJsonString(
        defaultValues.gemini.safety_settings
      ),
      'gemini.version_settings': normalizeJsonString(
        defaultValues.gemini.version_settings
      ),
      'gemini.supported_imagine_models': normalizeJsonString(
        defaultValues.gemini.supported_imagine_models
      ),
      'gemini.thinking_adapter_enabled':
        defaultValues.gemini.thinking_adapter_enabled,
      'gemini.thinking_adapter_budget_tokens_percentage': Number(
        defaultValues.gemini.thinking_adapter_budget_tokens_percentage
      ),
      'gemini.function_call_thought_signature_enabled':
        defaultValues.gemini.function_call_thought_signature_enabled ?? true,
      'gemini.remove_function_response_id_enabled':
        defaultValues.gemini.remove_function_response_id_enabled ?? true,
    }

    form.reset(buildFormDefaults(defaultValues))
  }, [defaultValues, form])

  const isAdapterEnabled = form.watch('gemini.thinking_adapter_enabled')

  const onSubmit = async (values: GeminiSettingsFormValues) => {
    const normalized: FlatGeminiSettings = {
      'gemini.safety_settings': normalizeJsonString(
        values.gemini.safety_settings
      ),
      'gemini.version_settings': normalizeJsonString(
        values.gemini.version_settings
      ),
      'gemini.supported_imagine_models': normalizeJsonString(
        values.gemini.supported_imagine_models
      ),
      'gemini.thinking_adapter_enabled': values.gemini.thinking_adapter_enabled,
      'gemini.thinking_adapter_budget_tokens_percentage':
        values.gemini.thinking_adapter_budget_tokens_percentage,
      'gemini.function_call_thought_signature_enabled':
        values.gemini.function_call_thought_signature_enabled,
      'gemini.remove_function_response_id_enabled':
        values.gemini.remove_function_response_id_enabled,
    }

    const updates = (
      Object.keys(normalized) as Array<keyof FlatGeminiSettings>
    ).filter((key) => normalized[key] !== normalizedDefaultsRef.current[key])

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of updates) {
      await updateOption.mutateAsync({
        key,
        value: normalized[key],
      })
    }
  }

  const buildExportPayload = () => ({
    'gemini.safety_settings': normalizeJsonString(
      form.getValues('gemini.safety_settings')
    ),
    'gemini.version_settings': normalizeJsonString(
      form.getValues('gemini.version_settings')
    ),
    'gemini.supported_imagine_models': normalizeJsonString(
      form.getValues('gemini.supported_imagine_models')
    ),
    'gemini.thinking_adapter_enabled': form.getValues(
      'gemini.thinking_adapter_enabled'
    ),
    'gemini.thinking_adapter_budget_tokens_percentage': Number(
      form.getValues('gemini.thinking_adapter_budget_tokens_percentage')
    ),
    'gemini.function_call_thought_signature_enabled': form.getValues(
      'gemini.function_call_thought_signature_enabled'
    ),
    'gemini.remove_function_response_id_enabled': form.getValues(
      'gemini.remove_function_response_id_enabled'
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
    link.download = 'newapi-gemini-settings.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('Gemini settings exported'))
  }

  const importConfig = () => {
    try {
      const raw = JSON.parse(importText) as GeminiSettingsPayload
      const payload = (raw.Gemini ?? raw) as Partial<FlatGeminiSettings>
      const nested = raw.gemini
      const current = form.getValues()
      const next: GeminiSettingsFormInput = {
        gemini: {
          safety_settings: formatJsonForTextarea(
            payload['gemini.safety_settings'] ??
              nested?.safety_settings ??
              current.gemini.safety_settings
          ),
          version_settings: formatJsonForTextarea(
            payload['gemini.version_settings'] ??
              nested?.version_settings ??
              current.gemini.version_settings
          ),
          supported_imagine_models: formatJsonForTextarea(
            payload['gemini.supported_imagine_models'] ??
              nested?.supported_imagine_models ??
              current.gemini.supported_imagine_models
          ),
          thinking_adapter_enabled:
            payload['gemini.thinking_adapter_enabled'] ??
            nested?.thinking_adapter_enabled ??
            current.gemini.thinking_adapter_enabled,
          thinking_adapter_budget_tokens_percentage:
            payload['gemini.thinking_adapter_budget_tokens_percentage'] ??
            nested?.thinking_adapter_budget_tokens_percentage ??
            current.gemini.thinking_adapter_budget_tokens_percentage,
          function_call_thought_signature_enabled:
            payload['gemini.function_call_thought_signature_enabled'] ??
            nested?.function_call_thought_signature_enabled ??
            current.gemini.function_call_thought_signature_enabled,
          remove_function_response_id_enabled:
            payload['gemini.remove_function_response_id_enabled'] ??
            nested?.remove_function_response_id_enabled ??
            current.gemini.remove_function_response_id_enabled,
        },
      }
      const parsed = schema.parse(next)
      form.setValue('gemini.safety_settings', parsed.gemini.safety_settings, {
        shouldDirty: true,
        shouldValidate: true,
      })
      form.setValue('gemini.version_settings', parsed.gemini.version_settings, {
        shouldDirty: true,
        shouldValidate: true,
      })
      form.setValue(
        'gemini.supported_imagine_models',
        parsed.gemini.supported_imagine_models,
        { shouldDirty: true, shouldValidate: true }
      )
      form.setValue(
        'gemini.thinking_adapter_enabled',
        parsed.gemini.thinking_adapter_enabled,
        { shouldDirty: true, shouldValidate: true }
      )
      form.setValue(
        'gemini.thinking_adapter_budget_tokens_percentage',
        parsed.gemini.thinking_adapter_budget_tokens_percentage,
        { shouldDirty: true, shouldValidate: true }
      )
      form.setValue(
        'gemini.function_call_thought_signature_enabled',
        parsed.gemini.function_call_thought_signature_enabled,
        { shouldDirty: true, shouldValidate: true }
      )
      form.setValue(
        'gemini.remove_function_response_id_enabled',
        parsed.gemini.remove_function_response_id_enabled,
        { shouldDirty: true, shouldValidate: true }
      )
      setImportOpen(false)
      toast.success(t('Gemini settings imported'))
    } catch {
      toast.error(t('Invalid Gemini settings JSON'))
    }
  }

  const imaginePlaceholder = useMemo(
    () => JSON.stringify(['gemini-2.0-flash-exp-image-generation'], null, 2),
    []
  )

  return (
    <SettingsSection title={t('Gemini')}>
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
            name='gemini.safety_settings'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Safety Settings')}</FormLabel>
                <FormControl>
                  <Textarea rows={8} {...field} />
                </FormControl>
                <FormDescription>
                  {t(
                    'Provide per-category safety overrides as JSON. Use `default` for fallback values.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='gemini.version_settings'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Version Overrides')}</FormLabel>
                <FormControl>
                  <Textarea rows={8} {...field} />
                </FormControl>
                <FormDescription>
                  {t(
                    'Map model identifiers to Gemini API versions. A `default` entry applies when no specific match is found.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='gemini.supported_imagine_models'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Supported Imagine Models')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={6}
                    placeholder={imaginePlaceholder}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Accepts a JSON array of model identifiers that support the Imagine API.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <SettingsControlGroup>
            <FormField
              control={form.control}
              name='gemini.thinking_adapter_enabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Thinking Adapter')}</FormLabel>
                    <FormDescription>
                      {t('Supports `-thinking`, `-thinking-')}
                      {'{{budget}}'}
                      {t(
                        '`, and `-nothinking` suffixes while routing to the correct Gemini variant.'
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
              name='gemini.thinking_adapter_budget_tokens_percentage'
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
                      'Budget tokens = max tokens × ratio. Accepts a decimal between 0.002 and 1. Recommended to keep aligned with upstream billing.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isAdapterEnabled && (
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Gemini will continue to auto-detect thinking mode even with the adapter disabled. Enable this only when you need finer control over pricing and budgeting.'
                )}
              </p>
            )}
          </SettingsControlGroup>

          <FormField
            control={form.control}
            name='gemini.function_call_thought_signature_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>
                    {t('Enable FunctionCall thoughtSignature Fill')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'Fill thoughtSignature only for Gemini/Vertex channels using the OpenAI format'
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
            name='gemini.remove_function_response_id_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Remove functionResponse.id field')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Vertex AI does not support functionResponse.id. Enable this to remove the field automatically.'
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
        </SettingsForm>
      </Form>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Import Gemini settings')}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={t('Paste Gemini settings JSON')}
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
