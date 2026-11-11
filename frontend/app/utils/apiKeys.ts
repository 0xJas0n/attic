export function formatKeyLastUsed(value: string | null, now = Date.now()): string {
  const { $i18n } = useNuxtApp()
  const t = $i18n.t as (key: string, ...args: unknown[]) => string
  if (!value) return t('misc.apiKeys.neverUsed')
  const elapsed = Math.max(0, now - new Date(value).getTime())
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return t('misc.apiKeys.justNow')
  if (minutes < 60) return t('misc.apiKeys.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('misc.apiKeys.hoursAgo', hours)
  const days = Math.floor(hours / 24)
  if (days === 1) return t('misc.apiKeys.yesterday')
  if (days < 7) return t('misc.apiKeys.daysAgo', { count: days })
  return new Date(value).toLocaleDateString($i18n.locale.value, { month: 'short', day: 'numeric', year: 'numeric' })
}
