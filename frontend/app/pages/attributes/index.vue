<script setup lang="ts">
import type { Attribute } from '~/types/api'

definePageMeta({
  middleware: 'auth'
})

const toast = useToast()
const { t } = useI18n()

const { data: attributes, refresh, status } = useApi<Attribute[]>('/api/attributes')

// Search
const searchQuery = ref('')
const selectedType = ref('all')

const dataTypes = computed(() => [
  { value: 'all', label: t('catalog.dataTypes.all'), icon: 'i-lucide-layers-3' },
  { value: 'url', label: t('catalog.dataTypes.url'), icon: 'i-lucide-link' },
  { value: 'date', label: t('catalog.dataTypes.date'), icon: 'i-lucide-calendar' },
  { value: 'text', label: t('catalog.dataTypes.text'), icon: 'i-lucide-align-left' },
  { value: 'number', label: t('catalog.dataTypes.number'), icon: 'i-lucide-hash' },
  { value: 'select', label: t('catalog.dataTypes.select'), icon: 'i-lucide-list-filter' },
  { value: 'string', label: t('catalog.dataTypes.string'), icon: 'i-lucide-type' },
  { value: 'boolean', label: t('catalog.dataTypes.booleanChip'), icon: 'i-lucide-toggle-left' }
])

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Filtered attributes
const filteredAttributes = computed(() => {
  if (!attributes.value) return []
  const query = searchQuery.value.trim().toLowerCase()

  return attributes.value.filter((attribute) => {
    const matchesSearch = !query
      || attribute.name.toLowerCase().includes(query)
      || attribute.key.toLowerCase().includes(query)
    const matchesType = selectedType.value === 'all' || attribute.data_type === selectedType.value
    return matchesSearch && matchesType
  })
})

function getTypeCount(type: string): number {
  if (type === 'all') return attributes.value?.length || 0
  return attributes.value?.filter(attribute => attribute.data_type === type).length || 0
}

// Paginated attributes
const paginatedAttributes = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredAttributes.value.slice(start, end)
})

// Total pages
const totalPages = computed(() => Math.ceil(filteredAttributes.value.length / itemsPerPage.value))

// Reset to page 1 when search changes
watch([searchQuery, selectedType], () => {
  currentPage.value = 1
})

watch(totalPages, (pages) => {
  if (currentPage.value > Math.max(1, pages)) {
    currentPage.value = Math.max(1, pages)
  }
})

// Pagination helpers
function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const { isAdmin } = useAuth()
const impactModal = useTemplateRef('impactModal')
function confirmDelete(attribute: Attribute) {
  impactModal.value?.run({ attributeId: attribute.id, action: 'delete_attribute' }, async () => {
    toast.add({ title: t('catalog.attributes.deleted'), color: 'success' })
    await refresh()
  })
}

