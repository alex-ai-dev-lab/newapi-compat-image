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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface CodexIdentityConfig {
  enabled: boolean
  mode: 'force_global' | 'disabled'
  installation_id: string
  rotate_enabled: boolean
  rotate_interval_unit: 'week' | 'month' | 'year'
  rotate_interval_value: number
  next_rotate_at: number
}

export interface ClaudeIdentityConfig {
  enabled: boolean
  mode: 'force_global' | 'disabled'
  device_id: string
  session_id_mode: 'force_global' | 'disabled'
  fixed_session_id: string
  sync_session_header: boolean
  rotate_enabled: boolean
  rotate_interval_unit: 'week' | 'month' | 'year'
  rotate_interval_value: number
  next_rotate_at: number
}

export interface GenericIdentityConfig {
  name: string
  enabled: boolean
  mode: 'force_global' | 'disabled'
  path_type: 'body_json' | 'header'
  field_path: string
  field_value: string
  rotate_enabled: boolean
  rotate_interval_unit: 'week' | 'month' | 'year'
  rotate_interval_value: number
  next_rotate_at: number
}

export interface ClientIdentitySetting {
  enabled: boolean
  apply_to_all_openai_responses: boolean
  apply_to_all_claude_messages: boolean
  codex: CodexIdentityConfig
  claude: ClaudeIdentityConfig
  generic: GenericIdentityConfig[]
}

async function fetchClientIdentitySetting(): Promise<ClientIdentitySetting> {
  const response = await api.get<{ success: boolean; data: ClientIdentitySetting }>(
    '/api/option/client_identity'
  )
  return response.data.data
}

async function updateClientIdentitySetting(
  setting: ClientIdentitySetting
): Promise<void> {
  await api.put('/api/option/client_identity', setting)
}

async function generateCodexId(): Promise<string> {
  const response = await api.post<{ success: boolean; data: string }>(
    '/api/option/client_identity/codex/generate'
  )
  return response.data.data
}

async function rotateCodexId(): Promise<string> {
  const response = await api.post<{ success: boolean; data: string }>(
    '/api/option/client_identity/codex/rotate'
  )
  return response.data.data
}

async function generateClaudeId(): Promise<string> {
  const response = await api.post<{ success: boolean; data: string }>(
    '/api/option/client_identity/claude/generate'
  )
  return response.data.data
}

async function rotateClaudeId(): Promise<string> {
  const response = await api.post<{ success: boolean; data: string }>(
    '/api/option/client_identity/claude/rotate'
  )
  return response.data.data
}

export function useClientIdentitySetting() {
  return useQuery({
    queryKey: ['client-identity-setting'],
    queryFn: fetchClientIdentitySetting,
  })
}

export function useUpdateClientIdentitySetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateClientIdentitySetting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-identity-setting'] })
    },
  })
}

export function useGenerateCodexId() {
  return useMutation({
    mutationFn: generateCodexId,
  })
}

export function useRotateCodexId() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rotateCodexId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-identity-setting'] })
    },
  })
}

export function useGenerateClaudeId() {
  return useMutation({
    mutationFn: generateClaudeId,
  })
}

export function useRotateClaudeId() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rotateClaudeId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-identity-setting'] })
    },
  })
}
