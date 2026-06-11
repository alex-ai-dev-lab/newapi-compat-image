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
import { useState, type ChangeEvent } from 'react'
import * as z from 'zod'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Download, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
  SettingsFormGrid,
  SettingsFormGridItem,
} from '../components/settings-form-layout'
import {
  SettingsPageActionsPortal,
  SettingsPageFormActions,
} from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

const quotaSchema = z.object({
  QuotaForNewUser: z.coerce.number().min(0),
  PreConsumedQuota: z.coerce.number().min(0),
  QuotaForInviter: z.coerce.number().min(0),
  QuotaForInvitee: z.coerce.number().min(0),
  TopUpLink: z.string(),
  general_setting: z.object({
    docs_link: z.string(),
  }),
  quota_setting: z.object({
    enable_free_model_pre_consume: z.boolean(),
  }),
})

type QuotaFormValues = z.infer<typeof quotaSchema>

type QuotaSettingsSectionProps = {
  defaultValues: QuotaFormValues
  complianceConfirmed?: boolean
}

type QuotaImportExportPayload = Partial<QuotaFormValues> & {
  BillingBasics?: {
    quota?: Partial<QuotaFormValues> & Record<string, unknown>
  }
  quota?: Partial<QuotaFormValues> & Record<string, unknown>
  'general_setting.docs_link'?: unknown
  'quota_setting.enable_free_model_pre_consume'?: unknown
}

const toBoolean = (value: unknown) =>
  typeof value === 'boolean' ? value : undefined

const toNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const toStringValue = (value: unknown) =>
  typeof value === 'string' ? value : undefined

