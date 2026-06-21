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
import {
  DASHBOARD_HEALTH_FILTER_VALUES,
  DASHBOARD_CHART_TIME_RANGE_DAYS_VALUES,
  DASHBOARD_CONSUMPTION_CHART_VALUES,
  DASHBOARD_MODEL_ANALYTICS_CHART_VALUES,
  DASHBOARD_PAGE_SIZE_VALUES,
  DASHBOARD_TIME_RANGE_VALUES,
  DASHBOARD_TREND_MODE_VALUES,
  DASHBOARD_VISIBLE_SECTION_VALUES,
  type DashboardChartTimeRangeDays,
  type DashboardConsumptionChart,
  type DashboardHealthFilter,
  type DashboardModelAnalyticsChart,
  type DashboardPageSize,
  type DashboardTimeRange,
  type DashboardTrendMode,
  type DashboardVisibleSection,
} from '@/lib/dashboard-defaults'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

const dataDashboardSchema = z
  .object({
    DataExportEnabled: z.boolean(),
    DataExportInterval: z.number().int().min(1).max(1440),
    DataExportDefaultTime: z.enum(['hour', 'day', 'week']),
    DashboardDefaultTimeRange: z.enum(DASHBOARD_TIME_RANGE_VALUES),
    DashboardAutoRefreshEnabled: z.boolean(),
    DashboardRefreshIntervalSeconds: z.union([
      z.literal(5),
      z.literal(15),
      z.literal(30),
      z.literal(60),
    ]),
    DashboardDefaultPageSize: z.union([
      z.literal(10),
      z.literal(25),
      z.literal(50),
      z.literal(100),
    ]),
    DashboardDefaultHealthFilter: z.enum(DASHBOARD_HEALTH_FILTER_VALUES),
    DashboardDefaultTrendMode: z.enum(DASHBOARD_TREND_MODE_VALUES),
    DashboardDefaultChartTimeRangeDays: z.union([
      z.literal(1),
      z.literal(7),
      z.literal(14),
      z.literal(29),
    ]),
    DashboardDefaultConsumptionChart: z.enum(
      DASHBOARD_CONSUMPTION_CHART_VALUES
    ),
    DashboardDefaultModelAnalyticsChart: z.enum(
      DASHBOARD_MODEL_ANALYTICS_CHART_VALUES
    ),
    DashboardVisibleSections: z
      .array(z.enum(DASHBOARD_VISIBLE_SECTION_VALUES))
      .min(1, 'Select at least one dashboard section'),
    DashboardSlowFirstTokenThresholdMs: z.number().min(100).max(120000),
    DashboardErrorRateWarningThreshold: z.number().min(0).max(100),
    DashboardErrorRateCriticalThreshold: z.number().min(0).max(100),
    DashboardSuccessRateGoodThreshold: z.number().min(0).max(100),
    DashboardSuccessRateDegradedThreshold: z.number().min(0).max(100),
  })
  .superRefine((values, context) => {
    if (
      values.DashboardErrorRateCriticalThreshold <
      values.DashboardErrorRateWarningThreshold
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Critical threshold must be greater than warning threshold',
        path: ['DashboardErrorRateCriticalThreshold'],
      })
    }
    if (
      values.DashboardSuccessRateGoodThreshold <
      values.DashboardSuccessRateDegradedThreshold
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Good threshold must be greater than degraded threshold',
        path: ['DashboardSuccessRateGoodThreshold'],
      })
    }
  })

type DataDashboardFormValues = z.infer<typeof dataDashboardSchema>

type DashboardSectionProps = {
  defaultValues: DataDashboardFormValues
}

type DashboardDefaultsPayload = Partial<
  Omit<DataDashboardFormValues, 'DashboardVisibleSections'> & {
    DashboardVisibleSections: DashboardVisibleSection[] | string
  }
>

type DashboardImportExportPayload = DashboardDefaultsPayload & {
  DashboardDefaults?: DashboardDefaultsPayload
}

const granularityOptions = [
  { label: 'Hour', value: 'hour' },
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
]

const dashboardTimeRangeOptions: Array<{
  label: string
  value: DashboardTimeRange
}> = [
  { label: '1 day', value: '1d' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '1 year', value: '1y' },
  { label: 'All time', value: 'all' },
]

const dashboardRefreshIntervalOptions = [
  { label: '5 seconds', value: 5 },
  { label: '15 seconds', value: 15 },
  { label: '30 seconds', value: 30 },
  { label: '60 seconds', value: 60 },
] as const

const dashboardPageSizeOptions: Array<{
  label: string
  value: DashboardPageSize
}> = DASHBOARD_PAGE_SIZE_VALUES.map((value) => ({
  label: `${value} rows`,
  value,
}))

const dashboardHealthFilterOptions: Array<{
  label: string
  value: DashboardHealthFilter
}> = [
  { label: 'All rows', value: 'all' },
  { label: 'Active only', value: 'active' },
  { label: 'With failures', value: 'risk' },
  { label: 'Slow first token', value: 'slow' },
]

