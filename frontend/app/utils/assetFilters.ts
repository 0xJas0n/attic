import type { Attribute, FilterCriteria, FilterIssue, FilterNode, FilterRule, OrganizationFeatures } from '~/types/api'

export const criteriaKeys = ['q', 'attribute_q', 'category_id', 'location_id', 'condition_id', 'collection_id'] as const

function t(key: string, params?: Record<string, unknown>): string {
  return useNuxtApp().$i18n.t(`assets.filters.${key}`, params ?? {}) as string
}

export function criteriaLabel(key: typeof criteriaKeys[number]): string {
  return t(`criteria.${key}`)
}

/** Describe quick-search coverage using only enabled workspace features. */
export function quickSearchDescription(features: Pick<OrganizationFeatures, 'tags' | 'attributes'>): string {
  const fields = [t('quickSearch.names'), t('quickSearch.descriptions'), t('quickSearch.notes')]
  if (features.tags) fields.push(t('quickSearch.tags'))
  if (features.attributes) fields.push(t('quickSearch.attributeValues'))
  return t('quickSearch.description', { fields: fields.slice(0, -1).join(', '), last: fields[fields.length - 1] })
}

export function normalizeIssuePath(path: string) {
  return path.replace(/^criteria\./, '').replace(/\[(\d+)\]/g, '.$1')
}

export function issueLabel(issue: FilterIssue, criteria: FilterCriteria, attributes: Attribute[] = []) {
  const path = normalizeIssuePath(issue.path)
  const key = criteriaKeys.find(key => path === key || path.startsWith(`${key}.`))
  if (key) return criteriaLabel(key)
  if (path === 'tag_ids' || path === 'tag_match') return t('field.tags')
  if (!path.startsWith('expression')) return t('field.filter')
  const indices = [...path.matchAll(/children\.(\d+)/g)].map(match => Number(match[1]))
  let node = criteria.expression
  for (const index of indices) node = node?.kind === 'group' ? node.children[index] : undefined
  const label = node?.kind === 'rule'
    ? node.field === 'attribute'
      ? attributes.find(a => a.id === node.attribute_id)?.name || t('field.attribute')
      : t(`field.${node.field}`)
    : t('field.group')
  return indices.length ? t('ruleLabel', { label, rule: indices.map(i => i + 1).join('.') }) : label
}

export function copyCriteria(value: FilterCriteria): FilterCriteria {
  const result: FilterCriteria = { version: value.version }
  for (const key of criteriaKeys) if (value[key]) result[key] = value[key]
  if (value.tag_ids?.length) result.tag_ids = [...value.tag_ids]
  if (value.tag_match) result.tag_match = value.tag_match
  if (value.expression) result.expression = JSON.parse(JSON.stringify(value.expression))
  return result
}

export function criteriaEqual(a: FilterCriteria, b: FilterCriteria) {
  return JSON.stringify(copyCriteria(a)) === JSON.stringify(copyCriteria(b))
}

// Parse structure only: stale references remain editable and are validated by the API.
export function readCriteria(query: Record<string, unknown>): { criteria: FilterCriteria, error?: string } {
  let criteria: FilterCriteria = { version: 1 }
  if (typeof query.criteria === 'string') {
    try {
      const parsed = JSON.parse(query.criteria)
      if (!parsed || parsed.version !== 1) throw new Error('Unsupported filter version')
      for (const key of criteriaKeys) if (parsed[key] !== undefined && typeof parsed[key] !== 'string') throw new Error('Invalid criteria')
      if (parsed.tag_ids !== undefined && (!Array.isArray(parsed.tag_ids) || parsed.tag_ids.length > 50 || parsed.tag_ids.some((id: unknown) => typeof id !== 'string'))) throw new Error('Invalid criteria')
      if (parsed.tag_match !== undefined && !['any', 'all'].includes(parsed.tag_match)) throw new Error('Invalid criteria')
      if (parsed.expression && !isNode(parsed.expression)) throw new Error('Invalid expression')
      criteria = copyCriteria(parsed)
    } catch {
      return { criteria, error: t('invalidUrl') }
    }
  }
  for (const key of criteriaKeys) if (typeof query[key] === 'string') criteria[key] = query[key] as string
  const rawTagIDs = query.tag_id
  const tagIDs = typeof rawTagIDs === 'string' ? [rawTagIDs] : Array.isArray(rawTagIDs) ? rawTagIDs.filter((id): id is string => typeof id === 'string') : []
  if (tagIDs.length) {
    if (tagIDs.length > 50) return { criteria: { version: 1 }, error: t('invalidUrl') }
    if (query.tag_match !== undefined && !['any', 'all'].includes(query.tag_match as string)) return { criteria: { version: 1 }, error: t('invalidUrl') }
    criteria.tag_ids = [...new Set(tagIDs)]
    criteria.tag_match = query.tag_match === 'all' ? 'all' : 'any'
  } else if (query.tag_match !== undefined) {
    return { criteria: { version: 1 }, error: t('invalidUrl') }
  }
  return { criteria }
}

