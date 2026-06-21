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
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import {
  SettingsPageActionsPortal,
  SettingsPageFormActions,
} from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

const XAI_VIOLATION_FEE_DOC_URL =
  'https://docs.x.ai/docs/models#usage-guidelines-violation-fee'

/**
 * The schema uses a nested object so the dotted FormField `name` props line
 * up with react-hook-form's path semantics. Using flat keys like
 * `'grok.violation_deduction_enabled'` causes RHF to silently maintain two
 * parallel value trees and saves never see the user input.
 */
const grokSchema = z.object({
  grok: z.object({
    violation_deduction_enabled: z.boolean(),
    violation_deduction_amount: z.coerce.number().min(0),
  }),
})

type GrokFormInput = z.input<typeof grokSchema>
type GrokFormValues = z.output<typeof grokSchema>

type FlatGrokDefaults = {
  'grok.violation_deduction_enabled': boolean
  'grok.violation_deduction_amount': number
}

type GrokSettingsPayload = Partial<FlatGrokDefaults> & {
  Grok?: Partial<FlatGrokDefaults>
  grok?: Partial<GrokFormInput['grok']>
}

const buildFormDefaults = (defaults: FlatGrokDefaults): GrokFormInput => ({
  grok: {
    violation_deduction_enabled: defaults['grok.violation_deduction_enabled'],
    violation_deduction_amount: defaults['grok.violation_deduction_amount'],
  },
})

const normalizeFormValues = (values: GrokFormValues): FlatGrokDefaults => ({
  'grok.violation_deduction_enabled': values.grok.violation_deduction_enabled,
  'grok.violation_deduction_amount': values.grok.violation_deduction_amount,
})

interface Props {
  defaultValues: FlatGrokDefaults
}

export function GrokSettingsCard(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const formDefaults = useMemo(
    () => buildFormDefaults(props.defaultValues),
    [props.defaultValues]
  )

  const form = useForm<GrokFormInput, unknown, GrokFormValues>({
    resolver: zodResolver(grokSchema),
    defaultValues: formDefaults,
  })

  const baselineRef = useRef<FlatGrokDefaults>(props.defaultValues)
  const baselineSerializedRef = useRef<string>(
    JSON.stringify(props.defaultValues)
  )

  useEffect(() => {
    const serialized = JSON.stringify(props.defaultValues)
    if (serialized === baselineSerializedRef.current) return
    baselineRef.current = props.defaultValues
    baselineSerializedRef.current = serialized
    form.reset(buildFormDefaults(props.defaultValues))
  }, [props.defaultValues, form])

  const onSubmit = async (values: GrokFormValues) => {
    const normalized = normalizeFormValues(values)
    const changedKeys = (
      Object.keys(normalized) as Array<keyof FlatGrokDefaults>
    ).filter((key) => normalized[key] !== baselineRef.current[key])

    if (changedKeys.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of changedKeys) {
      await updateOption.mutateAsync({
        key,
        value: normalized[key],
      })
    }

    baselineRef.current = normalized
    baselineSerializedRef.current = JSON.stringify(normalized)
    form.reset(buildFormDefaults(normalized))
  }

  const enabled = form.watch('grok.violation_deduction_enabled')

  const exportConfig = async () => {
    const text = JSON.stringify(
      normalizeFormValues(grokSchema.parse(form.getValues())),
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
    link.download = 'renewapi-grok-settings.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('Grok settings exported'))
  }

  const importConfig = () => {
    try {
      const raw = JSON.parse(importText) as GrokSettingsPayload
      const payload = (raw.Grok ?? raw) as Partial<FlatGrokDefaults>
      const nested = raw.grok
      const current = normalizeFormValues(grokSchema.parse(form.getValues()))
      const parsed = grokSchema.parse(
        buildFormDefaults({
          'grok.violation_deduction_enabled':
            payload['grok.violation_deduction_enabled'] ??
            nested?.violation_deduction_enabled ??
            current['grok.violation_deduction_enabled'],
          'grok.violation_deduction_amount': Number(
            payload['grok.violation_deduction_amount'] ??
              nested?.violation_deduction_amount ??
              current['grok.violation_deduction_amount']
          ),
        })
      )
      form.setValue(
        'grok.violation_deduction_enabled',
        parsed.grok.violation_deduction_enabled,
        { shouldDirty: true, shouldValidate: true }
      )
      form.setValue(
        'grok.violation_deduction_amount',
        parsed.grok.violation_deduction_amount,
        { shouldDirty: true, shouldValidate: true }
      )
      setImportOpen(false)
      toast.success(t('Grok settings imported'))
    } catch {
      toast.error(t('Invalid Grok settings JSON'))
    }
  }

  return (
    <SettingsSection title={t('Grok Settings')}>
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
            name='grok.violation_deduction_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable violation deduction')}</FormLabel>
                  <FormDescription>
                    {t(
                      'When enabled, violation requests will incur additional charges.'
                    )}{' '}
                    <a
                      href={XAI_VIOLATION_FEE_DOC_URL}
                      target='_blank'
                      rel='noreferrer'
                      className='underline'
                    >
                      {t('Official documentation')}
                    </a>
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
            name='grok.violation_deduction_amount'
            render={({ field }) => (
              <FormItem className='max-w-xs'>
                <FormLabel>{t('Violation deduction amount')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    step={0.01}
                    min={0}
                    {...safeNumberFieldProps(field)}
                    disabled={!enabled}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Base amount. Actual deduction = base amount × system group rate.'
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
            <DialogTitle>{t('Import Grok settings')}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={t('Paste Grok settings JSON')}
            className='min-h-[180px] font-mono text-sm'
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