const dashboardTrendModeOptions: Array<{
  label: string
  value: DashboardTrendMode
}> = [
  { label: 'Overview', value: 'overview' },
  { label: 'Traffic', value: 'traffic' },
  { label: 'Reliability', value: 'reliability' },
  { label: 'Latency', value: 'latency' },
  { label: 'Spend', value: 'spend' },
]

const dashboardChartTimeRangeOptions: Array<{
  label: string
  value: DashboardChartTimeRangeDays
}> = DASHBOARD_CHART_TIME_RANGE_DAYS_VALUES.map((value) => ({
  label: value === 1 ? '1 day' : `${value} days`,
  value,
}))

const dashboardConsumptionChartOptions: Array<{
  label: string
  value: DashboardConsumptionChart
}> = [
  { label: 'Bar chart', value: 'bar' },
  { label: 'Area chart', value: 'area' },
]

const dashboardModelAnalyticsChartOptions: Array<{
  label: string
  value: DashboardModelAnalyticsChart
}> = [
  { label: 'Call trend', value: 'trend' },
  { label: 'Call count distribution', value: 'proportion' },
  { label: 'Call count ranking', value: 'top' },
]

const dashboardVisibleSectionOptions: Array<{
  label: string
  value: DashboardVisibleSection
}> = [
  { label: 'Overview', value: 'overview' },
  { label: 'Model analytics', value: 'models' },
  { label: 'Channel analytics', value: 'channels' },
  { label: 'User analytics', value: 'users' },
]

