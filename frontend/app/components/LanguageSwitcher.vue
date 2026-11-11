<script setup lang="ts">
const { locale, locales, setLocale, t } = useI18n()

const items = computed(() => locales.value.map(l => ({
  label: typeof l === 'string' ? l : l.name || l.code,
  value: typeof l === 'string' ? l : l.code
})))

const selected = computed({
  get: () => locale.value,
  set: (code: string) => { void setLocale(code as 'en' | 'de') }
})
</script>

<template>
  <USelect
    v-model="selected"
    :items="items"
    value-key="value"
    icon="i-lucide-languages"
    size="sm"
    class="min-w-32"
    :aria-label="t('common.language')"
  />
</template>
