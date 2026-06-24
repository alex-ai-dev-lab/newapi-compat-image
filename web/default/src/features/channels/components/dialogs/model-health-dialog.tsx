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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Power, PowerOff, RefreshCw, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/status-badge'
import {
  getChannelModelStatuses,
  manageChannelModelStatus,
} from '../../api'
import { formatTimestamp } from '../../lib'
import type { ChannelModelStatus } from '../../types'
import { useChannels } from '../channels-provider'

type ModelHealthDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function statusConfig(status: number) {
  switch (status) {
    case 1:
      return { label: 'Enabled', variant: 'success' as const }
    case 2:
      return { label: 'Manual Disabled', variant: 'warning' as const }
    case 3:
      return { label: 'Auto Disabled', variant: 'danger' as const }
    default:
      return { label: 'Unknown', variant: 'neutral' as const }
  }
}

export function ModelHealthDialog({
  open,
  onOpenChange,
}: ModelHealthDialogProps) {
  const { t } = useTranslation()
  const { currentRow } = useChannels()
  const [rows, setRows] = useState<ChannelModelStatus[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const loadStatuses = useCallback(async () => {
    if (!currentRow) return
    setIsLoading(true)
    try {
      const response = await getChannelModelStatuses(currentRow.id)
      if (response.success) {
        setRows(response.data ?? [])
      } else {
        toast.error(response.message || t('Failed to load model health'))
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to load model health')
      )
    } finally {
      setIsLoading(false)
    }
  }, [currentRow, t])

  useEffect(() => {
    if (open && currentRow) {
      setSearch('')
      loadStatuses()
    }
  }, [currentRow, loadStatuses, open])

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter(
      (row) =>
        row.model_name.toLowerCase().includes(keyword) ||
        row.group.toLowerCase().includes(keyword)
    )
  }, [rows, search])

  const runAction = async (
    row: ChannelModelStatus,
    action: 'enable' | 'disable' | 'delete'
  ) => {
    if (!currentRow) return
    const key = `${row.group}:${row.model_name}:${action}`
    setBusyKey(key)
    try {
      const response = await manageChannelModelStatus(currentRow.id, {
        group: row.group,
        model: row.model_name,
        action,
      })
      if (response.success) {
        toast.success(response.message || t('Operation successful'))
        await loadStatuses()
      } else {
        toast.error(response.message || t('Operation failed'))
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t('Operation failed')
      )
    } finally {
      setBusyKey(null)
    }
  }

  if (!currentRow) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] max-w-6xl flex-col'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {t('Model Health')}
            <StatusBadge
              label={currentRow.name}
              variant='neutral'
              copyable={false}
            />
          </DialogTitle>
          <DialogDescription>
            {t('Manage per-model availability for this channel.')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-hidden'>
          <div className='flex items-center justify-between gap-2'>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Filter models or groups...')}
              className='max-w-sm'
            />
            <Button
              variant='outline'
              size='sm'
              onClick={loadStatuses}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <RefreshCw className='size-4' />
              )}
            </Button>
          </div>

          <div className='min-h-0 flex-1 overflow-auto rounded-md border'>
            {isLoading ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='text-muted-foreground size-8 animate-spin' />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className='text-muted-foreground py-12 text-center text-sm'>
                {t('No model health records found')}
              </div>
            ) : (
              <Table className='min-w-[1050px]'>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-48'>{t('Group')}</TableHead>
                    <TableHead className='min-w-[280px]'>{t('Model')}</TableHead>
                    <TableHead className='w-40'>{t('Status')}</TableHead>
                    <TableHead className='w-24'>{t('Failures')}</TableHead>
                    <TableHead className='w-32'>{t('Status Code')}</TableHead>
                    <TableHead className='min-w-[280px]'>{t('Last Error')}</TableHead>
                    <TableHead className='w-44'>{t('Updated')}</TableHead>
                    <TableHead className='sticky right-0 w-44 bg-popover text-right'>
                      {t('Actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => {
                    const config = statusConfig(row.status)
                    const rowKey = `${row.group}:${row.model_name}`
                    const disabled = row.status !== 1
                    return (
                      <TableRow key={rowKey}>
                        <TableCell>
                          <StatusBadge
                            label={row.group}
                            variant='neutral'
                            copyable={false}
                          />
                        </TableCell>
                        <TableCell className='font-mono text-xs break-all'>
                          {row.model_name}
                          {row.configured === false && (
                            <StatusBadge
                              label={t('Removed')}
                              variant='warning'
                              size='sm'
                              copyable={false}
                              className='ml-2'
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            label={t(config.label)}
                            variant={config.variant}
                            copyable={false}
                          />
                        </TableCell>
                        <TableCell>{row.failure_count ?? 0}</TableCell>
                        <TableCell>
                          {row.last_status_code ? row.last_status_code : '-'}
                        </TableCell>
                        <TableCell className='max-w-md truncate text-xs'>
                          {row.last_error || '-'}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-xs'>
                          {row.updated_time ? formatTimestamp(row.updated_time) : '-'}
                        </TableCell>
                        <TableCell className='sticky right-0 bg-popover'>
                          <div className='flex justify-end gap-1'>
                            {disabled ? (
                              <Button
                                variant='ghost'
                                size='icon-sm'
                                onClick={() => runAction(row, 'enable')}
                                disabled={busyKey === `${rowKey}:enable`}
                                aria-label={t('Enable')}
                              >
                                {busyKey === `${rowKey}:enable` ? (
                                  <Loader2 className='size-4 animate-spin' />
                                ) : (
                                  <Power className='size-4' />
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant='ghost'
                                size='icon-sm'
                                onClick={() => runAction(row, 'disable')}
                                disabled={busyKey === `${rowKey}:disable`}
                                aria-label={t('Disable')}
                                className='text-destructive hover:text-destructive'
                              >
                                {busyKey === `${rowKey}:disable` ? (
                                  <Loader2 className='size-4 animate-spin' />
                                ) : (
                                  <PowerOff className='size-4' />
                                )}
                              </Button>
                            )}
                            <Button
                              variant='ghost'
                              size='icon-sm'
                              onClick={() => runAction(row, 'delete')}
                              disabled={busyKey === `${rowKey}:delete`}
                              aria-label={t('Clear')}
                            >
                              {busyKey === `${rowKey}:delete` ? (
                                <Loader2 className='size-4 animate-spin' />
                              ) : (
                                <RotateCcw className='size-4' />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
