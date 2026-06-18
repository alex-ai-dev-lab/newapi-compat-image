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
import { EXCLUDED_GROUPS, QUOTA_TYPE_VALUES } from '../constants'
import type { PricingModel } from '../types'

// ----------------------------------------------------------------------------
// Model Helper Utilities
// ----------------------------------------------------------------------------

/**
 * Get available groups for a model
 */
export function getAvailableGroups(
  model: PricingModel,
  usableGroup: Record<string, { desc: string; ratio: number }>
): string[] {
  const modelEnableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []

  return Object.keys(usableGroup)
    .filter((g) => !EXCLUDED_GROUPS.includes(g))
    .filter((g) => modelEnableGroups.includes(g))
}

/**
 * Replace model placeholder in endpoint path
 */
export function replaceModelInPath(path: string, modelName: string): string {
  return path.replace(/\{model\}/g, modelName)
}

/**
 * Check if model is token-based pricing
 */
export function isTokenBasedModel(model: PricingModel): boolean {
  return model.quota_type === QUOTA_TYPE_VALUES.TOKEN
}

function looksLikeGeneratedVendorDescription(
  description: string | undefined,
  modelName: string | undefined
): boolean {
  if (!description) return false
  const normalized = description.trim()
  if (!normalized) return false

  const escapedModel = String(modelName || '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .trim()
  if (!escapedModel) return false

  const pattern = new RegExp(
    `^${escapedModel}\\s+is\\s+an\\s+ai\\s+model\\s+provided\\s+by\\s+.+\\.?$`,
    'i'
  )

  return pattern.test(normalized)
}

export function getModelDescription(
  model: PricingModel,
  t: (key: string) => string
): string {
  const primary = model.description?.trim()
  if (
    primary &&
    !looksLikeGeneratedVendorDescription(primary, model.model_name)
  ) {
    return primary
  }

  const vendorDescription = model.vendor_description?.trim()
  if (
    vendorDescription &&
    !looksLikeGeneratedVendorDescription(vendorDescription, model.model_name)
  ) {
    return vendorDescription
  }

  return t('No description available.')
}