// Get style for data type
function getTypeStyle(type: string): { icon: string, bgColor: string, textColor: string, borderColor: string, label: string } {
  switch (type) {
    case 'url':
    case 'string':
      return {
        icon: type === 'url' ? 'i-lucide-link' : 'i-lucide-type',
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        textColor: 'text-slate-700 dark:text-slate-300',
        borderColor: 'border-slate-200 dark:border-slate-700',
        label: type === 'url' ? t('catalog.dataTypes.url') : t('catalog.dataTypes.string')
      }
    case 'text':
      return {
        icon: 'i-lucide-align-left',
        bgColor: 'bg-indigo-50 dark:bg-indigo-900/30',
        textColor: 'text-indigo-700 dark:text-indigo-300',
        borderColor: 'border-indigo-100 dark:border-indigo-900/50',
        label: t('catalog.dataTypes.text')
      }
    case 'number':
      return {
        icon: 'i-lucide-hash',
        bgColor: 'bg-orange-50 dark:bg-orange-900/30',
        textColor: 'text-orange-700 dark:text-orange-300',
        borderColor: 'border-orange-100 dark:border-orange-900/50',
        label: t('catalog.dataTypes.number')
      }
    case 'boolean':
      return {
        icon: 'i-lucide-toggle-left',
        bgColor: 'bg-green-50 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-300',
        borderColor: 'border-green-100 dark:border-green-900/50',
        label: t('catalog.dataTypes.boolean')
      }
    case 'date':
      return {
        icon: 'i-lucide-calendar',
        bgColor: 'bg-purple-50 dark:bg-purple-900/30',
        textColor: 'text-purple-700 dark:text-purple-300',
        borderColor: 'border-purple-100 dark:border-purple-900/50',
        label: t('catalog.dataTypes.date')
      }
    case 'select':
      return {
        icon: 'i-lucide-list-filter',
        bgColor: 'bg-cyan-50 dark:bg-cyan-900/30',
        textColor: 'text-cyan-700 dark:text-cyan-300',
        borderColor: 'border-cyan-100 dark:border-cyan-900/50',
        label: t('catalog.dataTypes.select')
      }
    default:
      return {
        icon: 'i-lucide-circle',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        textColor: 'text-gray-700 dark:text-gray-300',
        borderColor: 'border-gray-200 dark:border-gray-700',
        label: type
      }
  }
}

// Get icon for attribute based on name or type
function getAttributeIcon(attr: Attribute): { icon: string, bgColor: string, textColor: string } {
  const name = attr.name.toLowerCase()

  if (name.includes('isbn') || name.includes('serial') || name.includes('code')) {
    return { icon: 'i-lucide-tag', bgColor: 'bg-blue-50 dark:bg-blue-900/20', textColor: 'text-blue-600 dark:text-blue-400' }
  }
  if (name.includes('weight') || name.includes('dimension') || name.includes('size')) {
    return { icon: 'i-lucide-scale', bgColor: 'bg-orange-50 dark:bg-orange-900/20', textColor: 'text-orange-600 dark:text-orange-400' }
  }
  if (name.includes('insur') || name.includes('verified') || name.includes('warranty')) {
    return { icon: 'i-lucide-shield-check', bgColor: 'bg-green-50 dark:bg-green-900/20', textColor: 'text-green-600 dark:text-green-400' }
  }
  if (name.includes('year') || name.includes('date') || name.includes('purchased')) {
    return { icon: 'i-lucide-calendar', bgColor: 'bg-purple-50 dark:bg-purple-900/20', textColor: 'text-purple-600 dark:text-purple-400' }
  }
  if (name.includes('color') || name.includes('colour')) {
    return { icon: 'i-lucide-palette', bgColor: 'bg-pink-50 dark:bg-pink-900/20', textColor: 'text-pink-600 dark:text-pink-400' }
  }
  if (name.includes('brand') || name.includes('manufacturer')) {
    return { icon: 'i-lucide-building-2', bgColor: 'bg-cyan-50 dark:bg-cyan-900/20', textColor: 'text-cyan-600 dark:text-cyan-400' }
  }
  if (name.includes('model')) {
    return { icon: 'i-lucide-box', bgColor: 'bg-amber-50 dark:bg-amber-900/20', textColor: 'text-amber-600 dark:text-amber-400' }
  }

  // Default based on type
  const typeStyle = getTypeStyle(attr.data_type)
  return { icon: typeStyle.icon, bgColor: typeStyle.bgColor, textColor: typeStyle.textColor }
}
</script>