function isNode(value: unknown, depth = 1, budget = { rules: 0 }): value is FilterNode {
  if (!value || typeof value !== 'object') return false
  const node = value as FilterNode
  if (node.kind === 'group') return depth <= 5 && ['all', 'any'].includes(node.match) && Array.isArray(node.children) && node.children.length <= 50 && node.children.every(child => isNode(child, depth + 1, budget))
  return node.kind === 'rule' && ++budget.rules <= 50 && ['attribute', 'collections', 'tags', 'category', 'location', 'condition', 'q', 'attribute_q'].includes(node.field)
    && typeof node.operator === 'string'
    && (node.attribute_id === undefined || typeof node.attribute_id === 'string')
    && (node.value === undefined || ['string', 'number', 'boolean'].includes(typeof node.value))
    && (node.upper === undefined || ['string', 'number'].includes(typeof node.upper))
    && (node.values === undefined || (Array.isArray(node.values) && node.values.length <= 100 && node.values.every(v => typeof v === 'string')))
}

export function ruleOperators(rule: FilterRule): string[] {
  if (rule.field === 'q') return ['search']
  if (rule.field === 'attribute_q') return ['contains']
  if (rule.field === 'collections') return ['any', 'all']
  if (rule.field === 'tags') return ['any', 'all']
  if (rule.field !== 'attribute') return ['any']
  const empty = ['empty', 'not_empty']
  if (rule.data_type === 'select') return [...(rule.selection_mode === 'multiple' ? ['any', 'all'] : ['any']), ...empty]
  if (rule.data_type === 'boolean') return ['eq', ...empty]
  if (rule.data_type === 'number' || rule.data_type === 'date') return ['eq', 'lt', 'lte', 'gt', 'gte', 'between', ...empty]
  return ['eq', 'contains', ...empty]
}

export function operatorLabel(operator: string): string {
  return t(`operator.${operator}`)
}

export function newAttributeRule(attribute: Attribute): FilterRule {
  return {
    kind: 'rule', field: 'attribute', attribute_id: attribute.id, data_type: attribute.data_type,
    ...(attribute.data_type === 'select' ? { selection_mode: attribute.selection_mode || 'single' } : {}),
    operator: attribute.data_type === 'select' ? 'any' : 'eq',
    ...(attribute.data_type === 'boolean' ? { value: true } : {})
  }
}

export function countRules(node?: FilterNode): number {
  if (!node) return 0
  return node.kind === 'rule' ? 1 : node.children.reduce((n, child) => n + countRules(child), 0)
}

export function validateExpression(node?: FilterNode): FilterIssue[] {
  const issues: FilterIssue[] = []
  if (!node) return issues
  if (countRules(node) > 50) issues.push({ path: 'expression', message: t('issue.maxRules') })
  function visit(current: FilterNode, path: string, depth: number) {
    const add = (message: string) => issues.push({ path, message })
    if (current.kind === 'group') {
      if (depth > 5) add(t('issue.maxDepth'))
      if (!current.children.length) add(t('issue.emptyGroup'))
      current.children.forEach((child, i) => visit(child, `${path}.children[${i}]`, depth + 1))
      return
    }
    if (!ruleOperators(current).includes(current.operator)) add(t('issue.unsupportedComparison'))
    if (current.field === 'attribute' && (!current.attribute_id || !current.data_type || (current.data_type === 'select' && !current.selection_mode))) add(t('issue.restoreAttribute'))
    if (['empty', 'not_empty'].includes(current.operator)) return
    if (['any', 'all'].includes(current.operator)) {
      if (!current.values?.length) add(t('issue.selectValue'))
      if ((current.values?.length || 0) > 100) add(t('issue.maxValues'))
      return
    }
    if (current.value === undefined || current.value === '') add(t('issue.enterValue'))
    if (current.data_type === 'number' && (typeof current.value !== 'number' || !Number.isFinite(current.value))) add(t('issue.validNumber'))
    if (current.data_type === 'boolean' && typeof current.value !== 'boolean') add(t('issue.chooseBoolean'))
    if (current.operator === 'between') {
      if (current.upper === undefined || current.upper === '') add(t('issue.enterUpper'))
      else if (current.data_type === 'number' && (typeof current.upper !== 'number' || !Number.isFinite(current.upper))) add(t('issue.validUpper'))
      else if (current.value !== undefined && current.value > current.upper) add(t('issue.upperAtLeastLower'))
    }
  }
  visit(node, 'expression', 1)
  return issues
}

export function filterFailure(error: unknown): { message: string, issues: FilterIssue[] } {
  const data = (error as { data?: { error?: string, issues?: FilterIssue[] } } | null)?.data
  return { message: data?.error || t('failure'), issues: data?.issues || [] }
}
