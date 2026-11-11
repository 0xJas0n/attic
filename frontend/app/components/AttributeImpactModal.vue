<script setup lang="ts">
interface Impact {
  affected_assets: number
  deleted_assets: number
  required_fields_left_empty: number
  current: string
  proposed: string
  confirmation_token: string
}
interface Operation {
  attributeId: string
  action: 'update_attribute' | 'delete_attribute' | 'update_option' | 'delete_option'
  optionId?: string
  changes?: Record<string, unknown>
  deletedOptionCount?: number
}
const apiFetch = useApiFetch()
const { t } = useI18n()
const open = ref(false)
const busy = ref(false)
const error = ref('')
const impact = ref<Impact | null>(null)
const operation = ref<Operation | null>(null)
let onSuccess: (() => void | Promise<void>) | undefined
const deleting = computed(() => operation.value?.action.startsWith('delete') ?? false)
const hasOptionDeletions = computed(() => (operation.value?.deletedOptionCount || 0) > 0)
const hasOptionDraft = computed(() => Array.isArray(operation.value?.changes?.options))
const destructive = computed(() => deleting.value || hasOptionDeletions.value)
const noun = computed(() => operation.value?.action.endsWith('option') ? 'option' : 'field')
const title = computed(() => t(`catalog.impact.title${deleting.value ? 'Delete' : 'Update'}${noun.value === 'option' ? 'Option' : 'Field'}`))
const message = computed(() => {
  const value = impact.value
  if (!value) return t('catalog.impact.loading')
  const n = value.affected_assets
  const kind = noun.value === 'option' ? 'Option' : 'Field'
  if (hasOptionDeletions.value) {
    if (n === 0) return t('catalog.impact.optionDeletionsNone')
    return t('catalog.impact.optionDeletions', { count: n }, n)
  }
  if (n === 0) return t(`catalog.impact.noUse${kind}`)
  if (deleting.value) return t(`catalog.impact.delete${kind}`, { count: n }, n)
  if (value.current !== value.proposed) return t(`catalog.impact.rename${kind}`, { count: n, value: value.proposed }, n)
  return t(`catalog.impact.config${kind}`, { count: n }, n)
})
async function preview() {
  const op = operation.value!
  impact.value = await apiFetch<Impact>(`/api/attributes/${op.attributeId}/impact-preview`, {
    method: 'POST',
    body: JSON.stringify({ action: op.action, option_id: op.optionId, changes: op.changes || {} })
  })
  return impact.value
}
async function run(op: Operation, success: () => void | Promise<void>) {
  if (busy.value) return
  operation.value = JSON.parse(JSON.stringify(op))
  onSuccess = success
  impact.value = null
  error.value = ''
  open.value = true
  busy.value = true
  try {
    const result = await preview()
    busy.value = false
    if (!destructive.value && result.affected_assets === 0) await confirm()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}
async function confirm() {
  if (busy.value) return
  if (!impact.value) {
    busy.value = true
    try {
      await preview()
      error.value = ''
    } catch (err) {
      error.value = errorMessage(err)
    } finally {
      busy.value = false
    }
    return
  }
  busy.value = true
  error.value = ''
  try {
    const op = operation.value!
    const path = `/api/attributes/${op.attributeId}${op.optionId ? '/options/' + op.optionId : ''}`
    await apiFetch(path, {
      method: deleting.value ? 'DELETE' : op.optionId ? 'PATCH' : 'PUT',
      headers: { 'X-Impact-Token': impact.value.confirmation_token },
      ...(deleting.value ? {} : { body: JSON.stringify(op.changes || {}) })
    })
    open.value = false
    await onSuccess?.()
  } catch (err) {
    const failure = err as { data?: { code?: string } }
    if (failure.data?.code === 'impact_preview_required') {
      impact.value = null
      try {
        await preview()
        error.value = t('catalog.impact.changed')
      } catch (refreshError) { error.value = errorMessage(refreshError) }
    } else error.value = errorMessage(err)
  } finally { busy.value = false }
}
function errorMessage(err: unknown) {
  return (err as { data?: { error?: string } }).data?.error || t('catalog.impact.failed')
}
defineExpose({ run })
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="t('catalog.impact.description')"
    :dismissible="!busy"
    :close="!busy"
  >
    <template #body>
      <div class="space-y-3">
        <p
          v-if="impact"
          class="font-semibold"
        >
          {{ impact.current }}<span v-if="!deleting && impact.current !== impact.proposed"> → {{ impact.proposed }}</span>
        </p>
        <p>{{ message }}</p>
        <p v-if="impact?.deleted_assets">
          {{ t('catalog.impact.includesDeleted', { count: impact.deleted_assets }) }}
        </p>
        <p v-if="impact?.required_fields_left_empty">
          {{ t('catalog.impact.requiredEmpty', { count: impact.required_fields_left_empty }, impact.required_fields_left_empty) }}
        </p>
        <p v-if="deleting">
          {{ t('catalog.impact.irreversible') }}
        </p>
        <p v-if="deleting && noun === 'option'">
          {{ t('catalog.impact.multiRetained') }}
        </p>
        <p v-if="!deleting && !hasOptionDraft && (operation?.changes?.value || operation?.changes?.key)">
          {{ t('catalog.impact.keysUpdated') }}
        </p>
        <p
          v-if="error"
          role="alert"
          class="text-red-600"
        >
          {{ error }}
        </p>
      </div>
    </template>
    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        :disabled="busy"
        @click="open = false"
      >
        {{ t('catalog.shared.cancel') }}
      </UButton>
      <UButton
        :color="destructive ? 'error' : 'primary'"
        :loading="busy"
        @click="confirm"
      >
        {{ impact ? title : t('catalog.impact.retry') }}
      </UButton>
    </template>
  </UModal>
</template>
