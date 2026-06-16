/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm } from 'react-hook-form'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type HeaderRuleSetting,
  useHeaderRuleCategories,
  useHeaderRuleSetting,
  useUpdateHeaderRuleSetting,
} from './header-rules-api'

const DEFAULT_SETTING: HeaderRuleSetting = {
  enabled: false,
  apply_to_channel_test: true,
  groups: [],
}

const ACTION_OPTIONS = [
  { value: 'keep', label: '保留原值' },
  { value: 'replace', label: '仅替换值' },
  { value: 'set_fixed', label: '添加并固定值' },
  { value: 'delete', label: '删除' },
  { value: 'set_if_absent', label: '缺失则补充' },
] as const

const DEFAULT_CATEGORIES = ['*', 'claude', 'codex', 'openai', 'gemini', 'grok', 'other']

export function HeaderRulesSettingsCard() {
  const { data: setting, isLoading } = useHeaderRuleSetting()
  const { data: categories } = useHeaderRuleCategories()
  const updateMutation = useUpdateHeaderRuleSetting()

  const form = useForm<HeaderRuleSetting>({ defaultValues: DEFAULT_SETTING })
  const groups = useFieldArray({ control: form.control, name: 'groups' })

  useEffect(() => {
    if (setting) form.reset({ ...DEFAULT_SETTING, ...setting })
  }, [setting, form])

  const categoryOptions = categories?.length ? categories : DEFAULT_CATEGORIES

  const onSubmit = async (values: HeaderRuleSetting) => {
    try {
      await updateMutation.mutateAsync(values)
      toast.success('请求头规则已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  if (isLoading) {
    return <div className='flex items-center justify-center py-8'>加载中...</div>
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <Alert>
          <AlertDescription>
            请求头规则会在请求体客户端标识符和身份请求头注入之后执行，作为最终出站请求头决策。Codex 的 Originator、X-Stainless 等指纹头应配置在这里，而不是硬编码在 api_request.go。
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>请求头规则</CardTitle>
            <CardDescription>
              按 claude / codex / openai / gemini / grok / other 分类管理 Header，支持渠道测试是否套用。
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel>启用请求头规则</FormLabel>
                    <FormDescription>关闭后不修改任何出站请求头。</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='apply_to_channel_test'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel>渠道测试也套用</FormLabel>
                    <FormDescription>开启后单测渠道和测试全部也执行请求头规则。</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {groups.fields.map((group, groupIndex) => (
          <Card key={group.id}>
            <CardHeader>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <CardTitle>规则组 #{groupIndex + 1}</CardTitle>
                  <CardDescription>* 规则组对所有分类生效。</CardDescription>
                </div>
                <Button type='button' variant='ghost' size='icon' onClick={() => groups.remove(groupIndex)}>
                  <Trash2 className='h-4 w-4' />
                </Button>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-4 md:grid-cols-2'>
                <FormField
                  control={form.control}
                  name={`groups.${groupIndex}.category`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>分类</FormLabel>
                      <Select value={field.value || '*'} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoryOptions.map((category) => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`groups.${groupIndex}.enabled`}
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                      <FormLabel>启用此组</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <RulesTable groupIndex={groupIndex} form={form} />
            </CardContent>
          </Card>
        ))}

        <div className='flex flex-wrap justify-between gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => groups.append({ category: 'codex', enabled: true, rules: [] })}
          >
            <Plus className='mr-2 h-4 w-4' />新增规则组
          </Button>
          <Button type='submit' disabled={updateMutation.isPending}>
            {updateMutation.isPending ? '保存中...' : '保存设置'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function RulesTable({ groupIndex, form }: { groupIndex: number; form: ReturnType<typeof useForm<HeaderRuleSetting>> }) {
  const rules = useFieldArray({ control: form.control, name: `groups.${groupIndex}.rules` })
  return (
    <div className='space-y-3'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>启用</TableHead>
            <TableHead>Header 名</TableHead>
            <TableHead>动作</TableHead>
            <TableHead>值</TableHead>
            <TableHead className='w-12'></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.fields.map((rule, ruleIndex) => {
            const action = form.watch(`groups.${groupIndex}.rules.${ruleIndex}.action`)
            const valueDisabled = action === 'delete' || action === 'keep'
            return (
              <TableRow key={rule.id}>
                <TableCell>
                  <FormField control={form.control} name={`groups.${groupIndex}.rules.${ruleIndex}.enabled`} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
                </TableCell>
                <TableCell>
                  <FormField control={form.control} name={`groups.${groupIndex}.rules.${ruleIndex}.name`} render={({ field }) => <Input {...field} placeholder='Originator' />} />
                </TableCell>
                <TableCell>
                  <FormField
                    control={form.control}
                    name={`groups.${groupIndex}.rules.${ruleIndex}.action`}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ACTION_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField control={form.control} name={`groups.${groupIndex}.rules.${ruleIndex}.value`} render={({ field }) => <Input {...field} disabled={valueDisabled} placeholder='codex_cli_rs' />} />
                </TableCell>
                <TableCell>
                  <Button type='button' variant='ghost' size='icon' onClick={() => rules.remove(ruleIndex)}>
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={() => rules.append({ enabled: true, name: '', action: 'set_if_absent', value: '' })}
      >
        <Plus className='mr-2 h-4 w-4' />新增 Header 规则
      </Button>
    </div>
  )
}
