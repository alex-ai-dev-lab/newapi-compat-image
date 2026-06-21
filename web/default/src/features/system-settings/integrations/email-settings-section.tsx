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

const REDACTED_SECRET = '__SECRET_REDACTED__'

const createEmailSchema = (t: (key: string) => string) =>
  z.object({
    SMTPServer: z.string(),
    SMTPPort: z.string().refine((value) => {
      const trimmed = value.trim()
      if (!trimmed) return true
      return /^\d+$/.test(trimmed)
    }, t('Port must be a positive integer')),
    SMTPAccount: z.string(),
    SMTPFrom: z.string().refine((value) => {
      const trimmed = value.trim()
      if (!trimmed) return true
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    }, t('Enter a valid email or leave blank')),
    SMTPToken: z.string(),
    SMTPSSLEnabled: z.boolean(),
    SMTPForceAuthLogin: z.boolean(),
  })

type EmailFormValues = z.infer<ReturnType<typeof createEmailSchema>>

type EmailSettingsSectionProps = {
  defaultValues: EmailFormValues
}

type EmailImportExportPayload = {
  SMTPEmail?: Partial<EmailFormValues>
} & Partial<EmailFormValues>

export function EmailSettingsSection({
  defaultValues,
}: EmailSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const emailSchema = createEmailSchema(t)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const onSubmit = async (values: EmailFormValues) => {
    const sanitized = {
      SMTPServer: values.SMTPServer.trim(),
      SMTPPort: values.SMTPPort.trim(),
      SMTPAccount: values.SMTPAccount.trim(),
      SMTPFrom: values.SMTPFrom.trim(),
      SMTPToken: values.SMTPToken.trim(),
      SMTPSSLEnabled: values.SMTPSSLEnabled,
      SMTPForceAuthLogin: values.SMTPForceAuthLogin,
    }

    const initial = {
      SMTPServer: defaultValues.SMTPServer.trim(),
      SMTPPort: defaultValues.SMTPPort.trim(),
      SMTPAccount: defaultValues.SMTPAccount.trim(),
      SMTPFrom: defaultValues.SMTPFrom.trim(),
      SMTPToken: defaultValues.SMTPToken.trim(),
      SMTPSSLEnabled: defaultValues.SMTPSSLEnabled,
      SMTPForceAuthLogin: defaultValues.SMTPForceAuthLogin,
    }

    const updates: Array<{ key: string; value: string | boolean }> = []

    if (sanitized.SMTPServer !== initial.SMTPServer) {
      updates.push({ key: 'SMTPServer', value: sanitized.SMTPServer })
    }

    if (sanitized.SMTPPort !== initial.SMTPPort) {
      updates.push({ key: 'SMTPPort', value: sanitized.SMTPPort })
    }

    if (sanitized.SMTPAccount !== initial.SMTPAccount) {
      updates.push({ key: 'SMTPAccount', value: sanitized.SMTPAccount })
    }

    if (sanitized.SMTPFrom !== initial.SMTPFrom) {
      updates.push({ key: 'SMTPFrom', value: sanitized.SMTPFrom })
    }

    if (sanitized.SMTPToken && sanitized.SMTPToken !== initial.SMTPToken) {
      updates.push({ key: 'SMTPToken', value: sanitized.SMTPToken })
    }

    if (sanitized.SMTPSSLEnabled !== initial.SMTPSSLEnabled) {
      updates.push({
        key: 'SMTPSSLEnabled',
        value: sanitized.SMTPSSLEnabled,
      })
    }

    if (sanitized.SMTPForceAuthLogin !== initial.SMTPForceAuthLogin) {
      updates.push({
        key: 'SMTPForceAuthLogin',
        value: sanitized.SMTPForceAuthLogin,
      })
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  const normalizedValues = (): EmailFormValues => {
    const values = emailSchema.parse(form.getValues())
    return {
      SMTPServer: values.SMTPServer.trim(),
      SMTPPort: values.SMTPPort.trim(),
      SMTPAccount: values.SMTPAccount.trim(),
      SMTPFrom: values.SMTPFrom.trim(),
      SMTPToken: values.SMTPToken.trim(),
      SMTPSSLEnabled: values.SMTPSSLEnabled,
      SMTPForceAuthLogin: values.SMTPForceAuthLogin,
    }
  }

  const exportConfig = async () => {
    const values = normalizedValues()
    const safeValues = {
      ...values,
      SMTPToken: values.SMTPToken ? REDACTED_SECRET : '',
    }
    const payload = {
      SMTPEmail: safeValues,
      ...safeValues,
    }
    const text = JSON.stringify(payload, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'renewapi-smtp-email.json'
    link.click()
    URL.revokeObjectURL(url)

    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('SMTP Email JSON exported and copied'))
    } catch {
      toast.success(t('SMTP Email JSON exported'))
    }
  }

  const openImportDialog = () => {
    const values = normalizedValues()
    setImportText(
      JSON.stringify(
        {
          SMTPEmail: {
            ...values,
            SMTPToken: values.SMTPToken ? REDACTED_SECRET : '',
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
      const raw = JSON.parse(importText) as EmailImportExportPayload
      const source = raw.SMTPEmail ?? raw
      const current = normalizedValues()
      const parsed = emailSchema.parse({
        ...current,
        ...source,
        SMTPToken:
          source.SMTPToken === REDACTED_SECRET || source.SMTPToken === undefined
            ? current.SMTPToken
            : source.SMTPToken,
      })

      Object.entries(parsed).forEach(([key, value]) => {
        form.setValue(key as keyof EmailFormValues, value, {
          shouldDirty: true,
          shouldValidate: true,
        })
      })
      await form.trigger()
      setImportOpen(false)
      toast.success(t('SMTP Email imported. Click Save to apply.'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Invalid SMTP JSON')
      )
    }
  }

  return (
    <SettingsSection title={t('SMTP Email')}>
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
            saveLabel='Save SMTP settings'
          />
          <FormField
            control={form.control}
            name='SMTPServer'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('SMTP Host')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    placeholder={t('smtp.example.com')}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Hostname or IP of your SMTP provider')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='SMTPPort'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Port')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      type='number'
                      placeholder='587'
                      {...field}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Common ports include 25, 465, and 587')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='SMTPSSLEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Enable SSL/TLS')}</FormLabel>
                    <FormDescription>
                      {t('Use secure connection when sending emails')}
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
              name='SMTPForceAuthLogin'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Force AUTH LOGIN')}</FormLabel>
                    <FormDescription>
                      {t('Force SMTP authentication using AUTH LOGIN method')}
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
          </div>

          <FormField
            control={form.control}
            name='SMTPAccount'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Username')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    placeholder={t('noreply@example.com')}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Account used when authenticating with the SMTP server')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='SMTPFrom'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('From Address')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    placeholder={t('New API &lt;noreply@example.com&gt;')}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Display name and email used in outgoing messages')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='SMTPToken'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Password / Access Token')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    type='password'
                    placeholder={t('Enter new token to update')}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Leave blank to keep the existing credential')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{t('Import SMTP Email JSON')}</DialogTitle>
            <DialogDescription>
              {t(
                'Paste an exported SMTP JSON payload. Redacted credentials keep the current saved secret.'
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
