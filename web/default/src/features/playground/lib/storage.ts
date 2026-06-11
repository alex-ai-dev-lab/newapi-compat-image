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
import { nanoid } from 'nanoid'
import { STORAGE_KEYS } from '../constants'
import type {
  PlaygroundConfig,
  ParameterEnabled,
  Message,
  MessageRole,
  MessageStatus,
  MessageVersion,
} from '../types'
import { sanitizeMessagesOnLoad } from './message-utils'

const MESSAGE_ROLES: MessageRole[] = ['user', 'assistant', 'system']
const MESSAGE_STATUSES: MessageStatus[] = [
  'loading',
  'streaming',
  'complete',
  'error',
]
const NUMERIC_CONFIG_KEYS: Array<keyof PlaygroundConfig> = [
  'temperature',
  'top_p',
  'max_tokens',
  'frequency_penalty',
  'presence_penalty',
]
const PARAMETER_KEYS: Array<keyof ParameterEnabled> = [
  'temperature',
  'top_p',
  'max_tokens',
  'frequency_penalty',
  'presence_penalty',
  'seed',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function removeStorageValue(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore storage cleanup failures.
  }
}

function isMessageRole(value: unknown): value is MessageRole {
  return typeof value === 'string' && MESSAGE_ROLES.includes(value as MessageRole)
}

function isMessageStatus(value: unknown): value is MessageStatus {
  return (
    typeof value === 'string' &&
    MESSAGE_STATUSES.includes(value as MessageStatus)
  )
}

function normalizeVersion(value: unknown): MessageVersion | null {
  if (!isRecord(value) || typeof value.content !== 'string') return null

  return {
    id:
      typeof value.id === 'string' && value.id.trim()
        ? value.id
        : nanoid(),
    content: value.content,
  }
}

function normalizeSources(value: unknown): Message['sources'] {
  if (!Array.isArray(value)) return undefined

  const sources = value
    .filter(isRecord)
    .map((source) => ({
      href: typeof source.href === 'string' ? source.href : '',
      title: typeof source.title === 'string' ? source.title : '',
    }))
    .filter((source) => source.href || source.title)

  return sources.length ? sources : undefined
}

function normalizeReasoning(value: unknown): Message['reasoning'] {
  if (!isRecord(value) || typeof value.content !== 'string') return undefined

  return {
    content: value.content,
    duration:
      typeof value.duration === 'number' && Number.isFinite(value.duration)
        ? value.duration
        : 0,
  }
}

function normalizeMessage(value: unknown): Message | null {
  if (!isRecord(value)) return null

  const role = value.from ?? value.role
  if (!isMessageRole(role)) return null

  const versions = Array.isArray(value.versions)
    ? value.versions.map(normalizeVersion).filter((v): v is MessageVersion => !!v)
    : []

  if (versions.length === 0 && typeof value.content === 'string') {
    versions.push({ id: nanoid(), content: value.content })
  }

  if (versions.length === 0) return null

  const message: Message = {
    key:
      typeof value.key === 'string' && value.key.trim()
        ? value.key
        : nanoid(),
    from: role,
    versions,
  }

  const sources = normalizeSources(value.sources)
  if (sources) message.sources = sources

  const reasoning = normalizeReasoning(value.reasoning)
  if (reasoning) message.reasoning = reasoning

  if (typeof value.isReasoningStreaming === 'boolean') {
    message.isReasoningStreaming = value.isReasoningStreaming
  }
  if (typeof value.isReasoningComplete === 'boolean') {
    message.isReasoningComplete = value.isReasoningComplete
  }
  if (typeof value.isContentComplete === 'boolean') {
    message.isContentComplete = value.isContentComplete
  }
  if (isMessageStatus(value.status)) {
    message.status = value.status
  }
  if (typeof value.errorCode === 'string' || value.errorCode === null) {
    message.errorCode = value.errorCode
  }

  return message
}

/**
 * Load playground config from localStorage
 */
export function loadConfig(): Partial<PlaygroundConfig> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG)
    if (!saved) return {}

    const parsed: unknown = JSON.parse(saved)
    if (!isRecord(parsed)) {
      removeStorageValue(STORAGE_KEYS.CONFIG)
      return {}
    }

    const config: Partial<PlaygroundConfig> = {}
    if (typeof parsed.model === 'string' && parsed.model.trim()) {
      config.model = parsed.model
    }
    if (typeof parsed.group === 'string' && parsed.group.trim()) {
      config.group = parsed.group
    }
    if (typeof parsed.stream === 'boolean') {
      config.stream = parsed.stream
    }
    if (parsed.seed === null) {
      config.seed = null
    } else if (typeof parsed.seed === 'number' && Number.isFinite(parsed.seed)) {
      config.seed = parsed.seed
    }

    NUMERIC_CONFIG_KEYS.forEach((key) => {
      const value = parsed[key]
      if (typeof value === 'number' && Number.isFinite(value)) {
        ;(config as Record<string, unknown>)[key] = value
      }
    })

    return config
  } catch (error) {
    removeStorageValue(STORAGE_KEYS.CONFIG)
    // eslint-disable-next-line no-console
    console.error('Failed to load config:', error)
  }
  return {}
}

/**
 * Save playground config to localStorage
 */
export function saveConfig(config: Partial<PlaygroundConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save config:', error)
  }
}

/**
 * Load parameter enabled state from localStorage
 */
export function loadParameterEnabled(): Partial<ParameterEnabled> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PARAMETER_ENABLED)
    if (!saved) return {}

    const parsed: unknown = JSON.parse(saved)
    if (!isRecord(parsed)) {
      removeStorageValue(STORAGE_KEYS.PARAMETER_ENABLED)
      return {}
    }

    const parameterEnabled: Partial<ParameterEnabled> = {}
    PARAMETER_KEYS.forEach((key) => {
      const value = parsed[key]
      if (typeof value === 'boolean') {
        parameterEnabled[key] = value
      }
    })

    return parameterEnabled
  } catch (error) {
    removeStorageValue(STORAGE_KEYS.PARAMETER_ENABLED)
    // eslint-disable-next-line no-console
    console.error('Failed to load parameter enabled:', error)
  }
  return {}
}

/**
 * Save parameter enabled state to localStorage
 */
export function saveParameterEnabled(
  parameterEnabled: Partial<ParameterEnabled>
): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.PARAMETER_ENABLED,
      JSON.stringify(parameterEnabled)
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save parameter enabled:', error)
  }
}

/**
 * Load messages from localStorage
 */
export function loadMessages(): Message[] | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES)
    if (!saved) return null

    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) {
      removeStorageValue(STORAGE_KEYS.MESSAGES)
      return null
    }

    const normalized = parsed
      .map(normalizeMessage)
      .filter((message): message is Message => !!message)
    const sanitized = sanitizeMessagesOnLoad(normalized)

    if (JSON.stringify(sanitized) !== saved) {
      saveMessages(sanitized)
    }

    return sanitized
  } catch (error) {
    removeStorageValue(STORAGE_KEYS.MESSAGES)
    // eslint-disable-next-line no-console
    console.error('Failed to load messages:', error)
  }
  return null
}

/**
 * Save messages to localStorage
 */
export function saveMessages(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save messages:', error)
  }
}

/**
 * Clear all playground data
 */
export function clearPlaygroundData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONFIG)
    localStorage.removeItem(STORAGE_KEYS.PARAMETER_ENABLED)
    localStorage.removeItem(STORAGE_KEYS.MESSAGES)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear playground data:', error)
  }
}
