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
import { useState } from 'react'
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
  DialogDescription,
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
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'
import { removeTrailingSlash } from './utils'

const REDACTED_SECRET = '__SECRET_REDACTED__'

const createWorkerSchema = (t: (key: string) => string) =>
  z.object({
    WorkerUrl: z.string().refine((value) => {
      const trimmed = value.trim()
      if (!trimmed) return true
      return /^https?:\/\//.test(trimmed)
    }, t('Provide a valid URL starting with http:// or https://')),
    WorkerValidKey: z.string(),
    WorkerAllowHttpImageRequestEnabled: z.boolean(),
  })

type WorkerFormValues = z.infer<ReturnType<typeof createWorkerSchema>>

type WorkerSettingsSectionProps = {
  defaultValues: WorkerFormValues
}

type WorkerImportExportPayload = {
  WorkerProxy?: Partial<WorkerFormValues>
} & Partial<WorkerFormValues>

export function WorkerSettingsSection({
  defaultValues,
}: WorkerSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const workerSchema = createWorkerSchema(t)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const form = useForm<WorkerFormValues>({
    resolver: zodResolver(workerSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const onSubmit = async (values: WorkerFormValues) => {
    const sanitizedUrl = removeTrailingSlash(values.WorkerUrl)
    const sanitizedKey = values.WorkerValidKey.trim()
    const initialUrl = removeTrailingSlash(defaultValues.WorkerUrl)
    const initialKey = defaultValues.WorkerValidKey.trim()

    const updates: Array<{ key: string; value: string | boolean }> = []

    if (sanitizedUrl !== initialUrl) {
      updates.push({ key: 'WorkerUrl', value: sanitizedUrl })
    }

    if (sanitizedKey !== initialKey || sanitizedUrl === '') {
      updates.push({ key: 'WorkerValidKey', value: sanitizedKey })
    }

    if (
      values.WorkerAllowHttpImageRequestEnabled !==
      defaultValues.WorkerAllowHttpImageRequestEnabled
    ) {
      updates.push({
        key: 'WorkerAllowHttpImageRequestEnabled',
        value: values.WorkerAllowHttpImageRequestEnabled,
      })
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  const normalizedValues = (): WorkerFormValues => {
    const values = workerSchema.parse(form.getValues())
    return {
      WorkerUrl: removeTrailingSlash(values.WorkerUrl),
      WorkerValidKey: values.WorkerValidKey.trim(),
      WorkerAllowHttpImageRequestEnabled:
        values.WorkerAllowHttpImageRequestEnabled,
    }
  }

  const exportConfig = async () => {
    const values = normalizedValues()
    const safeValues = {
      ...values,
      WorkerValidKey: values.WorkerValidKey ? REDACTED_SECRET : '',
    }
    const payload = {
      WorkerProxy: safeValues,
      ...safeValues,
    }
    const text = JSON.stringify(payload, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'newapi-worker-proxy.json'
    link.click()
    URL.revokeObjectURL(url)

    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('Worker Proxy JSON exported and copied'))
    } catch {
      toast.success(t('Worker Proxy JSON exported'))
    }
  }

  const openImportDialog = () => {
    const values = normalizedValues()
    setImportText(
      JSON.stringify(
        {
          WorkerProxy: {
            ...values,
            WorkerValidKey: values.WorkerValidKey ? REDACTED_SECRET : '',
          },
        },
        null,
        2
      )
    )
    setImportOpen(true)
  }

  const importConfig = async () => {
    try {
      const raw = JSON.parse(importText) as WorkerImportExportPayload
      const source = raw.WorkerProxy ?? raw
      const current = normalizedValues()
      const parsed = workerSchema.parse({
        ...current,
        ...source,
        WorkerValidKey:
          source.WorkerValidKey === REDACTED_SECRET ||
          source.WorkerValidKey === undefined
            ? current.WorkerValidKey
            : source.WorkerValidKey,
      })

      Object.entries(parsed).forEach(([key, value]) => {
        form.setValue(key as keyof WorkerFormValues, value, {
          shouldDirty: true,
          shouldValidate: true,
        })
      })
      await form.trigger()
      setImportOpen(false)
      toast.success(t('Worker Proxy imported. Click Save to apply.'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Invalid Worker JSON')
      )
    }
  }

  return (
    <SettingsSection title={t('Worker Proxy')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
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
              onClick={openImportDialog}
            >
              <Upload data-icon='inline-start' />
              <span>{t('Import JSON')}</span>
            </Button>
          </SettingsPageActionsPortal>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save Worker settings'
          />
          <FormField
            control={form.control}
            name='WorkerUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Worker URL')}</FormLabel>
                <FormControl>
                  <Input
                    type='url'
                    inputMode='url'
                    placeholder={t('https://worker.example.workers.dev')}
                    autoComplete='off'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Requests will be forwarded to this worker. Trailing slashes are removed automatically.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='WorkerValidKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Worker Access Key')}</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder={t('Enter new key to update')}
                    autoComplete='new-password'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Used to authenticate with the worker. Leave blank to keep the existing secret.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='WorkerAllowHttpImageRequestEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Allow HTTP image requests')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Enable when proxying workers that fetch images over HTTP.'
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
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{t('Import Worker Proxy JSON')}</DialogTitle>
            <DialogDescription>
              {t(
                'Paste an exported Worker Proxy JSON payload. Redacted credentials keep the current saved secret.'
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            className='min-h-80 font-mono text-xs'
            spellCheck={false}
          />
          <DialogFooter>
            <Button variant='outline' onClick={() => setImportOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={importConfig}>{t('Import JSON')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  )
}
