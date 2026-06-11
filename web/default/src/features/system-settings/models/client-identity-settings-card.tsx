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
import { useFieldArray, useForm } from 'react-hook-form'
import {
  Clock,
  Download,
  Info,
  Plus,
  RefreshCw,
  Shuffle,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  useClientIdentitySetting,
  useUpdateClientIdentitySetting,
  useGenerateCodexId,
  useRotateCodexId,
  useGenerateClaudeId,
  useRotateClaudeId,
  type ClientIdentitySetting,
} from './client-identity-api'

const DEFAULT_SETTING: ClientIdentitySetting = {
  enabled: true,
  apply_to_all_openai_responses: false,
  apply_to_all_claude_messages: false,
  codex: {
    enabled: true,
    mode: 'force_global',
    installation_id: '',
    rotate_enabled: false,
    rotate_interval_unit: 'month',
    rotate_interval_value: 1,
    next_rotate_at: 0,
  },
  claude: {
    enabled: true,
    mode: 'force_global',
    device_id: '',
    session_id_mode: 'force_global',
    fixed_session_id: '',
    sync_session_header: true,
    rotate_enabled: false,
    rotate_interval_unit: 'month',
    rotate_interval_value: 1,
    next_rotate_at: 0,
  },
  generic: [],
}

type ClientIdentityImportExportPayload = Partial<ClientIdentitySetting> & {
  ClientIdentity?: Partial<ClientIdentitySetting>
}

const toObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {}

const toBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean'
    ? value
    : value === 'true'
      ? true
      : value === 'false'
        ? false
        : fallback

const toStringValue = (value: unknown, fallback: string) =>
  typeof value === 'string' ? value : fallback

const toMode = (
  value: unknown,
  fallback: 'force_global' | 'disabled'
): 'force_global' | 'disabled' =>
  value === 'force_global' || value === 'disabled' ? value : fallback

const toPathType = (
  value: unknown,
  fallback: 'body_json' | 'header'
): 'body_json' | 'header' =>
  value === 'body_json' || value === 'header' ? value : fallback

const toIntervalUnit = (
  value: unknown,
  fallback: 'week' | 'month' | 'year'
): 'week' | 'month' | 'year' =>
  value === 'week' || value === 'month' || value === 'year' ? value : fallback

const toPositiveNumber = (value: unknown, fallback: number) => {
  const next = Number(value)
  return Number.isFinite(next) && next > 0 ? Math.floor(next) : fallback
}

const toTimestamp = (value: unknown, fallback: number) => {
  const next = Number(value)
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback
}