export function QuotaSettingsSection({
  defaultValues,
  complianceConfirmed = true,
}: QuotaSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const handleNumberChange =
    (onChange: (value: number | string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(
        event.target.value === '' ? '' : event.currentTarget.valueAsNumber
      )
    }

  const { form, handleSubmit, isDirty, isSubmitting } =
    useSettingsForm<QuotaFormValues>({
      resolver: zodResolver(quotaSchema) as Resolver<
        QuotaFormValues,
        unknown,
        QuotaFormValues
      >,
      defaultValues,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          await updateOption.mutateAsync({
            key,
            value: value as string | number | boolean,
          })
        }
      },
    })

  const exportConfig = async () => {
    const values = form.getValues()
    const payload = {
      BillingBasics: {
        quota: values,
      },
      QuotaForNewUser: values.QuotaForNewUser,
      PreConsumedQuota: values.PreConsumedQuota,
      QuotaForInviter: values.QuotaForInviter,
      QuotaForInvitee: values.QuotaForInvitee,
      TopUpLink: values.TopUpLink,
      'general_setting.docs_link': values.general_setting.docs_link,
      'quota_setting.enable_free_model_pre_consume':
        values.quota_setting.enable_free_model_pre_consume,
    }
    const text = JSON.stringify(payload, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'newapi-quota-settings.json'
    link.click()
    URL.revokeObjectURL(url)

    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('Quota settings JSON exported and copied'))
    } catch {
      toast.success(t('Quota settings JSON exported'))
    }
  }

  const openImportDialog = () => {
    setImportText(
      JSON.stringify(
        {
          BillingBasics: {
            quota: form.getValues(),
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
      const raw = JSON.parse(importText) as QuotaImportExportPayload
      const source = raw.BillingBasics?.quota ?? raw.quota ?? raw
      const next = form.getValues()

      const quotaForNewUser = toNumber(source.QuotaForNewUser)
      if (quotaForNewUser !== undefined) next.QuotaForNewUser = quotaForNewUser

      const preConsumedQuota = toNumber(source.PreConsumedQuota)
      if (preConsumedQuota !== undefined) {
        next.PreConsumedQuota = preConsumedQuota
      }

      const quotaForInviter = toNumber(source.QuotaForInviter)
      if (quotaForInviter !== undefined) next.QuotaForInviter = quotaForInviter

      const quotaForInvitee = toNumber(source.QuotaForInvitee)
      if (quotaForInvitee !== undefined) next.QuotaForInvitee = quotaForInvitee

      const topUpLink = toStringValue(source.TopUpLink)
      if (topUpLink !== undefined) next.TopUpLink = topUpLink

      const docsLink = toStringValue(
        source.general_setting?.docs_link ?? source['general_setting.docs_link']
      )
      if (docsLink !== undefined) next.general_setting.docs_link = docsLink

      const freeModelPreConsume = toBoolean(
        source.quota_setting?.enable_free_model_pre_consume ??
          source['quota_setting.enable_free_model_pre_consume']
      )
      if (freeModelPreConsume !== undefined) {
        next.quota_setting.enable_free_model_pre_consume = freeModelPreConsume
      }

      const parsed = quotaSchema.parse(next)
      form.setValue('QuotaForNewUser', parsed.QuotaForNewUser, {
        shouldDirty: true,
        shouldValidate: true,
      })
      form.setValue('PreConsumedQuota', parsed.PreConsumedQuota, {
        shouldDirty: true,
        shouldValidate: true,
      })
      form.setValue('QuotaForInviter', parsed.QuotaForInviter, {
        shouldDirty: true,
        shouldValidate: true,
      })
      form.setValue('QuotaForInvitee', parsed.QuotaForInvitee, {
        shouldDirty: true,
        shouldValidate: true,
      })
      form.setValue('TopUpLink', parsed.TopUpLink, {
        shouldDirty: true,
        shouldValidate: true,
      })
      form.setValue(
        'general_setting.docs_link',
        parsed.general_setting.docs_link,
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      )
      form.setValue(
        'quota_setting.enable_free_model_pre_consume',
        parsed.quota_setting.enable_free_model_pre_consume,
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      )
      await form.trigger()
      setImportOpen(false)
      toast.success(t('Quota settings imported. Click Save to apply.'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Invalid quota settings JSON')
      )
    }
  }

  return (
    <SettingsSection title={t('Quota Settings')}>
      <FormNavigationGuard when={isDirty} />

      {!complianceConfirmed ? (
        <Alert variant='destructive'>
          <AlertDescription>
            {t(
              'Non-zero invitation rewards require compliance confirmation in Payment Gateway settings.'
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <SettingsForm onSubmit={handleSubmit}>
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
            onSave={handleSubmit}
            isSaving={updateOption.isPending || isSubmitting}
          />
          <FormDirtyIndicator isDirty={isDirty} />
          <SettingsFormGrid>
            <FormField
              control={form.control}
              name='QuotaForNewUser'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('New User Quota')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      value={field.value ?? ''}
                      onChange={handleNumberChange(field.onChange)}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Initial quota given to new users')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='PreConsumedQuota'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Pre-Consumed Quota')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      value={field.value ?? ''}
                      onChange={handleNumberChange(field.onChange)}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Quota consumed before charging users')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='QuotaForInviter'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Inviter Reward')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      value={field.value ?? ''}
                      onChange={handleNumberChange(field.onChange)}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Quota given to users who invite others')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='QuotaForInvitee'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Invitee Reward')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      value={field.value ?? ''}
                      onChange={handleNumberChange(field.onChange)}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Quota given to invited users')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SettingsFormGridItem span='full'>
              <FormField
                control={form.control}
                name='quota_setting.enable_free_model_pre_consume'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Pre-Consume for Free Models')}</FormLabel>
                      <FormDescription>
                        {t(
                          'When enabled, zero-cost models also pre-consume quota before final settlement.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateOption.isPending}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />
            </SettingsFormGridItem>

            <FormField
              control={form.control}
              name='TopUpLink'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Top-Up Link')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('https://example.com/topup')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('External link for users to purchase quota')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='general_setting.docs_link'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Documentation Link')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('https://docs.example.com')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Link to your documentation site')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsFormGrid>
        </SettingsForm>
      </Form>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{t('Import quota settings JSON')}</DialogTitle>
            <DialogDescription>
              {t(
                'Paste an exported quota settings JSON payload. Imported values stay local until you save settings.'
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            className='min-h-80 font-mono text-xs'
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