export function DashboardSection({ defaultValues }: DashboardSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const form = useForm<DataDashboardFormValues>({
    resolver: zodResolver(dataDashboardSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const serializeDashboardValues = (values: DataDashboardFormValues) => ({
    ...values,
    DashboardVisibleSections: values.DashboardVisibleSections.join(','),
  })

  const onSubmit = async (values: DataDashboardFormValues) => {
    const serializedValues = serializeDashboardValues(values)
    const serializedDefaults = serializeDashboardValues(defaultValues)
    const updates = Object.entries(serializedValues).filter(
      ([key, value]) =>
        value !== serializedDefaults[key as keyof typeof serializedDefaults]
    )

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value })
    }
  }

  const exportConfig = async () => {
    const text = JSON.stringify(
      serializeDashboardValues(form.getValues()),
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
    link.download = 'renewapi-dashboard-defaults.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('Dashboard defaults exported'))
  }

  const openImportDialog = () => {
    setImportText('')
    setImportOpen(true)
  }

  const importConfig = () => {
    try {
      const raw = JSON.parse(importText) as DashboardImportExportPayload
      const payload =
        'DashboardDefaults' in raw && raw.DashboardDefaults
          ? raw.DashboardDefaults
          : raw
      const currentValues = form.getValues()
      const importedSections = payload.DashboardVisibleSections
      const DashboardVisibleSections = Array.isArray(importedSections)
        ? importedSections
        : typeof importedSections === 'string'
          ? importedSections
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : currentValues.DashboardVisibleSections
      const parsedValues = dataDashboardSchema.parse({
        ...currentValues,
        ...payload,
        DashboardVisibleSections,
      })

      form.reset(parsedValues)
      setImportOpen(false)
      toast.success(t('Dashboard defaults imported'))
    } catch {
      toast.error(t('Invalid dashboard defaults JSON'))
    }
  }

  const isEnabled = form.watch('DataExportEnabled')

  return (
    <SettingsSection title={t('Data Dashboard')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <div className='flex flex-wrap justify-end gap-2'>
            <Button type='button' variant='outline' onClick={exportConfig}>
              <Download className='mr-2 h-4 w-4' />
              {t('Export JSON')}
            </Button>
            <Button type='button' variant='outline' onClick={openImportDialog}>
              <Upload className='mr-2 h-4 w-4' />
              {t('Import JSON')}
            </Button>
          </div>
          <FormField
            control={form.control}
            name='DataExportEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Data Dashboard')}</FormLabel>
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

          <div className='grid gap-6 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='DataExportInterval'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Refresh interval (minutes)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      max={1440}
                      step={1}
                      {...safeNumberFieldProps(field)}
                      disabled={!isEnabled}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Keep this above 1 minute to avoid heavy database load')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='DataExportDefaultTime'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Default time granularity')}</FormLabel>
                  <Select
                    items={[
                      ...granularityOptions.map((option) => ({
                        value: option.value,
                        label: t(option.label),
                      })),
                    ]}
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!isEnabled}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select granularity')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {granularityOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t(
                      'UI granularity only &mdash; data is still aggregated hourly'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='DashboardDefaultTimeRange'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Default statistics time range')}</FormLabel>
                  <Select
                    items={[
                      ...dashboardTimeRangeOptions.map((option) => ({
                        value: option.value,
                        label: t(option.label),
                      })),
                    ]}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select time range')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {dashboardTimeRangeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t(
                      'Used by dashboard pages when the browser has no saved local preference'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='DashboardRefreshIntervalSeconds'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('Default dashboard refresh interval')}
                  </FormLabel>
                  <Select
                    items={[
                      ...dashboardRefreshIntervalOptions.map((option) => ({
                        value: String(option.value),
                        label: t(option.label),
                      })),
                    ]}
                    onValueChange={(value) => field.onChange(Number(value))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select interval')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {dashboardRefreshIntervalOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                          >
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Applies to dashboards with auto refresh enabled')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='DashboardAutoRefreshEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>
                    {t('Enable dashboard auto refresh by default')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'Users can still override this from their own dashboard controls'
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

          <div className='grid gap-6 sm:grid-cols-3'>
            <FormField
              control={form.control}
              name='DashboardDefaultPageSize'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Default table page size')}</FormLabel>
                  <Select
                    items={dashboardPageSizeOptions.map((option) => ({
                      value: String(option.value),
                      label: t(option.label),
                    }))}
                    onValueChange={(value) => field.onChange(Number(value))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select page size')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {dashboardPageSizeOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                          >
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Used by model, channel, channel-user, and user tables')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='DashboardDefaultHealthFilter'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Default health filter')}</FormLabel>
                  <Select
                    items={dashboardHealthFilterOptions.map((option) => ({
                      value: option.value,
                      label: t(option.label),
                    }))}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select filter')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {dashboardHealthFilterOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Applied when a dashboard table has no saved view')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='DashboardDefaultTrendMode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Default trend mode')}</FormLabel>
                  <Select
                    items={dashboardTrendModeOptions.map((option) => ({
                      value: option.value,
                      label: t(option.label),
                    }))}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select trend mode')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {dashboardTrendModeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Initial trend view for overview and drilldown charts')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='DashboardVisibleSections'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Visible dashboard sections')}</FormLabel>
                <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
                  {dashboardVisibleSectionOptions.map((option) => {
                    const checked = field.value.includes(option.value)
                    return (
                      <label
                        key={option.value}
                        className='bg-muted/20 flex items-center gap-2 rounded-md border px-3 py-2 text-sm'
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            const next = Boolean(nextChecked)
                              ? [...field.value, option.value]
                              : field.value.filter(
                                  (value) => value !== option.value
                                )
                            field.onChange(
                              DASHBOARD_VISIBLE_SECTION_VALUES.filter((value) =>
                                next.includes(value)
                              )
                            )
                          }}
                        />
                        <span>{t(option.label)}</span>
                      </label>
                    )
                  })}
                </div>
                <FormDescription>
                  {t('Controls which dashboard tabs are visible globally')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid gap-6 sm:grid-cols-3'>
            <FormField
              control={form.control}
              name='DashboardDefaultChartTimeRangeDays'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Default chart time window')}</FormLabel>
                  <Select
                    items={dashboardChartTimeRangeOptions.map((option) => ({
                      value: String(option.value),
                      label: t(option.label),
                    }))}
                    onValueChange={(value) => field.onChange(Number(value))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select chart window')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {dashboardChartTimeRangeOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                          >
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Used by legacy dashboard charts with no saved view')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='DashboardDefaultConsumptionChart'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Default consumption chart')}</FormLabel>
                  <Select
                    items={dashboardConsumptionChartOptions.map((option) => ({
                      value: option.value,
                      label: t(option.label),
                    }))}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select chart type')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {dashboardConsumptionChartOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Initial model consumption distribution chart type')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='DashboardDefaultModelAnalyticsChart'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Default model analytics chart')}</FormLabel>
                  <Select
                    items={dashboardModelAnalyticsChartOptions.map(
                      (option) => ({
                        value: option.value,
                        label: t(option.label),
                      })
                    )}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select chart type')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {dashboardModelAnalyticsChartOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t(
                      'Initial model calls chart when no local preference exists'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 sm:grid-cols-3'>
            <FormField
              control={form.control}
              name='DashboardSlowFirstTokenThresholdMs'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Slow first-token threshold')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={100}
                      max={120000}
                      step={100}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Milliseconds used by slow filters and latency risk views'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='DashboardErrorRateWarningThreshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Error warning threshold')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      max={100}
                      step={0.1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Error rate percentage that turns rows yellow')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='DashboardErrorRateCriticalThreshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Error critical threshold')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      max={100}
                      step={0.1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Error rate percentage that turns rows red')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='DashboardSuccessRateGoodThreshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Good success-rate threshold')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      max={100}
                      step={0.1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Success rate percentage that receives the healthy badge'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='DashboardSuccessRateDegradedThreshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Degraded success-rate threshold')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      max={100}
                      step={0.1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Success rate percentage below which rows become critical'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SettingsForm>
      </Form>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Import dashboard defaults')}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={t('Paste dashboard defaults JSON')}
            className='min-h-[260px] font-mono text-sm'
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