function normalizeClientIdentityImport(
  raw: ClientIdentityImportExportPayload,
  current: ClientIdentitySetting
): ClientIdentitySetting {
  const payload = toObject(raw.ClientIdentity ?? raw)
  if (Object.keys(payload).length === 0) {
    throw new Error('empty payload')
  }

  const codex = toObject(payload.codex)
  const claude = toObject(payload.claude)
  const generic = Array.isArray(payload.generic)
    ? payload.generic
    : current.generic

  return {
    enabled: toBoolean(payload.enabled, current.enabled),
    apply_to_all_openai_responses: toBoolean(
      payload.apply_to_all_openai_responses,
      current.apply_to_all_openai_responses
    ),
    apply_to_all_claude_messages: toBoolean(
      payload.apply_to_all_claude_messages,
      current.apply_to_all_claude_messages
    ),
    codex: {
      enabled: toBoolean(codex.enabled, current.codex.enabled),
      mode: toMode(codex.mode, current.codex.mode),
      installation_id: toStringValue(
        codex.installation_id,
        current.codex.installation_id
      ),
      rotate_enabled: toBoolean(
        codex.rotate_enabled,
        current.codex.rotate_enabled
      ),
      rotate_interval_unit: toIntervalUnit(
        codex.rotate_interval_unit,
        current.codex.rotate_interval_unit
      ),
      rotate_interval_value: toPositiveNumber(
        codex.rotate_interval_value,
        current.codex.rotate_interval_value
      ),
      next_rotate_at: toTimestamp(
        codex.next_rotate_at,
        current.codex.next_rotate_at
      ),
    },
    claude: {
      enabled: toBoolean(claude.enabled, current.claude.enabled),
      mode: toMode(claude.mode, current.claude.mode),
      device_id: toStringValue(claude.device_id, current.claude.device_id),
      session_id_mode: toMode(
        claude.session_id_mode,
        current.claude.session_id_mode
      ),
      fixed_session_id: toStringValue(
        claude.fixed_session_id,
        current.claude.fixed_session_id
      ),
      sync_session_header: toBoolean(
        claude.sync_session_header,
        current.claude.sync_session_header
      ),
      rotate_enabled: toBoolean(
        claude.rotate_enabled,
        current.claude.rotate_enabled
      ),
      rotate_interval_unit: toIntervalUnit(
        claude.rotate_interval_unit,
        current.claude.rotate_interval_unit
      ),
      rotate_interval_value: toPositiveNumber(
        claude.rotate_interval_value,
        current.claude.rotate_interval_value
      ),
      next_rotate_at: toTimestamp(
        claude.next_rotate_at,
        current.claude.next_rotate_at
      ),
    },
    generic: generic.map((item, index) => {
      const value = toObject(item)
      const fallback = current.generic[index] ?? {
        name: 'Custom Provider',
        enabled: true,
        mode: 'force_global' as const,
        path_type: 'body_json' as const,
        field_path: 'metadata.device_id',
        field_value: '',
        rotate_enabled: false,
        rotate_interval_unit: 'month' as const,
        rotate_interval_value: 1,
        next_rotate_at: 0,
      }

      return {
        name: toStringValue(value.name, fallback.name),
        enabled: toBoolean(value.enabled, fallback.enabled),
        mode: toMode(value.mode, fallback.mode),
        path_type: toPathType(value.path_type, fallback.path_type),
        field_path: toStringValue(value.field_path, fallback.field_path),
        field_value: toStringValue(value.field_value, fallback.field_value),
        rotate_enabled: toBoolean(
          value.rotate_enabled,
          fallback.rotate_enabled
        ),
        rotate_interval_unit: toIntervalUnit(
          value.rotate_interval_unit,
          fallback.rotate_interval_unit
        ),
        rotate_interval_value: toPositiveNumber(
          value.rotate_interval_value,
          fallback.rotate_interval_value
        ),
        next_rotate_at: toTimestamp(
          value.next_rotate_at,
          fallback.next_rotate_at
        ),
      }
    }),
  }
}

