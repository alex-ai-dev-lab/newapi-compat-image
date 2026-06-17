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
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import {
  SettingsPageFormActions,
} from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const antiPoisonSchema = z.object({
  'anti_poison_setting.enabled': z.boolean(),
  'anti_poison_setting.channel_test_nonce_enabled': z.boolean(),
  'anti_poison_setting.response_proof_enabled': z.boolean(),
  'anti_poison_setting.tool_call_guard_enabled': z.boolean(),
  'anti_poison_setting.tool_call_guard_strict': z.boolean(),
  'anti_poison_setting.failure_mode': z.enum(['block', 'warn']),
  'anti_poison_setting.strip_guard_output': z.boolean(),
  'anti_poison_setting.signed_header_audit_enabled': z.boolean(),
  'anti_poison_setting.signed_header_audit_secret': z.string().optional(),
  'anti_poison_setting.max_guard_scan_bytes': z.coerce
    .number()
    .min(4096)
    .max(1048576),
  'anti_poison_setting.downstream_proof_header': z.boolean(),
  'anti_poison_setting.profiles': z.string().refine(isJsonObject, 'Invalid JSON object'),
  'anti_poison_setting.channels': z.string().refine(isJsonObject, 'Invalid JSON object'),
})

type AntiPoisonFormInput = z.input<typeof antiPoisonSchema>
type AntiPoisonFormValues = z.output<typeof antiPoisonSchema>

function isJsonObject(value: string): boolean {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
  } catch {
    return false
  }
}

type AntiPoisonGuardSectionProps = {
  defaultValues: AntiPoisonFormValues
}

export function AntiPoisonGuardSection({
  defaultValues,
}: AntiPoisonGuardSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<AntiPoisonFormInput, unknown, AntiPoisonFormValues>({
    resolver: zodResolver(antiPoisonSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const onSubmit = async (data: AntiPoisonFormValues) => {
    const updates = Object.entries(data).filter(
      ([key, value]) => value !== defaultValues[key as keyof AntiPoisonFormValues]
    )
    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value: value ?? '' })
    }
  }

  return (
    <SettingsSection title={t('Anti-Poison Guard')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name='anti_poison_setting.enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Anti-Poison')}</FormLabel>
                  <FormDescription>
                    {t('Validate upstream behavior inside NewAPI')}
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
            name='anti_poison_setting.channel_test_nonce_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Channel Test Nonce')}</FormLabel>
                  <FormDescription>
                    {t('Require text channel tests to echo a random nonce')}
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
            name='anti_poison_setting.tool_call_guard_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Tool Call Guard')}</FormLabel>
                  <FormDescription>
                    {t('Require guarded tool calls on tool-enabled requests')}
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
            name='anti_poison_setting.response_proof_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Response Proof')}</FormLabel>
                  <FormDescription>
                    {t('Experimental normal text proof, disabled by default')}
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
            name='anti_poison_setting.tool_call_guard_strict'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Strict Tool Matching')}</FormLabel>
                  <FormDescription>
                    {t('Guard JSON must match the tool name')}
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
            name='anti_poison_setting.failure_mode'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Failure Mode')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='block'>{t('Block')}</SelectItem>
                    <SelectItem value='warn'>{t('Warn only')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='anti_poison_setting.max_guard_scan_bytes'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Guard Scan Limit')}</FormLabel>
                <FormControl>
                  <Input type='number' min={4096} max={1048576} {...field} />
                </FormControl>
                <FormDescription>{t('Bytes per guarded response')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='anti_poison_setting.strip_guard_output'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Strip Guard Output')}</FormLabel>
                  <FormDescription>
                    {t('Remove nonce and guard markers before returning')}
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
            name='anti_poison_setting.signed_header_audit_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Signed Header Audit')}</FormLabel>
                  <FormDescription>
                    {t('Optional internal proof, hidden from downstream clients')}
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
            name='anti_poison_setting.signed_header_audit_secret'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Audit Secret')}</FormLabel>
                <FormControl>
                  <Input type='password' autoComplete='off' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='anti_poison_setting.downstream_proof_header'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Expose Proof Header')}</FormLabel>
                  <FormDescription>
                    {t('Keep disabled for transparent client behavior')}
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

          <div className='grid gap-3 rounded-md border p-3'>
            <div className='grid gap-2 md:grid-cols-3'>
              <div className='rounded-md border p-3'>
                <div className='text-sm font-medium'>{t('Channel 77')}</div>
                <div className='text-muted-foreground text-xs'>trusted · direct_stream_light_scan · opaque warn</div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-sm font-medium'>{t('Channel 101')}</div>
                <div className='text-muted-foreground text-xs'>probation · envelope required · aggregate_then_replay</div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-sm font-medium'>{t('Channel 94')}</div>
                <div className='text-muted-foreground text-xs'>quarantine · production routing disabled</div>
              </div>
            </div>

            <FormField
              control={form.control}
              name='anti_poison_setting.profiles'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Profile JSON')}</FormLabel>
                  <FormControl>
                    <Textarea className='min-h-32 font-mono text-xs' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('JSON import/export for trusted, unknown, probation, and quarantine profile configuration.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='anti_poison_setting.channels'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Channel Profile JSON')}</FormLabel>
                  <FormControl>
                    <Textarea className='min-h-24 font-mono text-xs' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Default mapping: 77 trusted, 101 probation, 94 quarantine.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <SettingsPageFormActions
            isSaving={updateOption.isPending}
            onSave={form.handleSubmit(onSubmit)}
            onReset={() => form.reset(defaultValues)}
            isSaveDisabled={!form.formState.isDirty}
            isResetDisabled={!form.formState.isDirty}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
