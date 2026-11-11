<script setup lang="ts">
import type { AttributeOptionDraft } from '~/types/api'
import { createAttributeOptionDraft } from '~/utils/attributeOptions'

const options = defineModel<AttributeOptionDraft[]>({ default: () => [] })
const { t } = useI18n()
const newLabel = ref('')
const newValue = ref('')
const editedValue = ref(false)
const drafts = reactive<Record<string, { label: string, value: string }>>({})
watch(newLabel, (label) => {
  if (!editedValue.value) newValue.value = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
})
watch(options, (items) => {
  for (const o of items) drafts[o.draftId] = { label: o.label, value: o.value }
}, { immediate: true, deep: true })
function addOption() {
  if (!newLabel.value.trim() || !newValue.value.trim()) return
  const option = createAttributeOptionDraft({ label: newLabel.value.trim(), value: newValue.value.trim(), sort_order: options.value.length })
  options.value = [...options.value, option]
  newLabel.value = ''
  newValue.value = ''
  editedValue.value = false
}
function editOption(option: AttributeOptionDraft, field: 'label' | 'value', value: string | number) {
  drafts[option.draftId]![field] = String(value)
  options.value = options.value.map(o => o.draftId === option.draftId ? { ...o, [field]: String(value) } : o)
}
function deleteOption(option: AttributeOptionDraft) {
  options.value = options.value.filter(o => o.draftId !== option.draftId)
}
function move(index: number, direction: number) {
  const items = [...options.value]
  const other = index + direction
  if (other < 0 || other >= items.length) return
  ;[items[index], items[other]] = [items[other]!, items[index]!]
  options.value = items.map((o, sort_order) => ({ ...o, sort_order }))
}
</script>

<template>
  <section class="space-y-4">
    <h2 class="font-semibold text-mist-950 dark:text-white">
      {{ t('catalog.attributeOptions.title') }}
    </h2>
    <p class="text-sm text-muted">
      {{ t('catalog.attributeOptions.hint') }}
    </p>
    <div
      v-for="(option, index) in options"
      :key="option.draftId"
      class="space-y-2 rounded-lg border border-default p-3"
    >
      <div
        v-if="drafts[option.draftId]"
        class="grid gap-2 sm:grid-cols-2"
      >
        <UInput
          :model-value="drafts[option.draftId]!.label"
          :aria-label="t('catalog.attributeOptions.labelFor', { name: option.label })"
          :placeholder="t('catalog.attributeOptions.label')"
          @update:model-value="editOption(option, 'label', $event)"
        />
        <UInput
          :model-value="drafts[option.draftId]!.value"
          :aria-label="t('catalog.attributeOptions.valueFor', { name: option.label })"
          :placeholder="t('catalog.attributeOptions.value')"
          @update:model-value="editOption(option, 'value', $event)"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          size="xs"
          color="error"
          variant="soft"
          icon="i-lucide-trash-2"
          :aria-label="t('catalog.attributeOptions.deleteAria', { name: option.label || t('catalog.attributeOptions.optionFallback') })"
          :title="t('catalog.attributeOptions.deleteTitle')"
          @click="deleteOption(option)"
        />
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :disabled="index === 0"
          :aria-label="t('catalog.attributeOptions.moveUp', { name: option.label })"
          @click="move(index, -1)"
        >
          ↑
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :disabled="index === options.length - 1"
          :aria-label="t('catalog.attributeOptions.moveDown', { name: option.label })"
          @click="move(index, 1)"
        >
          ↓
        </UButton>
      </div>
    </div>
    <div class="grid gap-2 sm:grid-cols-2">
      <UInput
        v-model="newLabel"
        :aria-label="t('catalog.attributeOptions.newLabelAria')"
        :placeholder="t('catalog.attributeOptions.newLabel')"
      />
      <UInput
        v-model="newValue"
        :aria-label="t('catalog.attributeOptions.newValueAria')"
        :placeholder="t('catalog.attributeOptions.value')"
        @update:model-value="editedValue = true"
      />
    </div>
    <UButton
      :disabled="!newLabel.trim() || !newValue.trim()"
      icon="i-lucide-plus"
      @click="addOption"
    >
      {{ t('catalog.attributeOptions.add') }}
    </UButton>
  </section>
</template>