export function ClientIdentitySettingsCard() {
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const { data: setting, isLoading } = useClientIdentitySetting()
  const updateMutation = useUpdateClientIdentitySetting()
  const generateCodexMutation = useGenerateCodexId()
  const rotateCodexMutation = useRotateCodexId()
  const generateClaudeMutation = useGenerateClaudeId()
  const rotateClaudeMutation = useRotateClaudeId()

  const form = useForm<ClientIdentitySetting>({
    defaultValues: DEFAULT_SETTING,
    values: setting ?? DEFAULT_SETTING,
  })
  const {
    fields: genericFields,
    append: appendGeneric,
    remove: removeGeneric,
  } = useFieldArray({
    control: form.control,
    name: 'generic',
  })

  const exportConfig = async () => {
    const text = JSON.stringify({ ClientIdentity: form.getValues() }, null, 2)

    try {
      await navigator.clipboard?.writeText(text)
    } catch {
      /* Clipboard can be unavailable on non-secure origins. */
    }

    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'newapi-client-identity.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success('客户端标识配置已导出')
  }

  const openImportDialog = () => {
    setImportText('')
    setImportOpen(true)
  }

  const importConfig = () => {
    try {
      const raw = JSON.parse(importText) as ClientIdentityImportExportPayload
      const normalized = normalizeClientIdentityImport(raw, form.getValues())
      form.reset(normalized)
      setImportOpen(false)
      toast.success(
        '客户端标识配置已导入，点击“保存设置”后生效。'
      )
    } catch {
      toast.error('客户端标识 JSON 无效')
    }
  }

  const onSubmit = async (data: ClientIdentitySetting) => {
    try {
      await updateMutation.mutateAsync(data)
      toast.success('客户端标识设置已保存')
    } catch (error: any) {
      toast.error(error.message || '保存设置失败')
    }
  }

  const handleGenerateCodex = async () => {
    try {
      const newId = await generateCodexMutation.mutateAsync()
      form.setValue('codex.installation_id', newId)
      toast.success('已生成新的 Codex 安装 ID')
    } catch (error: any) {
      toast.error(error.message || '生成 ID 失败')
    }
  }

  const handleRotateCodex = async () => {
    try {
      await rotateCodexMutation.mutateAsync()
      toast.success('Codex 安装 ID 已轮换')
    } catch (error: any) {
      toast.error(error.message || '轮换 ID 失败')
    }
  }

  const handleGenerateClaude = async () => {
    try {
      const newId = await generateClaudeMutation.mutateAsync()
      form.setValue('claude.device_id', newId)
      toast.success('已生成新的 Claude 设备 ID')
    } catch (error: any) {
      toast.error(error.message || '生成 ID 失败')
    }
  }

  const handleRotateClaude = async () => {
    try {
      await rotateClaudeMutation.mutateAsync()
      toast.success('Claude 设备 ID 已轮换')
    } catch (error: any) {
      toast.error(error.message || '轮换 ID 失败')
    }
  }

  const handleAddGeneric = () => {
    appendGeneric({
      name: 'Custom Provider',
      enabled: true,
      mode: 'force_global',
      path_type: 'body_json',
      field_path: 'metadata.device_id',
      field_value: crypto.randomUUID(),
      rotate_enabled: false,
      rotate_interval_unit: 'month',
      rotate_interval_value: 1,
      next_rotate_at: 0,
    })
  }

  const handleGenerateGeneric = (index: number) => {
    form.setValue(`generic.${index}.field_value`, crypto.randomUUID(), {
      shouldDirty: true,
      shouldTouch: true,
    })
  }

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return '未计划'
    return new Date(timestamp * 1000).toLocaleString()
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-8'>加载中...</div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <div className='flex flex-wrap justify-end gap-2'>
          <Button type='button' variant='outline' onClick={exportConfig}>
            <Download className='mr-2 h-4 w-4' />
            导出 JSON
          </Button>
          <Button type='button' variant='outline' onClick={openImportDialog}>
            <Upload className='mr-2 h-4 w-4' />
            导入 JSON
          </Button>
        </div>

        <Alert>
          <Info className='h-4 w-4' />
          <AlertDescription>
            客户端标识管理用于在转发给上游服务商前注入或替换设备/安装标识，
            让 Codex、Claude 等要求固定标识的渠道保持稳定，避免因缺少标识触发
            403 等鉴权限制。
          </AlertDescription>
        </Alert>

        {/* Global Settings */}
        <Card>
          <CardHeader>
            <CardTitle>全局设置</CardTitle>
            <CardDescription>
              控制客户端标识注入的总开关
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <FormLabel>启用客户端标识管理</FormLabel>
                    <FormDescription>
                      启用后，NewAPI 会在匹配的请求中写入配置好的标识符。
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='apply_to_all_openai_responses'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <FormLabel>
                      应用于所有 OpenAI Responses 请求
                    </FormLabel>
                    <FormDescription>
                      对每个 /v1/responses 请求强制写入 Codex 安装 ID，
                      即使 User-Agent 不是 Codex。
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='apply_to_all_claude_messages'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <FormLabel>应用于所有 Claude Messages 请求</FormLabel>
                    <FormDescription>
                      对每个 /v1/messages 请求强制写入 Claude 设备 ID 和会话 ID。
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Codex Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Codex (OpenAI Responses API)</CardTitle>
            <CardDescription>
              管理{' '}
              <code className='text-xs'>
                client_metadata.x-codex-installation-id
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <FormField
              control={form.control}
              name='codex.enabled'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <FormLabel>启用 Codex 标识</FormLabel>
                    <FormDescription>
                      为 /v1/responses 请求注入安装 ID。
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='codex.mode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>注入模式</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='force_global'>
                        强制全局值（替换全部）
                      </SelectItem>
                      <SelectItem value='disabled'>禁用</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    强制全局值：始终替换为 NewAPI 后台配置的 ID。
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='codex.installation_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>安装 ID</FormLabel>
                  <div className='flex gap-2'>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder='留空时自动生成 UUID'
                      />
                    </FormControl>
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      onClick={handleGenerateCodex}
                      disabled={generateCodexMutation.isPending}
                    >
                      <Shuffle className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      onClick={handleRotateCodex}
                      disabled={rotateCodexMutation.isPending}
                      title='立即轮换'
                    >
                      <RefreshCw className='h-4 w-4' />
                    </Button>
                  </div>
                  <FormDescription>
                    注入到 Codex 请求中的 UUID。
                  </FormDescription>
                </FormItem>
              )}
            />

            <div className='space-y-4 border-t pt-4'>
              <h4 className='text-sm font-medium'>自动轮换</h4>

              <FormField
                control={form.control}
                name='codex.rotate_enabled'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between'>
                    <div className='space-y-0.5'>
                      <FormLabel>启用轮换</FormLabel>
                      <FormDescription>
                        按计划自动生成新的 ID。
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='codex.rotate_interval_value'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>间隔数值</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='codex.rotate_interval_unit'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>间隔单位</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='week'>周</SelectItem>
                          <SelectItem value='month'>月</SelectItem>
                          <SelectItem value='year'>年</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              {form.watch('codex.next_rotate_at') > 0 && (
                <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <Clock className='h-4 w-4' />
                  <span>
                    下次轮换：{' '}
                    {formatTimestamp(form.watch('codex.next_rotate_at'))}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Claude Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Claude Code / Claude CLI</CardTitle>
            <CardDescription>
              管理{' '}
              <code className='text-xs'>metadata.user_id.device_id</code>
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <FormField
              control={form.control}
              name='claude.enabled'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <FormLabel>启用 Claude 标识</FormLabel>
                    <FormDescription>
                      为 /v1/messages 请求注入设备 ID。
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='claude.mode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>注入模式</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='force_global'>
                        强制全局值（替换全部）
                      </SelectItem>
                      <SelectItem value='disabled'>禁用</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='claude.device_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>设备 ID</FormLabel>
                  <div className='flex gap-2'>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder='留空时自动生成 UUID'
                      />
                    </FormControl>
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      onClick={handleGenerateClaude}
                      disabled={generateClaudeMutation.isPending}
                    >
                      <Shuffle className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      onClick={handleRotateClaude}
                      disabled={rotateClaudeMutation.isPending}
                      title='立即轮换'
                    >
                      <RefreshCw className='h-4 w-4' />
                    </Button>
                  </div>
                  <FormDescription>
                    注入到 Claude Code 请求中的 UUID。
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='claude.session_id_mode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>会话 ID 模式</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='force_global'>强制全局值</SelectItem>
                      <SelectItem value='disabled'>禁用</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    强制全局值会把请求中的 session_id 替换为 NewAPI 后台配置值。
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='claude.fixed_session_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>固定会话 ID</FormLabel>
                  <div className='flex gap-2'>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder='留空时自动生成 UUID'
                      />
                    </FormControl>
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      onClick={() =>
                        form.setValue(
                          'claude.fixed_session_id',
                          crypto.randomUUID(),
                          { shouldDirty: true }
                        )
                      }
                      title='生成会话 ID'
                    >
                      <Shuffle className='h-4 w-4' />
                    </Button>
                  </div>
                  <FormDescription>
                    启用强制模式后，会写入 metadata.user_id.session_id，并同步到
                    Claude 会话请求头。
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='claude.sync_session_header'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <FormLabel>同步 X-Claude-Code-Session-Id</FormLabel>
                    <FormDescription>
                      让 Claude 会话请求头与固定会话 ID 保持一致。
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className='space-y-4 border-t pt-4'>
              <h4 className='text-sm font-medium'>自动轮换</h4>

              <FormField
                control={form.control}
                name='claude.rotate_enabled'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between'>
                    <div className='space-y-0.5'>
                      <FormLabel>启用轮换</FormLabel>
                      <FormDescription>
                        按计划自动生成新的设备 ID。
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='claude.rotate_interval_value'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>间隔数值</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='claude.rotate_interval_unit'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>间隔单位</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='week'>周</SelectItem>
                          <SelectItem value='month'>月</SelectItem>
                          <SelectItem value='year'>年</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              {form.watch('claude.next_rotate_at') > 0 && (
                <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <Clock className='h-4 w-4' />
                  <span>
                    下次轮换：{' '}
                    {formatTimestamp(form.watch('claude.next_rotate_at'))}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Generic Provider Settings */}
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between gap-4'>
              <div>
                <CardTitle>通用服务商字段</CardTitle>
                <CardDescription>
                  为其他服务商强制写入自定义请求头或 JSON 请求体字段。
                </CardDescription>
              </div>
              <Button
                type='button'
                variant='outline'
                onClick={handleAddGeneric}
              >
                <Plus className='mr-2 h-4 w-4' />
                添加字段
              </Button>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            {genericFields.length === 0 && (
              <div className='text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm'>
                尚未配置通用标识字段。
              </div>
            )}
            {genericFields.map((field, index) => (
              <div key={field.id} className='space-y-4 rounded-md border p-4'>
                <div className='flex items-center justify-between gap-3'>
                  <FormField
                    control={form.control}
                    name={`generic.${index}.enabled`}
                    render={({ field }) => (
                      <FormItem className='flex items-center gap-3 space-y-0'>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className='font-medium'>启用</FormLabel>
                      </FormItem>
                    )}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => removeGeneric(index)}
                    title='移除字段'
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name={`generic.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>服务商名称</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder='Gemini / Tongyi / Custom'
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`generic.${index}.mode`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>模式</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='force_global'>
                              强制全局值
                            </SelectItem>
                            <SelectItem value='disabled'>禁用</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name={`generic.${index}.path_type`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>写入位置</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='body_json'>JSON 请求体</SelectItem>
                            <SelectItem value='header'>请求头</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`generic.${index}.field_path`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>字段路径</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder='metadata.device_id or X-Device-Id'
                          />
                        </FormControl>
                        <FormDescription>
                          JSON 请求体使用点分路径；请求头使用完整请求头名称。
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name={`generic.${index}.field_value`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>字段值</FormLabel>
                      <div className='flex gap-2'>
                        <FormControl>
                          <Input {...field} placeholder='UUID 或固定值' />
                        </FormControl>
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          onClick={() => handleGenerateGeneric(index)}
                          title='生成字段值'
                        >
                          <Shuffle className='h-4 w-4' />
                        </Button>
                      </div>
                    </FormItem>
                  )}
                />

                <div className='space-y-4 border-t pt-4'>
                  <FormField
                    control={form.control}
                    name={`generic.${index}.rotate_enabled`}
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between'>
                        <div className='space-y-0.5'>
                          <FormLabel>启用轮换</FormLabel>
                          <FormDescription>
                            按配置的周期轮换该字段值。
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className='grid grid-cols-2 gap-4'>
                    <FormField
                      control={form.control}
                      name={`generic.${index}.rotate_interval_value`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>间隔数值</FormLabel>
                          <FormControl>
                            <Input
                              type='number'
                              min={1}
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value) || 1)
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`generic.${index}.rotate_interval_unit`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>间隔单位</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value='week'>周</SelectItem>
                              <SelectItem value='month'>月</SelectItem>
                              <SelectItem value='year'>年</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                  {form.watch(`generic.${index}.next_rotate_at`) > 0 && (
                    <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                      <Clock className='h-4 w-4' />
                      <span>
                        下次轮换：{' '}
                        {formatTimestamp(
                          form.watch(`generic.${index}.next_rotate_at`)
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className='flex justify-end'>
          <Button type='submit' disabled={updateMutation.isPending}>
            {updateMutation.isPending ? '保存中...' : '保存设置'}
          </Button>
        </div>
      </form>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>导入客户端标识配置</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={14}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder='{ "ClientIdentity": { "enabled": true } }'
            className='font-mono text-xs'
          />
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setImportOpen(false)}
            >
              取消
            </Button>
            <Button type='button' onClick={importConfig}>
              导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  )
}
