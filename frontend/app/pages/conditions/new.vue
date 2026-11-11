<script setup lang="ts">
import type { Condition } from '~/types/api'

definePageMeta({
  middleware: 'auth'
})

const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const apiFetch = useApiFetch()

// Get existing conditions to determine next sort order
const { data: conditions } = useApi<Condition[]>('/api/conditions')

// Form state
const form = reactive({
  label: '',
  code: '',
  description: '',
  sort_order: 1
})

// Auto-generate code from label
const isCodeManuallyEdited = ref(false)

function generateCode(label: string): string {
  return label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

watch(() => form.label, (newLabel) => {
  if (!isCodeManuallyEdited.value) {
    form.code = generateCode(newLabel)
  }
})

function onCodeInput() {
  isCodeManuallyEdited.value = true
}

// Set default sort order when conditions load
watch(conditions, (items) => {
  if (items && items.length > 0) {
    form.sort_order = Math.max(...items.map(c => c.sort_order)) + 1
  }
}, { immediate: true })

// Saving state
const saving = ref(false)

// Character count for description
const descriptionCount = computed(() => form.description.length)

// Preset conditions for quick selection
const presets = computed(() => [
  { label: t('admin.conditions.presets.new'), code: 'NEW', icon: 'i-lucide-sparkles', color: 'emerald' },
  { label: t('admin.conditions.presets.likeNew'), code: 'LIKE_NEW', icon: 'i-lucide-star', color: 'teal' },
  { label: t('admin.conditions.presets.good'), code: 'GOOD', icon: 'i-lucide-thumbs-up', color: 'blue' },
  { label: t('admin.conditions.presets.fair'), code: 'FAIR', icon: 'i-lucide-minus', color: 'amber' },
  { label: t('admin.conditions.presets.poor'), code: 'POOR', icon: 'i-lucide-alert-triangle', color: 'orange' },
  { label: t('admin.conditions.presets.forParts'), code: 'FOR_PARTS', icon: 'i-lucide-wrench', color: 'red' }
])

function applyPreset(preset: (typeof presets.value)[number]) {
  form.label = preset.label
  form.code = preset.code
  isCodeManuallyEdited.value = true
}

// Save condition
async function saveCondition() {
  if (!form.label.trim()) {
    toast.add({ title: t('admin.conditions.labelRequired'), color: 'error' })
    return
  }
  if (!form.code.trim()) {
    toast.add({ title: t('admin.conditions.codeRequired'), color: 'error' })
    return
  }

  saving.value = true
  try {
    await apiFetch('/api/conditions', {
      method: 'POST',
      body: JSON.stringify({
        label: form.label,
        code: form.code,
        description: form.description || null,
        sort_order: form.sort_order
      })
    })

    toast.add({ title: t('admin.conditions.created'), color: 'success' })
    router.push('/conditions')
  } catch {
    toast.add({ title: t('admin.conditions.createFailed'), color: 'error' })
  } finally {
    saving.value = false
  }
}

// Cancel and go back
function cancel() {
  router.push('/conditions')
}
</script>

<template>
  <div class="mx-auto max-w-[900px] space-y-5 pb-6">
    <!-- Breadcrumbs & Header -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div class="space-y-3">
        <nav class="flex items-center text-xs font-semibold text-muted">
          <NuxtLink
            to="/"
            class="hover:text-attic-500 transition-colors"
          >
            {{ t('admin.conditions.home') }}
          </NuxtLink>
          <span class="mx-2 text-mist-300 dark:text-mist-600">/</span>
          <NuxtLink
            to="/conditions"
            class="hover:text-attic-500 transition-colors"
          >
            {{ t('admin.conditions.title') }}
          </NuxtLink>
          <span class="mx-2 text-mist-300 dark:text-mist-600">/</span>
          <span class="font-bold text-attic-500">{{ t('admin.conditions.crumbNew') }}</span>
        </nav>
        <div>
          <p class="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-attic-500">
            {{ t('admin.conditions.editor') }}
          </p>
          <h1 class="text-2xl font-extrabold tracking-[-0.04em] text-mist-950 dark:text-white md:text-3xl">
            {{ t('admin.conditions.newTitle') }}
          </h1>
          <p class="mt-1 text-sm text-muted">
            {{ t('admin.conditions.newSubtitle') }}
          </p>
        </div>
      </div>
      <div class="hidden items-center gap-2 sm:flex">
        <UButton
          variant="ghost"
          color="neutral"
          class="rounded-xl font-semibold"
          @click="cancel"
        >
          {{ t('admin.conditions.cancel') }}
        </UButton>
        <UButton
          icon="i-lucide-save"
          :loading="saving"
          class="rounded-xl font-bold shadow-primary"
          @click="saveCondition"
        >
          {{ t('admin.conditions.saveCondition') }}
        </UButton>
      </div>
    </div>

    <!-- Form Card -->
    <div class="space-y-5">
      <!-- Quick Presets -->
      <section class="attic-panel rounded-[20px] p-5 sm:p-6">
        <div class="mb-4 flex items-start gap-3">
          <div class="flex size-9 items-center justify-center rounded-xl bg-terracotta-50 text-terracotta-500 dark:bg-terracotta-500/10">
            <UIcon
              name="i-lucide-wand-sparkles"
              class="size-4.5"
            />
          </div>
          <div>
            <h2 class="font-extrabold text-mist-950 dark:text-white">
              {{ t('admin.conditions.quickStart') }}
            </h2><p class="text-xs text-muted">
              {{ t('admin.conditions.quickStartHint') }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="preset in presets"
            :key="preset.code"
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-all"
            :class="form.code === preset.code
              ? 'border-attic-500 bg-attic-50 text-attic-600 ring-2 ring-attic-500/10 dark:bg-attic-500/10 dark:text-attic-300'
              : 'border-mist-200 bg-mist-50 text-mist-600 hover:border-attic-300 hover:bg-attic-50/50 dark:border-mist-600 dark:bg-mist-800 dark:text-mist-400'"
            @click="applyPreset(preset)"
          >
            <UIcon
              :name="preset.icon"
              class="w-4 h-4"
            />
            {{ preset.label }}
          </button>
        </div>
      </section>

      <section class="attic-panel rounded-[20px] p-5 sm:p-6">
        <div class="mb-5 flex items-start gap-3">
          <div class="flex size-9 items-center justify-center rounded-xl bg-attic-50 text-attic-500 dark:bg-attic-500/10">
            <UIcon
              name="i-lucide-sliders-horizontal"
              class="size-4.5"
            />
          </div><div>
            <h2 class="font-extrabold text-mist-950 dark:text-white">
              {{ t('admin.conditions.details') }}
            </h2><p class="text-xs text-muted">
              {{ t('admin.conditions.detailsHint') }}
            </p>
          </div>
        </div>
        <div class="max-w-3xl space-y-5">
          <!-- Label Field -->
          <div>
            <label class="block text-sm font-semibold text-mist-700 dark:text-mist-300 mb-2">
              {{ t('admin.conditions.label') }}
            </label>
            <input
              v-model="form.label"
              type="text"
              :placeholder="t('admin.conditions.labelPlaceholder')"
              class="w-full px-4 py-3 rounded-lg bg-mist-50 dark:bg-mist-900 border border-mist-200 dark:border-mist-600 focus:border-attic-500 focus:ring-1 focus:ring-attic-500 outline-none transition-all placeholder:text-dimmed font-medium text-mist-950 dark:text-white"
            >
            <p class="text-xs text-muted mt-1">
              {{ t('admin.conditions.labelHint') }}
            </p>
          </div>

          <!-- Code Field -->
          <div>
            <label class="block text-sm font-semibold text-mist-700 dark:text-mist-300 mb-2">
              {{ t('admin.conditions.code') }}
            </label>
            <input
              v-model="form.code"
              type="text"
              placeholder="e.g. LIKE_NEW"
              class="w-full px-4 py-3 rounded-lg bg-mist-50 dark:bg-mist-900 border border-mist-200 dark:border-mist-600 focus:border-attic-500 focus:ring-1 focus:ring-attic-500 outline-none transition-all placeholder:text-dimmed font-mono text-sm text-mist-950 dark:text-white uppercase"
              @input="onCodeInput"
            >
            <p class="text-xs text-muted mt-1">
              {{ t('admin.conditions.codeHint') }}
            </p>
          </div>

          <!-- Description Field -->
          <div>
            <label class="block text-sm font-semibold text-mist-700 dark:text-mist-300 mb-2">
              {{ t('admin.conditions.description') }}
              <span class="font-normal text-muted">{{ t('admin.conditions.optional') }}</span>
            </label>
            <textarea
              v-model="form.description"
              rows="3"
              maxlength="200"
              :placeholder="t('admin.conditions.descriptionPlaceholder')"
              class="w-full px-4 py-3 rounded-lg bg-mist-50 dark:bg-mist-900 border border-mist-200 dark:border-mist-600 focus:border-attic-500 focus:ring-1 focus:ring-attic-500 outline-none transition-all placeholder:text-dimmed text-sm resize-none text-mist-950 dark:text-white"
            />
            <div class="flex justify-end mt-1">
              <span class="text-xs text-muted">{{ descriptionCount }}/200</span>
            </div>
          </div>

          <!-- Sort Order Field -->
          <div>
            <label class="block text-sm font-semibold text-mist-700 dark:text-mist-300 mb-2">
              {{ t('admin.conditions.sortOrder') }}
            </label>
            <input
              v-model.number="form.sort_order"
              type="number"
              min="1"
              class="w-32 px-4 py-3 rounded-lg bg-mist-50 dark:bg-mist-900 border border-mist-200 dark:border-mist-600 focus:border-attic-500 focus:ring-1 focus:ring-attic-500 outline-none transition-all text-sm text-mist-950 dark:text-white"
            >
            <p class="text-xs text-muted mt-1">
              {{ t('admin.conditions.sortOrderHint') }}
            </p>
          </div>
        </div>
      </section>

      <!-- Info Box -->
      <div class="rounded-[18px] border border-attic-200 bg-attic-50 p-4 dark:border-attic-800/50 dark:bg-attic-900/20">
        <div class="flex gap-3">
          <UIcon
            name="i-lucide-lightbulb"
            class="w-5 h-5 text-attic-500 shrink-0 mt-0.5"
          />
          <div>
            <p class="text-sm font-semibold text-attic-700 dark:text-attic-300">
              {{ t('admin.conditions.tipTitle') }}
            </p>
            <p class="text-sm text-attic-600 dark:text-attic-400 mt-1">
              {{ t('admin.conditions.tipBody') }}
            </p>
          </div>
        </div>
      </div>

      <div class="attic-panel flex items-center justify-end gap-2 rounded-[18px] px-4 py-3">
        <UButton
          variant="ghost"
          color="neutral"
          @click="cancel"
        >
          {{ t('admin.conditions.cancel') }}
        </UButton>
        <UButton
          icon="i-lucide-save"
          :loading="saving"
          class="rounded-xl shadow-primary"
          @click="saveCondition"
        >
          {{ t('admin.conditions.saveConditionLower') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
