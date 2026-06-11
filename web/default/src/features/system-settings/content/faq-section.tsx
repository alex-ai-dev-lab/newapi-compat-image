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
import { Plus, Edit, Trash2, Save, Download, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSwitchField } from '../components/settings-form-layout'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type FAQ = {
  id: number
  question: string
  answer: string
}

type FAQSectionProps = {
  enabled: boolean
  data: string
}

const faqSchema = z.object({
  question: z
    .string()
    .min(1, 'Question is required')
    .max(200, 'Question must be less than 200 characters'),
  answer: z
    .string()
    .min(1, 'Answer is required')
    .max(1000, 'Answer must be less than 1000 characters'),
})

type FAQFormValues = z.infer<typeof faqSchema>

type FAQImportExportPayload = {
  FAQ?: {
    enabled?: boolean
    items?: unknown
  }
  enabled?: boolean
  items?: unknown
  faq?: unknown
  'console_setting.faq_enabled'?: boolean
  'console_setting.faq'?: unknown
}

export function FAQSection({ enabled, data }: FAQSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [faqList, setFaqList] = useState<FAQ[]>([])
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [hasChanges, setHasChanges] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'batch'>('single')

  const form = useForm<FAQFormValues>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      question: '',
      answer: '',
    },
  })

  useEffect(() => {
    try {
      const parsed = JSON.parse(data || '[]')
      if (Array.isArray(parsed)) {
        setFaqList(
          parsed.map((item, idx) => ({
            ...item,
            id: item.id || idx + 1,
          }))
        )
      }
    } catch {
      setFaqList([])
    }
  }, [data])

  useEffect(() => {
    setIsEnabled(enabled)
  }, [enabled])

  const normalizeFAQList = (value: unknown): FAQ[] => {
    const raw = typeof value === 'string' ? JSON.parse(value || '[]') : value
    if (!Array.isArray(raw)) {
      throw new Error('FAQ items must be an array')
    }

    return raw.map((item, idx) => {
      const parsed = faqSchema.parse(item)
      return {
        id:
          typeof item === 'object' &&
          item !== null &&
          typeof (item as { id?: unknown }).id === 'number'
            ? (item as { id: number }).id
            : idx + 1,
        ...parsed,
      }
    })
  }

  const handleToggleEnabled = async (checked: boolean) => {
    try {
      await updateOption.mutateAsync({
        key: 'console_setting.faq_enabled',
        value: checked,
      })
      setIsEnabled(checked)
      toast.success(t('Setting saved'))
    } catch {
      toast.error(t('Failed to update setting'))
    }
  }

  const handleAdd = () => {
    setEditingFaq(null)
    form.reset({
      question: '',
      answer: '',
    })
    setShowDialog(true)
  }

  const handleEdit = (faq: FAQ) => {
    setEditingFaq(faq)
    form.reset({
      question: faq.question,
      answer: faq.answer,
    })
    setShowDialog(true)
  }

  const handleDelete = (faq: FAQ) => {
    setEditingFaq(faq)
    setDeleteTarget('single')
    setShowDeleteDialog(true)
  }

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) {
      toast.error(t('Please select items to delete'))
      return
    }
    setDeleteTarget('batch')
    setShowDeleteDialog(true)
  }

  const confirmDelete = () => {
    if (deleteTarget === 'single' && editingFaq) {
      setFaqList((prev) => prev.filter((item) => item.id !== editingFaq.id))
      setHasChanges(true)
      toast.success(t('FAQ deleted. Click "Save Settings" to apply.'))
    } else if (deleteTarget === 'batch') {
      setFaqList((prev) =>
        prev.filter((item) => !selectedIds.includes(item.id))
      )
      setSelectedIds([])
      setHasChanges(true)
      toast.success(
        t('{{count}} FAQs deleted. Click "Save Settings" to apply.', {
          count: selectedIds.length,
        })
      )
    }
    setShowDeleteDialog(false)
    setEditingFaq(null)
  }

  const handleSubmitForm = (values: FAQFormValues) => {
    if (editingFaq) {
      setFaqList((prev) =>
        prev.map((item) =>
          item.id === editingFaq.id ? { ...item, ...values } : item
        )
      )
      toast.success(t('FAQ updated. Click "Save Settings" to apply.'))
    } else {
      const newId = Math.max(...faqList.map((item) => item.id), 0) + 1
      setFaqList((prev) => [...prev, { id: newId, ...values }])
      toast.success(t('FAQ added. Click "Save Settings" to apply.'))
    }
    setHasChanges(true)
    setShowDialog(false)
  }

  const handleSaveAll = async () => {
    try {
      await updateOption.mutateAsync({
        key: 'console_setting.faq',
        value: JSON.stringify(faqList),
      })
      if (isEnabled !== enabled) {
        await updateOption.mutateAsync({
          key: 'console_setting.faq_enabled',
          value: isEnabled,
        })
      }
      setHasChanges(false)
      toast.success(t('FAQ saved successfully'))
    } catch {
      toast.error(t('Failed to save FAQ'))
    }
  }

  const exportConfig = async () => {
    const payload = {
      FAQ: {
        enabled: isEnabled,
        items: faqList,
      },
      'console_setting.faq_enabled': isEnabled,
      'console_setting.faq': faqList,
    }
    const text = JSON.stringify(payload, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'newapi-faq.json'
    link.click()
    URL.revokeObjectURL(url)

    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('FAQ JSON exported and copied'))
    } catch {
      toast.success(t('FAQ JSON exported'))
    }
  }

  const openImportDialog = () => {
    setImportText(
      JSON.stringify(
        {
          FAQ: {
            enabled: isEnabled,
            items: faqList,
          },
        },
        null,
        2
      )
    )
    setImportOpen(true)
  }

  const importConfig = () => {
    try {
      const raw = JSON.parse(importText) as FAQImportExportPayload
      const source = raw.FAQ ?? raw
      const importedItems =
        source.items ?? raw.faq ?? raw['console_setting.faq']
      const importedEnabled =
        typeof source.enabled === 'boolean'
          ? source.enabled
          : raw['console_setting.faq_enabled']

      if (importedItems === undefined) {
        throw new Error('Missing FAQ items')
      }

      const nextFAQList = normalizeFAQList(importedItems)
      setFaqList(nextFAQList)
      setSelectedIds([])
      if (typeof importedEnabled === 'boolean') {
        setIsEnabled(importedEnabled)
      }
      setHasChanges(true)
      setImportOpen(false)
      toast.success(t('FAQ imported. Click Save Settings to apply.'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Invalid FAQ JSON')
      )
    }
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? faqList.map((item) => item.id) : [])
  }

  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    )
  }

  return (
    <SettingsSection title={t('FAQ')}>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <Button onClick={handleAdd} size='sm'>
              <Plus className='mr-2 h-4 w-4' />
              {t('Add FAQ')}
            </Button>
            <Button
              onClick={handleBatchDelete}
              size='sm'
              variant='destructive'
              disabled={selectedIds.length === 0}
            >
              <Trash2 className='mr-2 h-4 w-4' />
              {t('Delete (')}
              {selectedIds.length})
            </Button>
            <Button
              onClick={handleSaveAll}
              size='sm'
              variant='secondary'
              disabled={!hasChanges || updateOption.isPending}
            >
              <Save className='mr-2 h-4 w-4' />
              {updateOption.isPending ? t('Saving...') : t('Save Settings')}
            </Button>
            <Button onClick={exportConfig} size='sm' variant='outline'>
              <Download className='mr-2 h-4 w-4' />
              {t('Export JSON')}
            </Button>
            <Button onClick={openImportDialog} size='sm' variant='outline'>
              <Upload className='mr-2 h-4 w-4' />
              {t('Import JSON')}
            </Button>
          </div>
          <SettingsSwitchField
            checked={isEnabled}
            onCheckedChange={handleToggleEnabled}
            label={t('Enabled')}
            className='border-b-0 py-0'
          />
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-12'>
                  <Checkbox
                    checked={
                      selectedIds.length === faqList.length &&
                      faqList.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>{t('Question')}</TableHead>
                <TableHead>{t('Answer')}</TableHead>
                <TableHead className='w-32'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faqList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className='h-24 text-center'>
                    {t('No FAQ entries yet. Click "Add FAQ" to create one.')}
                  </TableCell>
                </TableRow>
              ) : (
                faqList.map((faq) => (
                  <TableRow key={faq.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(faq.id)}
                        onCheckedChange={(checked) =>
                          toggleSelectOne(faq.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell
                      className='max-w-xs truncate font-medium'
                      title={faq.question}
                    >
                      {faq.question}
                    </TableCell>
                    <TableCell
                      className='text-muted-foreground max-w-md truncate'
                      title={faq.answer}
                    >
                      {faq.answer}
                    </TableCell>
                    <TableCell>
                      <div className='flex gap-2'>
                        <Button
                          onClick={() => handleEdit(faq)}
                          size='sm'
                          variant='ghost'
                        >
                          <Edit className='h-4 w-4' />
                        </Button>
                        <Button
                          onClick={() => handleDelete(faq)}
                          size='sm'
                          variant='ghost'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              {editingFaq ? t('Edit FAQ') : t('Add FAQ')}
            </DialogTitle>
            <DialogDescription>
              {t('Create or update frequently asked questions for users')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmitForm)}
              className='space-y-4'
            >
              <FormField
                control={form.control}
                name='question'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Question')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('How to reset my quota?')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Maximum 200 characters')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='answer'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Answer')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          'Visit Settings → General and adjust quota options...'
                        )}
                        rows={8}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Maximum 1000 characters. Supports Markdown and HTML.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setShowDialog(false)}
                >
                  {t('Cancel')}
                </Button>
                <Button type='submit'>
                  {editingFaq ? t('Update') : t('Add')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{t('Import FAQ JSON')}</DialogTitle>
            <DialogDescription>
              {t(
                'Paste an exported FAQ JSON payload. Imported values stay local until you save settings.'
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Are you sure?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget === 'single'
                ? 'This FAQ entry will be removed from the list.'
                : `${selectedIds.length} FAQ entries will be removed from the list.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  )
}
