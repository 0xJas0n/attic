import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type Messages = Record<string, unknown>

const dir = join(process.cwd(), 'i18n', 'locales', 'en')
const messages: Messages = {}
for (const file of readdirSync(dir)) {
  if (file.endsWith('.json')) Object.assign(messages, JSON.parse(readFileSync(join(dir, file), 'utf8')))
}

function lookup(key: string): string | undefined {
  let node: unknown = messages
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in (node as Messages)) node = (node as Messages)[part]
    else return undefined
  }
  return typeof node === 'string' ? node : undefined
}

function translate(key: string, arg?: Record<string, unknown> | unknown[] | number, arg2?: Record<string, unknown>): string {
  const raw = lookup(key)
  if (raw === undefined) return key
  const params: Record<string, unknown> = typeof arg === 'number'
    ? { count: arg, n: arg, ...(arg2 || {}) }
    : ((arg as Record<string, unknown> | undefined) || {})
  let msg = raw
  if (raw.includes(' | ')) {
    const forms = raw.split(' | ')
    const count = Number(typeof arg === 'number' ? arg : params.count ?? params.n)
    const index = forms.length === 2
      ? (count === 1 ? 0 : 1)
      : (count === 0 ? 0 : count === 1 ? 1 : 2)
    msg = forms[Math.min(index, forms.length - 1)]!
  }
  return msg
    .replace(/\{'(.)'\}/g, '$1')
    .replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = params[name] ?? (name === 'n' ? params.count : undefined)
      return value === undefined ? `{${name}}` : String(value)
    })
}
const i18n = {
  t: translate,
  te: (key: string) => lookup(key) !== undefined,
  locale: { value: 'en' },
  locales: { value: [{ code: 'en', name: 'English' }, { code: 'de', name: 'Deutsch' }] },
  setLocale: async () => {}
}

mockNuxtImport('useI18n', () => () => i18n)
