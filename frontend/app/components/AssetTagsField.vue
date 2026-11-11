<script setup lang="ts">
import type { Tag } from '~/types/api'

const props = defineProps<{ modelValue: string[], tags: Tag[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const { t } = useI18n()
const error = ref('')
const value = computed({
  get: () => props.modelValue,
  set: (next: string[]) => {
    error.value = next.length > 50 ? t('assets.tagsField.maxTags') : ''
    if (!error.value) emit('update:modelValue', next)
  }
})
const items = computed(() => [...new Set([...props.tags.map(tag => tag.name), ...props.modelValue])]
  .sort((left, right) => left.localeCompare(right)))

function create(raw: string) {
  const name = raw.trim()
  if (!name || [...name].length > 100) {
    error.value = t('assets.tagsField.nameLength')
    return
  }
  if (props.modelValue.length >= 50) {
    error.value = t('assets.tagsField.maxTags')
    return
  }
  const existing = items.value.find(item => item.toLocaleLowerCase() === name.toLocaleLowerCase()) || name
  if (!props.modelValue.some(item => item.toLocaleLowerCase() === existing.toLocaleLowerCase())) {
    emit('update:modelValue', [...props.modelValue, existing])
  }
  error.value = ''
}
</script>

<template>
  <UFormField
    :label="t('assets.tagsField.label')"
    :description="t('assets.tagsField.description')"
    :error="error || undefined"
  >
    <UInputMenu
      v-model="value"
      multiple
      create-item
      :items="items"
      :placeholder="t('assets.tagsField.placeholder')"
      :aria-label="t('assets.tagsField.label')"
      class="w-full"
      @create="create"
    />
  </UFormField>
</template>
