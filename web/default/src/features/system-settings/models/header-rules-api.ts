/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type HeaderRuleAction =
  | 'keep'
  | 'replace'
  | 'set_fixed'
  | 'delete'
  | 'set_if_absent'

export interface HeaderRule {
  enabled: boolean
  name: string
  action: HeaderRuleAction
  value: string
}

export interface HeaderRuleGroup {
  category: string
  enabled: boolean
  rules: HeaderRule[]
}

export interface HeaderRuleSetting {
  enabled: boolean
  apply_to_channel_test: boolean
  groups: HeaderRuleGroup[]
}

async function fetchHeaderRuleSetting(): Promise<HeaderRuleSetting> {
  const response = await api.get<{ success: boolean; data: HeaderRuleSetting }>(
    '/api/option/header_rules'
  )
  return response.data.data
}

async function updateHeaderRuleSetting(setting: HeaderRuleSetting): Promise<void> {
  await api.put('/api/option/header_rules', setting)
}

async function fetchHeaderRuleCategories(): Promise<string[]> {
  const response = await api.get<{ success: boolean; data: string[] }>(
    '/api/option/header_rules/categories'
  )
  return response.data.data
}

export function useHeaderRuleSetting() {
  return useQuery({
    queryKey: ['header-rule-setting'],
    queryFn: fetchHeaderRuleSetting,
  })
}

export function useUpdateHeaderRuleSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateHeaderRuleSetting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['header-rule-setting'] })
    },
  })
}

export function useHeaderRuleCategories() {
  return useQuery({
    queryKey: ['header-rule-categories'],
    queryFn: fetchHeaderRuleCategories,
  })
}
