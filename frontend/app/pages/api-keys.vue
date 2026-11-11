<script setup lang="ts">
const { t } = useI18n()
definePageMeta({ middleware: 'auth' })
await navigateTo('/profile?tab=api-keys', { replace: true })
</script>

<template>
  <span class="sr-only">{{ t('misc.apiKeysPage.opening') }}</span>
</template>
