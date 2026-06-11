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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { SettingsForm } from '../components/settings-form-layout'
import {
  SettingsPageActionsPortal,
  SettingsPageFormActions,
} from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { ChatSettingsVisualEditor } from './chat-settings-visual-editor'
import { formatJsonForEditor, normalizeJsonString } from './utils'

const createChatSchema = (t: (key: string) => string) =>
  z.object({
    Chats: z.string().superRefine((value, ctx) => {
      try {
        const parsed = JSON.parse(value || '[]')
        if (!Array.isArray(parsed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('Expected a JSON array.'),
          })
          return
        }
        for (const item of parsed) {
          if (
            item === null ||
            typeof item !== 'object' ||
            Array.isArray(item)
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t(
                'Each item must be an object with a single key-value pair.'
              ),
            })
            return
          }
          const entries = Object.entries(item)
          if (entries.length !== 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t('Each item must have exactly one key-value pair.'),
            })
            return
          }
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('Invalid JSON string.'),
        })
      }
    }),
  })

type ChatSettingsFormValues = z.infer<ReturnType<typeof createChatSchema>>

type ChatSettingsSectionProps = {
  defaultValue: string
}

type ChatImportExportPayload = {
  ChatPresets?: {
    chats?: unknown
  }
  chats?: unknown
  Chats?: unknown
}

export function ChatSettingsSection({
  defaultValue,
}: ChatSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual')
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const chatSchema = createChatSchema(t)
  const formatted = formatJsonForEditor(defaultValue, '[]')
  const form = useForm<ChatSettingsFormValues>({
    resolver: zodResolver(chatSchema),
    mode: 'onChange', // Enable real-time validation
    defaultValues: {
      Chats: formatted,
    },
  })

  const initialNormalizedRef = useRef(normalizeJsonString(defaultValue, '[]'))

  useEffect(() => {
    form.reset({ Chats: formatJsonForEditor(defaultValue, '[]') })
    initialNormalizedRef.current = normalizeJsonString(defaultValue, '[]')
  }, [defaultValue, form])

  const onSubmit = async (values: ChatSettingsFormValues) => {
    const normalized = normalizeJsonString(values.Chats, '[]')
    if (normalized === initialNormalizedRef.current) {
      return
    }

    await updateOption.mutateAsync({
      key: 'Chats',
      value: normalized,
    })
  }

  const exportConfig = async () => {
    const normalized = normalizeJsonString(form.getValues().Chats, '[]')
    const chats = JSON.parse(normalized)
    const payload = {
      ChatPresets: {
        chats,
      },
      Chats: chats,
    }
    const text = JSON.stringify(payload, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'newapi-chat-presets.json'
    link.click()
    URL.revokeObjectURL(url)

    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('Chat presets JSON exported and copied'))
    } catch {
      toast.success(t('Chat presets JSON exported'))
    }
  }

  const openImportDialog = () => {
    const normalized = normalizeJsonString(form.getValues().Chats, '[]')
    setImportText(
      JSON.stringify(
        {
          ChatPresets: {
            chats: JSON.parse(normalized),
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
      const raw = JSON.parse(importText) as ChatImportExportPayload
      const source = raw.ChatPresets ?? raw
      const importedChats = source.chats ?? raw.Chats
      if (importedChats === undefined) {
        throw new Error('Missing chat presets')
      }

      const normalized = normalizeJsonString(
        typeof importedChats === 'string'
          ? importedChats
          : JSON.stringify(importedChats),
        '[]'
      )
      const parsed = chatSchema.parse({ Chats: normalized })
      form.setValue('Chats', formatJsonForEditor(parsed.Chats, '[]'), {
        shouldDirty: true,
        shouldValidate: true,
      })
      await form.trigger('Chats')
      setEditMode('json')
      setImportOpen(false)
      toast.success(t('Chat presets imported. Click Save to apply.'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Invalid chat presets JSON')
      )
    }
  }

  return (
    <SettingsSection title={t('Chat Presets')}>
      <Form {...form}>
        {/* eslint-disable-next-line react-hooks/refs */}
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
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
            saveLabel='Save chat settings'
          />
          <Tabs
            value={editMode}
            onValueChange={(value) => setEditMode(value as 'visual' | 'json')}
          >
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='visual'>{t('Visual')}</TabsTrigger>
              <TabsTrigger value='json'>{t('JSON')}</TabsTrigger>
            </TabsList>

            <TabsContent value='visual' className='mt-6'>
              <FormField
                control={form.control}
                name='Chats'
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ChatSettingsVisualEditor
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value='json' className='mt-6'>
              <FormField
                control={form.control}
                name='Chats'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Chat configuration JSON')}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={12}
                        placeholder={t(
                          '[{"ChatGPT":"https://chat.openai.com"},{"Lobe Chat":"https://chat-preview.lobehub.com/?settings={...}"}]'
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Array of chat client presets. Each item is an object with one key-value pair: client name and its URL.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>
          </Tabs>
        </SettingsForm>
      </Form>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{t('Import chat presets JSON')}</DialogTitle>
            <DialogDescription>
              {t(
                'Paste an exported chat presets JSON payload. Imported values stay local until you save settings.'
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
