<script setup lang="ts">
import type { Attribute, AttributeOptionDraft } from '~/types/api'
import { attributeOptionPayload, createAttributeOptionDrafts } from '~/utils/attributeOptions'

definePageMeta({
  middleware: ['auth', 'admin']
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const attributeId = computed(() => route.params.id as string)

// Fetch existing attribute
const { data: attribute, status } = useApi<Attribute>(`/api/attributes/${attributeId.value}`)

// Form state
const form = reactive({
  name: '',
  key: '',
  data_type: 'string',
  selection_mode: 'single' as 'single' | 'multiple',
  options: [] as AttributeOptionDraft[]
})

// Populate form when attribute loads
watch(attribute, (attr) => {
  if (attr) {
    form.name = attr.name
    form.key = attr.key
    form.data_type = attr.data_type
    form.selection_mode = attr.selection_mode || 'single'
    form.options = createAttributeOptionDrafts(attr.options || [])
  }
}, { immediate: true })

// Data types available
const dataTypes = computed(() => [
  { value: 'url', label: t('catalog.attributeForm.typeUrl'), icon: 'i-lucide-link', description: t('catalog.attributeForm.typeUrlDesc') },
  { value: 'select', label: t('catalog.attributeForm.typeSelect'), icon: 'i-lucide-list-filter', description: t('catalog.attributeForm.typeSelectDesc') },
  { value: 'string', label: t('catalog.attributeForm.typeString'), icon: 'i-lucide-type', description: t('catalog.attributeForm.typeStringDesc') },
  { value: 'text', label: t('catalog.attributeForm.typeText'), icon: 'i-lucide-align-left', description: t('catalog.attributeForm.typeTextDesc') },
  { value: 'number', label: t('catalog.attributeForm.typeNumber'), icon: 'i-lucide-hash', description: t('catalog.attributeForm.typeNumberDesc') },
  { value: 'boolean', label: t('catalog.attributeForm.typeBoolean'), icon: 'i-lucide-toggle-left', description: t('catalog.attributeForm.typeBooleanDesc') },
  { value: 'date', label: t('catalog.attributeForm.typeDate'), icon: 'i-lucide-calendar', description: t('catalog.attributeForm.typeDateDesc') }
])

// Saving state
const saving = ref(false)
const impactModal = useTemplateRef('impactModal')

// Get style for selected type
function getTypeStyle(type: string): { bgColor: string, textColor: string, borderColor: string } {
  switch (type) {
    case 'url':
    case 'string':
      return {
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        textColor: 'text-slate-700 dark:text-slate-300',
        borderColor: 'border-slate-200 dark:border-slate-700'
      }
    case 'text':
      return {
        bgColor: 'bg-indigo-50 dark:bg-indigo-900/30',
        textColor: 'text-indigo-700 dark:text-indigo-300',
        borderColor: 'border-indigo-200 dark:border-indigo-900/50'
      }
    case 'number':
      return {
        bgColor: 'bg-orange-50 dark:bg-orange-900/30',
        textColor: 'text-orange-700 dark:text-orange-300',
        borderColor: 'border-orange-200 dark:border-orange-900/50'
      }
    case 'boolean':
      return {
        bgColor: 'bg-green-50 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-300',
        borderColor: 'border-green-200 dark:border-green-900/50'
      }
    case 'date':
      return {
        bgColor: 'bg-purple-50 dark:bg-purple-900/30',
        textColor: 'text-purple-700 dark:text-purple-300',
        borderColor: 'border-purple-200 dark:border-purple-900/50'
      }
    default:
      return {
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        textColor: 'text-gray-700 dark:text-gray-300',
        borderColor: 'border-gray-200 dark:border-gray-700'
      }
  }
}

// Save attribute
async function saveAttribute() {
  if (!form.name.trim()) {
    toast.add({ title: t('catalog.attributeForm.nameRequired'), color: 'error' })
    return
  }
  if (!form.key.trim()) {
    toast.add({ title: t('catalog.attributeForm.keyRequired'), color: 'error' })
    return
  }

  saving.value = true
  try {
    const deletedOptionCount = (attribute.value?.options || []).filter(option => !form.options.some(draft => draft.id === option.id)).length
    await impactModal.value?.run({ attributeId: attributeId.value, action: 'update_attribute', changes: {
      name: form.name,
      key: form.key,
      data_type: form.data_type,
      ...(form.data_type === 'select' ? { selection_mode: form.selection_mode, options: attributeOptionPayload(form.options) } : {})
    }, deletedOptionCount
    }, async () => {
      toast.add({ title: t('catalog.attributeForm.updated'), color: 'success' })
      await router.push('/attributes')
    })
  } catch {
    toast.add({ title: t('catalog.attributeForm.updateFailed'), color: 'error' })
  } finally {
    saving.value = false
  }
}

// Cancel and go back
function cancel() {
  router.push('/attributes')
}
</script>

<template>
  <div class="space-y-8">
    <!-- Loading State -->
    <div
      v-if="status === 'pending'"
      class="flex items-center justify-center py-20"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 text-attic-500 animate-spin"
      />
    </div>

    <!-- Error State -->
    <div
      v-else-if="status === 'error'"
      class="flex flex-col items-center justify-center py-20"
    >
      <UIcon
        name="i-lucide-alert-circle"
        class="w-12 h-12 text-red-500 mb-4"
      />
      <h2 class="text-lg font-bold text-mist-950 dark:text-white mb-2">
        {{ t('catalog.attributeForm.notFound') }}
      </h2>
      <p class="text-muted mb-4">
        {{ t('catalog.attributeForm.notFoundBody') }}
      </p>
      <UButton
        to="/attributes"
        variant="ghost"
      >
        {{ t('catalog.attributeForm.back') }}
      </UButton>
    </div>

    <!-- Form Content -->
    <template v-else>
      <!-- Breadcrumbs & Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex flex-col gap-2">
          <nav class="flex items-center text-sm font-medium text-muted">
            <NuxtLink
              to="/"
              class="hover:text-attic-500 transition-colors"
            >
              {{ t('catalog.shared.home') }}
            </NuxtLink>
            <span class="mx-2 text-mist-300 dark:text-mist-600">/</span>
            <NuxtLink
              to="/attributes"
              class="hover:text-attic-500 transition-colors"
            >
              {{ t('shell.nav.attributes') }}
            </NuxtLink>
            <span class="mx-2 text-mist-300 dark:text-mist-600">/</span>
            <span class="text-mist-950 dark:text-white">{{ t('catalog.attributeForm.crumbEdit') }}</span>
          </nav>
          <div>
            <h1 class="text-3xl font-extrabold tracking-tight text-mist-950 dark:text-white">
              {{ t('catalog.attributeForm.editTitle') }}
            </h1>
            <p class="text-muted mt-1">
              {{ t('catalog.attributeForm.editIntro', { name: attribute?.name }) }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <UButton
            variant="ghost"
            color="neutral"
            @click="cancel"
          >
            {{ t('catalog.shared.cancel') }}
          </UButton>
          <UButton
            icon="i-lucide-save"
            :loading="saving"
            @click="saveAttribute"
          >
            {{ t('catalog.attributeForm.saveChanges') }}
          </UButton>
        </div>
      </div>

      <!-- Form Card -->
      <div class="max-w-2xl">
        <div class="bg-white dark:bg-mist-800 rounded-xl shadow-soft border border-mist-100 dark:border-mist-700 p-6">
          <div class="space-y-6">
            <!-- Name Field -->
            <div>
              <label class="block text-sm font-semibold text-mist-700 dark:text-mist-300 mb-2">
                {{ t('catalog.attributeForm.name') }}
              </label>
              <input
                v-model="form.name"
                type="text"
                :placeholder="t('catalog.attributeForm.namePlaceholder')"
                class="w-full px-4 py-3 rounded-lg bg-mist-50 dark:bg-mist-900 border border-mist-200 dark:border-mist-600 focus:border-attic-500 focus:ring-1 focus:ring-attic-500 outline-none transition-all placeholder:text-dimmed font-medium text-mist-950 dark:text-white"
              >
              <p class="text-xs text-muted mt-1">
                {{ t('catalog.attributeForm.nameHint') }}
              </p>
            </div>

            <!-- Key Field -->
            <div>
              <label class="block text-sm font-semibold text-mist-700 dark:text-mist-300 mb-2">
                {{ t('catalog.attributeForm.key') }}
              </label>
              <input
                v-model="form.key"
                type="text"
                :placeholder="t('catalog.attributeForm.keyPlaceholder')"
                class="w-full px-4 py-3 rounded-lg bg-mist-50 dark:bg-mist-900 border border-mist-200 dark:border-mist-600 focus:border-attic-500 focus:ring-1 focus:ring-attic-500 outline-none transition-all placeholder:text-dimmed font-mono text-sm text-mist-950 dark:text-white"
              >
              <p class="text-xs text-muted mt-1">
                {{ t('catalog.attributeForm.keyHintEdit') }}
              </p>
            </div>

            <div
              v-if="form.data_type === 'select'"
              class="space-y-4"
            >
              <label
                for="selection-mode"
                class="block font-semibold text-mist-950 dark:text-white"
              >{{ t('catalog.attributeForm.selectionMode') }}</label>
              <select
                id="selection-mode"
                v-model="form.selection_mode"
                class="rounded-lg border border-default bg-default p-2 text-mist-950 dark:text-white"
              >
                <option value="single">
                  {{ t('catalog.attributeForm.single') }}
                </option>
                <option value="multiple">
                  {{ t('catalog.attributeForm.multiple') }}
                </option>
              </select>
              <AttributeOptionsEditor
                v-model="form.options"
              />
            </div>
            <!-- Data Type Field -->
            <div>
              <label class="block text-sm font-semibold text-mist-700 dark:text-mist-300 mb-3">
                {{ t('catalog.attributeForm.dataType') }}
              </label>
              <div
                class="grid grid-cols-1 sm:grid-cols-2 gap-3"
                role="radiogroup"
                :aria-label="t('catalog.attributeForm.dataTypeAria')"
              >
                <button
                  v-for="type in dataTypes"
                  :key="type.value"
                  type="button"
                  role="radio"
                  :aria-label="`${type.label}: ${type.description}`"
                  :aria-checked="form.data_type === type.value"
                  class="flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left"
                  :class="form.data_type === type.value
                    ? [getTypeStyle(type.value).bgColor, getTypeStyle(type.value).borderColor, 'ring-2 ring-offset-2', `ring-${type.value === 'string' ? 'slate' : type.value === 'text' ? 'indigo' : type.value === 'number' ? 'orange' : type.value === 'boolean' ? 'green' : 'purple'}-500/50`]
                    : 'border-mist-200 dark:border-mist-600 hover:border-mist-300 dark:hover:border-mist-500 bg-white dark:bg-mist-900'"
                  @click="form.data_type = type.value"
                >
                  <div
                    class="size-10 rounded-lg flex items-center justify-center shrink-0"
                    :class="form.data_type === type.value
                      ? [getTypeStyle(type.value).textColor]
                      : 'bg-mist-100 dark:bg-mist-700 text-muted'"
                  >
                    <UIcon
                      :name="type.icon"
                      class="w-5 h-5"
                    />
                  </div>
                  <div>
                    <p
                      class="font-bold text-sm"
                      :class="form.data_type === type.value ? getTypeStyle(type.value).textColor : 'text-mist-950 dark:text-white'"
                    >
                      {{ type.label }}
                    </p>
                    <p class="text-xs text-muted mt-0.5">
                      {{ type.description }}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Warning Box -->
        <div class="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
          <div class="flex gap-3">
            <UIcon
              name="i-lucide-alert-triangle"
              class="w-5 h-5 text-amber-500 shrink-0 mt-0.5"
            />
            <div>
              <p class="text-sm font-semibold text-amber-700 dark:text-amber-300">
                {{ t('catalog.attributeForm.cautionTitle') }}
              </p>
              <p class="text-sm text-amber-600 dark:text-amber-400 mt-1">
                {{ t('catalog.attributeForm.cautionBody') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
    <AttributeImpactModal ref="impactModal" />
  </div>
</template>
