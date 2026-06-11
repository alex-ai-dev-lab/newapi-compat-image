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
import type { Control, Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Download, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  CONTENT_LAYOUT_VALUES,
  DEFAULT_THEME_CUSTOMIZATION,
  THEME_FONTS,
  THEME_PRESETS,
  THEME_RADII,
  THEME_SCALES,
  type ContentLayout,
  type ThemeFont,
  type ThemePreset,
  type ThemeRadius,
  type ThemeScale,
} from '@/lib/theme-customization'
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
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import {
  SettingsForm,
  SettingsFormGrid,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

const themePresetValues = THEME_PRESETS.map((item) => item.value) as [
  ThemePreset,
  ...ThemePreset[],
]
const themeFontValues = THEME_FONTS.map((item) => item.value) as [
  ThemeFont,
  ...ThemeFont[],
]
const themeRadiusValues = THEME_RADII.map((item) => item.value) as [
  ThemeRadius,
  ...ThemeRadius[],
]
const themeScaleValues = THEME_SCALES.map((item) => item.value) as [
  ThemeScale,
  ...ThemeScale[],
]
const contentLayoutValues = Array.from(CONTENT_LAYOUT_VALUES) as [
  ContentLayout,
  ...ContentLayout[],
]

const appearanceSchema = z.object({
  theme: z.object({
    customization_preset: z.enum(themePresetValues),
    customization_font: z.enum(themeFontValues),
    customization_radius: z.enum(themeRadiusValues),
    customization_scale: z.enum(themeScaleValues),
    content_layout: z.enum(contentLayoutValues),
    custom_accent_enabled: z.boolean(),
    custom_accent_color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Use #RRGGBB format'),
    custom_palette_enabled: z.boolean(),
    custom_background_color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Use #RRGGBB format'),
    custom_surface_color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Use #RRGGBB format'),
    custom_sidebar_color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Use #RRGGBB format'),
    custom_chart_color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Use #RRGGBB format'),
  }),
})

type AppearanceFormValues = z.infer<typeof appearanceSchema>

type AppearanceSettingsProps = {
  defaultValues: AppearanceFormValues
}

type AppearanceFieldName =
  | 'theme.customization_preset'
  | 'theme.customization_font'
  | 'theme.customization_radius'
  | 'theme.customization_scale'
  | 'theme.content_layout'
  | 'theme.custom_accent_enabled'
  | 'theme.custom_accent_color'
  | 'theme.custom_palette_enabled'
  | 'theme.custom_background_color'
  | 'theme.custom_surface_color'
  | 'theme.custom_sidebar_color'
  | 'theme.custom_chart_color'

type AppearanceSelectFieldName = Exclude<
  AppearanceFieldName,
  | 'theme.custom_accent_enabled'
  | 'theme.custom_accent_color'
  | 'theme.custom_palette_enabled'
  | 'theme.custom_background_color'
  | 'theme.custom_surface_color'
  | 'theme.custom_sidebar_color'
  | 'theme.custom_chart_color'
>

type AppearanceColorFieldName =
  | 'theme.custom_accent_color'
  | 'theme.custom_background_color'
  | 'theme.custom_surface_color'
  | 'theme.custom_sidebar_color'
  | 'theme.custom_chart_color'

type AppearanceThemeKey = keyof AppearanceFormValues['theme']

type AppearancePayload = Partial<
  Record<AppearanceFieldName, string | boolean>
> & {
  theme?: Partial<Record<AppearanceThemeKey, string | boolean>>
}

type AppearanceImportExportPayload = AppearancePayload & {
  Appearance?: AppearancePayload
}

const appearanceFieldMap: Array<{
  name: AppearanceFieldName
  themeKey: AppearanceThemeKey
  normalize: (value: unknown) => unknown
}> = [
  {
    name: 'theme.customization_preset',
    themeKey: 'customization_preset',
    normalize: String,
  },
  {
    name: 'theme.customization_font',
    themeKey: 'customization_font',
    normalize: String,
  },
  {
    name: 'theme.customization_radius',
    themeKey: 'customization_radius',
    normalize: String,
  },
  {
    name: 'theme.customization_scale',
    themeKey: 'customization_scale',
    normalize: String,
  },
  {
    name: 'theme.content_layout',
    themeKey: 'content_layout',
    normalize: String,
  },
  {
    name: 'theme.custom_accent_enabled',
    themeKey: 'custom_accent_enabled',
    normalize: (value) => value === true || value === 'true',
  },
  {
    name: 'theme.custom_accent_color',
    themeKey: 'custom_accent_color',
    normalize: String,
  },
  {
    name: 'theme.custom_palette_enabled',
    themeKey: 'custom_palette_enabled',
    normalize: (value) => value === true || value === 'true',
  },
  {
    name: 'theme.custom_background_color',
    themeKey: 'custom_background_color',
    normalize: String,
  },
  {
    name: 'theme.custom_surface_color',
    themeKey: 'custom_surface_color',
    normalize: String,
  },
  {
    name: 'theme.custom_sidebar_color',
    themeKey: 'custom_sidebar_color',
    normalize: String,
  },
  {
    name: 'theme.custom_chart_color',
    themeKey: 'custom_chart_color',
    normalize: String,
  },
]

const contentLayoutOptions: Array<{
  value: ContentLayout
  label: string
  description: string
}> = [
  {
    value: 'full',
    label: 'Full width',
    description: 'Use the available viewport width for dense admin pages.',
  },
  {
    value: 'centered',
    label: 'Centered',
    description: 'Constrain content width for a quieter reading layout.',
  },
]

export function AppearanceSettings({ defaultValues }: AppearanceSettingsProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<AppearanceFormValues>({
      resolver: zodResolver(appearanceSchema) as Resolver<
        AppearanceFormValues,
        unknown,
        AppearanceFormValues
      >,
      defaultValues,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          await updateOption.mutateAsync({
            key,
            value: value as string,
          })
        }
      },
    })

  const buildExportPayload = () => {
    const values = form.getValues()
    return appearanceFieldMap.reduce<
      Partial<Record<AppearanceFieldName, string | boolean>>
    >((acc, field) => {
      acc[field.name] = values.theme[field.themeKey]
      return acc
    }, {})
  }

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
    link.download = 'newapi-appearance.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('Appearance exported'))
  }

  const openImportDialog = () => {
    setImportText('')
    setImportOpen(true)
  }

  const importConfig = () => {
    try {
      const raw = JSON.parse(importText) as AppearanceImportExportPayload
      const payload = raw.Appearance ?? raw
      const nextTheme: AppearanceFormValues['theme'] = {
        ...form.getValues().theme,
      }

      appearanceFieldMap.forEach((field) => {
        const value =
          payload[field.name] ??
          payload.theme?.[field.themeKey] ??
          raw.theme?.[field.themeKey]

        if (value !== undefined) {
          nextTheme[field.themeKey] = field.normalize(value) as never
        }
      })

      const parsedValues = appearanceSchema.parse({ theme: nextTheme })

      appearanceFieldMap.forEach((field) => {
        form.setValue(field.name, parsedValues.theme[field.themeKey], {
          shouldDirty: true,
          shouldValidate: true,
        })
      })
      setImportOpen(false)
      toast.success(t('Appearance imported'))
    } catch {
      toast.error(t('Invalid appearance JSON'))
    }
  }

  const resetToFactoryDefaults = () => {
    form.reset({
      theme: {
        customization_preset: DEFAULT_THEME_CUSTOMIZATION.preset,
        customization_font: DEFAULT_THEME_CUSTOMIZATION.font,
        customization_radius: DEFAULT_THEME_CUSTOMIZATION.radius,
        customization_scale: DEFAULT_THEME_CUSTOMIZATION.scale,
        content_layout: DEFAULT_THEME_CUSTOMIZATION.contentLayout,
        custom_accent_enabled: DEFAULT_THEME_CUSTOMIZATION.customAccentEnabled,
        custom_accent_color: DEFAULT_THEME_CUSTOMIZATION.customAccentColor,
        custom_palette_enabled:
          DEFAULT_THEME_CUSTOMIZATION.customPaletteEnabled,
        custom_background_color:
          DEFAULT_THEME_CUSTOMIZATION.customBackgroundColor,
        custom_surface_color: DEFAULT_THEME_CUSTOMIZATION.customSurfaceColor,
        custom_sidebar_color: DEFAULT_THEME_CUSTOMIZATION.customSidebarColor,
        custom_chart_color: DEFAULT_THEME_CUSTOMIZATION.customChartColor,
      },
    })
  }

  const customAccentEnabled = form.watch('theme.custom_accent_enabled')
  const customAccentColor = form.watch('theme.custom_accent_color')
  const customPaletteEnabled = form.watch('theme.custom_palette_enabled')
  const customBackgroundColor = form.watch('theme.custom_background_color')
  const customSurfaceColor = form.watch('theme.custom_surface_color')
  const customSidebarColor = form.watch('theme.custom_sidebar_color')
  const customChartColor = form.watch('theme.custom_chart_color')

  return (
    <SettingsSection title={t('Appearance')}>
      <FormNavigationGuard when={isDirty} />
      <Form {...form}>
        <SettingsForm onSubmit={handleSubmit}>
          <SettingsPageFormActions
            onSave={handleSubmit}
            onReset={handleReset}
            isSaving={updateOption.isPending || isSubmitting}
            isResetDisabled={!isDirty}
            resetLabel='Reset to saved'
            saveLabel='Save appearance'
          />
          <FormDirtyIndicator isDirty={isDirty} />
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
          <SettingsFormGrid>
            <SelectField
              control={form.control}
              name='theme.customization_preset'
              label={t('Default theme preset')}
              description={t(
                'Default visual preset used when a user has not selected a personal preset.'
              )}
              options={THEME_PRESETS.map((preset) => ({
                value: preset.value,
                label: preset.name,
                swatches: preset.swatches,
              }))}
            />

            <SelectField
              control={form.control}
              name='theme.customization_font'
              label={t('Default font')}
              description={t(
                'Default typography used before a user chooses a personal font.'
              )}
              options={THEME_FONTS.map((font) => ({
                value: font.value,
                label: font.label,
                description: font.description,
              }))}
            />

            <SelectField
              control={form.control}
              name='theme.customization_radius'
              label={t('Default radius')}
              description={t('Default corner radius for the default frontend.')}
              options={THEME_RADII.map((radius) => ({
                value: radius.value,
                label: radius.label,
              }))}
            />

            <SelectField
              control={form.control}
              name='theme.customization_scale'
              label={t('Default density')}
              description={t('Default UI density for the default frontend.')}
              options={THEME_SCALES.map((scale) => ({
                value: scale.value,
                label: scale.label,
              }))}
            />

            <SelectField
              control={form.control}
              name='theme.content_layout'
              label={t('Default content layout')}
              description={t(
                'Default page width behavior before a user chooses a personal layout.'
              )}
              options={contentLayoutOptions}
            />

            <FormField
              control={form.control}
              name='theme.custom_accent_enabled'
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
                    <div className='space-y-1'>
                      <FormLabel>{t('Custom accent color')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Override the primary accent color for the default frontend.'
                        )}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='theme.custom_accent_color'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Accent hex color')}</FormLabel>
                  <div className='flex gap-2'>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!customAccentEnabled}
                        placeholder='#2563eb'
                        className='font-mono'
                      />
                    </FormControl>
                    <Input
                      type='color'
                      value={
                        /^#[0-9a-fA-F]{6}$/.test(customAccentColor)
                          ? customAccentColor
                          : DEFAULT_THEME_CUSTOMIZATION.customAccentColor
                      }
                      disabled={!customAccentEnabled}
                      onChange={(event) => field.onChange(event.target.value)}
                      className='w-12 shrink-0 cursor-pointer p-1'
                      aria-label={t('Accent color picker')}
                    />
                  </div>
                  <FormDescription>
                    {t(
                      'Use #RRGGBB. This affects buttons, rings, charts, and sidebar highlights.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='theme.custom_palette_enabled'
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
                    <div className='space-y-1'>
                      <FormLabel>{t('Custom interface palette')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Override global background, surface, sidebar, and secondary chart colors.'
                        )}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <ColorField
              control={form.control}
              name='theme.custom_background_color'
              label={t('Background color')}
              description={t('Global page background color.')}
              disabled={!customPaletteEnabled}
              previewValue={customBackgroundColor}
              fallback={DEFAULT_THEME_CUSTOMIZATION.customBackgroundColor}
            />

            <ColorField
              control={form.control}
              name='theme.custom_surface_color'
              label={t('Surface color')}
              description={t(
                'Cards, popovers, muted surfaces, borders, and inputs.'
              )}
              disabled={!customPaletteEnabled}
              previewValue={customSurfaceColor}
              fallback={DEFAULT_THEME_CUSTOMIZATION.customSurfaceColor}
            />

            <ColorField
              control={form.control}
              name='theme.custom_sidebar_color'
              label={t('Sidebar color')}
              description={t(
                'Sidebar canvas, sidebar hover surface, and sidebar border.'
              )}
              disabled={!customPaletteEnabled}
              previewValue={customSidebarColor}
              fallback={DEFAULT_THEME_CUSTOMIZATION.customSidebarColor}
            />

            <ColorField
              control={form.control}
              name='theme.custom_chart_color'
              label={t('Secondary chart color')}
              description={t(
                'Additional chart series color used by analytics panels.'
              )}
              disabled={!customPaletteEnabled}
              previewValue={customChartColor}
              fallback={DEFAULT_THEME_CUSTOMIZATION.customChartColor}
            />
          </SettingsFormGrid>

          <div className='flex justify-end'>
            <button
              type='button'
              className='text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline'
              onClick={resetToFactoryDefaults}
            >
              {t('Reset form to factory defaults')}
            </button>
          </div>
        </SettingsForm>
      </Form>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Import appearance')}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={t('Paste appearance JSON')}
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

function ColorField(props: {
  control: Control<AppearanceFormValues>
  name: AppearanceColorFieldName
  label: string
  description: string
  disabled: boolean
  previewValue: string
  fallback: string
}) {
  return (
    <FormField
      control={props.control}
      name={props.name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{props.label}</FormLabel>
          <div className='flex gap-2'>
            <FormControl>
              <Input
                {...field}
                disabled={props.disabled}
                placeholder={props.fallback}
                className='font-mono'
              />
            </FormControl>
            <Input
              type='color'
              value={
                /^#[0-9a-fA-F]{6}$/.test(props.previewValue)
                  ? props.previewValue
                  : props.fallback
              }
              disabled={props.disabled}
              onChange={(event) => field.onChange(event.target.value)}
              className='w-12 shrink-0 cursor-pointer p-1'
              aria-label={props.label}
            />
          </div>
          <FormDescription>{props.description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function SelectField(props: {
  control: Control<AppearanceFormValues>
  name: AppearanceSelectFieldName
  label: string
  description: string
  options: Array<{
    value: string
    label: string
    description?: string
    swatches?: readonly string[]
  }>
}) {
  return (
    <FormField
      control={props.control}
      name={props.name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{props.label}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {props.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className='flex min-w-0 items-center gap-2'>
                      {option.swatches ? (
                        <span className='flex shrink-0 -space-x-1'>
                          {option.swatches.map((swatch, index) => (
                            <span
                              key={`${option.value}-${index}`}
                              className='ring-background size-3 rounded-full ring-1'
                              style={{ background: swatch }}
                            />
                          ))}
                        </span>
                      ) : null}
                      <span className='truncate'>{option.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FormDescription>{props.description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