<template>
  <div class="space-y-5 pb-6">
    <!-- Page Header -->
    <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-attic-500">
          {{ t('catalog.attributes.eyebrow') }}
        </p>
        <h1 class="text-2xl font-extrabold tracking-[-0.04em] text-mist-950 dark:text-white md:text-3xl">
          {{ t('catalog.attributes.title') }}
        </h1>
        <p class="mt-1 max-w-2xl text-sm text-muted">
          {{ t('catalog.attributes.intro') }}
        </p>
      </div>
      <UButton
        v-if="isAdmin"
        to="/attributes/new"
        icon="i-lucide-plus"
        class="rounded-xl font-bold shadow-primary"
      >
        {{ t('catalog.attributes.new') }}
      </UButton>
    </header>

    <section class="attic-panel rounded-[18px] p-3 sm:p-4">
      <div class="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div class="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 2xl:pb-0">
          <button
            v-for="type in dataTypes"
            :key="type.value"
            type="button"
            :aria-pressed="selectedType === type.value"
            class="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors"
            :class="selectedType === type.value
              ? 'bg-attic-500 text-white shadow-sm'
              : 'bg-mist-50 text-muted hover:bg-attic-50 hover:text-attic-600 dark:bg-mist-700/60 dark:text-mist-300'"
            @click="selectedType = type.value"
          >
            <UIcon
              :name="type.icon"
              class="size-3.5"
            />
            {{ type.label }}
            <span
              class="rounded-md px-1.5 py-0.5 text-[10px]"
              :class="selectedType === type.value ? 'bg-white/15 text-white' : 'bg-white text-muted dark:bg-mist-800'"
            >
              {{ getTypeCount(type.value) }}
            </span>
          </button>
        </div>
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          :placeholder="t('catalog.attributes.searchPlaceholder')"
          class="w-full shrink-0 2xl:w-64"
          size="lg"
        />
      </div>
    </section>

    <!-- Data Table -->
    <section class="attic-panel overflow-hidden rounded-[20px]">
      <div class="flex items-center justify-between border-b border-mist-100 px-4 py-4 dark:border-mist-700 sm:px-5">
        <div>
          <h2 class="font-extrabold text-mist-950 dark:text-white">
            {{ t('catalog.attributes.library') }}
          </h2>
          <p class="text-xs text-muted">
            {{ t('catalog.attributes.libraryHint') }}
          </p>
        </div>
        <span class="rounded-lg bg-mist-50 px-2.5 py-1 text-xs font-bold text-muted dark:bg-mist-700/60">
          {{ t('catalog.attributes.shown', { count: filteredAttributes.length }) }}
        </span>
      </div>
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

      <!-- Empty State -->
      <div
        v-else-if="!attributes?.length"
        class="flex flex-col items-center justify-center py-20 px-4 text-center"
      >
        <div class="size-16 rounded-full bg-mist-100 dark:bg-mist-700 flex items-center justify-center mb-4">
          <UIcon
            name="i-lucide-list"
            class="w-8 h-8 text-muted"
          />
        </div>
        <h3 class="text-lg font-bold text-mist-950 dark:text-white mb-2">
          {{ t('catalog.attributes.emptyTitle') }}
        </h3>
        <p class="text-sm text-muted mb-4 max-w-sm">
          {{ t('catalog.attributes.emptyBody') }}
        </p>
        <UButton
          v-if="isAdmin"
          to="/attributes/new"
        >
          {{ t('catalog.attributes.create') }}
        </UButton>
      </div>

      <!-- No Results -->
      <div
        v-else-if="!filteredAttributes.length"
        class="flex flex-col items-center justify-center py-20 px-4 text-center"
      >
        <UIcon
          name="i-lucide-search-x"
          class="w-12 h-12 text-mist-300 mb-4"
        />
        <h3 class="text-lg font-bold text-mist-950 dark:text-white mb-2">
          {{ t('catalog.attributes.noResults') }}
        </h3>
        <p class="text-sm text-muted">
          {{ t('catalog.attributes.noResultsBody') }}
        </p>
        <button
          type="button"
          class="mt-2 text-sm font-semibold text-attic-500 hover:text-attic-600"
          @click="searchQuery = ''; selectedType = 'all'"
        >
          {{ t('catalog.attributes.clearFilters') }}
        </button>
      </div>

      <template v-else>
        <div class="divide-y divide-mist-100 dark:divide-mist-700">
          <article
            v-for="attr in paginatedAttributes"
            :key="attr.id"
            class="grid gap-3 px-4 py-4 transition-colors hover:bg-mist-50/60 dark:hover:bg-mist-700/20 sm:grid-cols-[minmax(0,1.25fr)_minmax(150px,.7fr)_8rem] sm:items-center sm:px-5"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="flex size-10 shrink-0 items-center justify-center rounded-xl"
                :class="[getAttributeIcon(attr).bgColor, getAttributeIcon(attr).textColor]"
              >
                <UIcon
                  :name="getAttributeIcon(attr).icon"
                  class="size-4.5"
                />
              </div>
              <div class="min-w-0">
                <h3 class="truncate text-sm font-extrabold text-mist-950 dark:text-white">
                  {{ attr.name }}
                </h3>
                <code class="mt-0.5 block truncate font-mono text-xs text-muted">
                  {{ attr.key }}
                </code>
              </div>
            </div>

            <div class="flex items-center justify-between gap-3 pl-[52px] sm:justify-start sm:pl-0">
              <span
                class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold"
                :class="[getTypeStyle(attr.data_type).bgColor, getTypeStyle(attr.data_type).textColor, getTypeStyle(attr.data_type).borderColor]"
              >
                <UIcon
                  :name="getTypeStyle(attr.data_type).icon"
                  class="size-3.5"
                />
                {{ getTypeStyle(attr.data_type).label }}
              </span>
            </div>

            <div class="flex items-center justify-end gap-1 border-t border-mist-100 pt-3 dark:border-mist-700 sm:border-0 sm:pt-0">
              <UButton
                v-if="isAdmin && !attr.plugin_id"
                :to="`/attributes/${attr.id}/edit`"
                variant="soft"
                size="sm"
                icon="i-lucide-pencil"
              >
                {{ t('catalog.attributes.edit') }}
              </UButton>
              <button
                v-if="isAdmin && !attr.plugin_id"
                type="button"
                class="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                :aria-label="t('catalog.attributes.deleteAria', { name: attr.name })"
                @click="confirmDelete(attr)"
              >
                <UIcon
                  name="i-lucide-trash-2"
                  class="size-4"
                />
              </button>
            </div>
          </article>
        </div>

        <!-- Footer with Pagination -->
        <div class="flex flex-col gap-3 border-t border-mist-100 bg-mist-50/50 px-4 py-3 dark:border-mist-700 dark:bg-mist-700/20 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p class="text-xs text-muted">
            {{ t('catalog.attributes.showing', { from: (currentPage - 1) * itemsPerPage + 1, to: Math.min(currentPage * itemsPerPage, filteredAttributes.length), total: filteredAttributes.length }) }}
            <span v-if="searchQuery && attributes?.length !== filteredAttributes.length">
              {{ t('catalog.attributes.filteredFrom', { total: attributes?.length || 0 }) }}
            </span>
          </p>
          <div
            v-if="totalPages > 1"
            class="flex items-center gap-2"
          >
            <button
              class="px-3 py-1.5 text-xs font-medium border border-mist-200 dark:border-mist-600 rounded-lg hover:bg-mist-100 dark:hover:bg-mist-700 text-mist-600 dark:text-mist-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              :disabled="currentPage === 1"
              @click="prevPage"
            >
              {{ t('catalog.attributes.prev') }}
            </button>
            <span class="text-xs text-muted px-2">
              {{ t('catalog.attributes.page', { page: currentPage, pages: totalPages }) }}
            </span>
            <button
              class="px-3 py-1.5 text-xs font-medium border border-mist-200 dark:border-mist-600 rounded-lg hover:bg-mist-100 dark:hover:bg-mist-700 text-mist-600 dark:text-mist-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              :disabled="currentPage === totalPages"
              @click="nextPage"
            >
              {{ t('catalog.attributes.next') }}
            </button>
          </div>
        </div>
      </template>
    </section>

    <AttributeImpactModal ref="impactModal" />
  </div>
</template>
