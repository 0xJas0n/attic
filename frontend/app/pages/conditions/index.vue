<script setup lang="ts">
import type { Condition } from '~/types/api'

definePageMeta({
  middleware: 'auth'
})

const { t } = useI18n()
const toast = useToast()
const apiFetch = useApiFetch()

const { data: conditions, refresh, status } = useApi<Condition[]>('/api/conditions')

// Search
const searchQuery = ref('')

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Filtered conditions
const filteredConditions = computed(() => {
  if (!conditions.value) return []
  if (!searchQuery.value.trim()) return conditions.value
  const query = searchQuery.value.toLowerCase()
  return conditions.value.filter(
    c => c.label.toLowerCase().includes(query) || c.code.toLowerCase().includes(query)
  )
})

// Paginated conditions
const paginatedConditions = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredConditions.value.slice(start, end)
})

// Total pages
const totalPages = computed(() => Math.ceil(filteredConditions.value.length / itemsPerPage.value))

// Reset to page 1 when search changes
watch(searchQuery, () => {
  currentPage.value = 1
})

watch(totalPages, (pages) => {
  if (currentPage.value > Math.max(1, pages)) currentPage.value = Math.max(1, pages)
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

// Delete confirmation modal
const deleteModalOpen = ref(false)
const conditionToDelete = ref<Condition | null>(null)

function confirmDelete(condition: Condition) {
  conditionToDelete.value = condition
  deleteModalOpen.value = true
}

async function deleteCondition() {
  if (!conditionToDelete.value) return

  try {
    await apiFetch(`/api/conditions/${conditionToDelete.value.id}`, {
      method: 'DELETE'
    })
    toast.add({ title: t('admin.conditions.deleted'), color: 'success' })
    deleteModalOpen.value = false
    conditionToDelete.value = null
    refresh()
  } catch {
    toast.add({ title: t('admin.conditions.deleteFailed'), color: 'error' })
  }
}

// Get style for condition based on label/code
function getConditionStyle(condition: Condition): { icon: string, bgColor: string, textColor: string, badgeBg: string, badgeText: string } {
  const label = condition.label.toLowerCase()
  const code = condition.code.toLowerCase()

  if (label.includes('new') || label.includes('mint') || label.includes('excellent') || code.includes('new')) {
    return {
      icon: 'i-lucide-sparkles',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      badgeText: 'text-emerald-700 dark:text-emerald-300'
    }
  }
  if (label.includes('good') || label.includes('great') || code.includes('good')) {
    return {
      icon: 'i-lucide-thumbs-up',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
      badgeText: 'text-blue-700 dark:text-blue-300'
    }
  }
  if (label.includes('fair') || label.includes('average') || code.includes('fair')) {
    return {
      icon: 'i-lucide-minus',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      textColor: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
      badgeText: 'text-amber-700 dark:text-amber-300'
    }
  }
  if (label.includes('poor') || label.includes('bad') || label.includes('damaged') || code.includes('poor')) {
    return {
      icon: 'i-lucide-alert-triangle',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      textColor: 'text-orange-600 dark:text-orange-400',
      badgeBg: 'bg-orange-100 dark:bg-orange-900/30',
      badgeText: 'text-orange-700 dark:text-orange-300'
    }
  }
  if (label.includes('broken') || label.includes('repair') || label.includes('needs') || code.includes('broken')) {
    return {
      icon: 'i-lucide-wrench',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-600 dark:text-red-400',
      badgeBg: 'bg-red-100 dark:bg-red-900/30',
      badgeText: 'text-red-700 dark:text-red-300'
    }
  }

  // Default style
  return {
    icon: 'i-lucide-circle',
    bgColor: 'bg-slate-50 dark:bg-slate-900/20',
    textColor: 'text-slate-600 dark:text-slate-400',
    badgeBg: 'bg-slate-100 dark:bg-slate-900/30',
    badgeText: 'text-slate-700 dark:text-slate-300'
  }
}
</script>

<template>
  <div class="space-y-5 pb-6">
    <!-- Page Header -->
    <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-attic-500">
          {{ t('admin.conditions.eyebrow') }}
        </p>
        <h1 class="text-2xl font-extrabold tracking-[-0.04em] text-mist-950 dark:text-white md:text-3xl">
          {{ t('admin.conditions.title') }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('admin.conditions.subtitle') }}
        </p>
      </div>
      <UButton
        to="/conditions/new"
        icon="i-lucide-plus"
        class="rounded-xl font-bold shadow-primary"
      >
        {{ t('admin.conditions.newCondition') }}
      </UButton>
    </header>

    <!-- Toolbar -->
    <div class="attic-panel flex flex-col gap-3 rounded-[18px] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div>
        <p class="font-extrabold text-mist-950 dark:text-white">
          {{ t('admin.conditions.scale') }}
        </p>
        <p class="text-xs text-muted">
          {{ t('admin.conditions.levelCount', { count: conditions?.length || 0 }) }}
        </p>
      </div>
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        :placeholder="t('admin.conditions.searchPlaceholder')"
        class="w-full sm:w-64"
        size="lg"
      />
    </div>

    <!-- Data Table -->
    <div class="attic-panel overflow-hidden rounded-[20px]">
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
        v-else-if="!filteredConditions.length && !searchQuery"
        class="flex flex-col items-center justify-center py-20 px-4 text-center"
      >
        <div class="size-16 rounded-full bg-mist-100 dark:bg-mist-700 flex items-center justify-center mb-4">
          <UIcon
            name="i-lucide-heart-pulse"
            class="w-8 h-8 text-muted"
          />
        </div>
        <h3 class="text-lg font-bold text-mist-950 dark:text-white mb-2">
          {{ t('admin.conditions.emptyTitle') }}
        </h3>
        <p class="text-sm text-muted mb-4 max-w-sm">
          {{ t('admin.conditions.emptyBody') }}
        </p>
        <UButton to="/conditions/new">
          {{ t('admin.conditions.create') }}
        </UButton>
      </div>

      <!-- No Results -->
      <div
        v-else-if="!filteredConditions.length && searchQuery"
        class="flex flex-col items-center justify-center py-20 px-4 text-center"
      >
        <UIcon
          name="i-lucide-search-x"
          class="w-12 h-12 text-mist-300 mb-4"
        />
        <h3 class="text-lg font-bold text-mist-950 dark:text-white mb-2">
          {{ t('admin.conditions.noResults') }}
        </h3>
        <p class="text-sm text-muted">
          {{ t('admin.conditions.noMatch', { query: searchQuery }) }}
        </p>
      </div>

      <!-- Table -->
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[600px] border-collapse">
            <thead class="bg-mist-50/50 dark:bg-mist-700/30 border-b border-mist-100 dark:border-mist-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted">
                  {{ t('admin.conditions.colCondition') }}
                </th>
                <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted">
                  {{ t('admin.conditions.colCode') }}
                </th>
                <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted">
                  {{ t('admin.conditions.colDescription') }}
                </th>
                <th class="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-muted">
                  {{ t('admin.conditions.colOrder') }}
                </th>
                <th class="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-muted">
                  {{ t('admin.conditions.colActions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-mist-100 dark:divide-mist-700">
              <tr
                v-for="condition in paginatedConditions"
                :key="condition.id"
                class="group hover:bg-mist-50/50 dark:hover:bg-mist-700/30 transition-colors"
              >
                <!-- Condition Name with Icon -->
                <td class="px-6 py-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="size-9 rounded-full flex items-center justify-center"
                      :class="[getConditionStyle(condition).bgColor, getConditionStyle(condition).textColor]"
                    >
                      <UIcon
                        :name="getConditionStyle(condition).icon"
                        class="w-4 h-4"
                      />
                    </div>
                    <span class="text-mist-950 dark:text-white text-sm font-semibold">
                      {{ condition.label }}
                    </span>
                  </div>
                </td>

                <!-- Code Badge -->
                <td class="px-6 py-4">
                  <code class="text-xs bg-mist-100 dark:bg-mist-700 text-mist-600 dark:text-mist-300 px-2 py-1 rounded font-mono">
                    {{ condition.code }}
                  </code>
                </td>

                <!-- Description -->
                <td class="px-6 py-4">
                  <span
                    v-if="condition.description"
                    class="text-sm text-muted line-clamp-1"
                  >
                    {{ condition.description }}
                  </span>
                  <span
                    v-else
                    class="text-sm text-mist-300 dark:text-mist-600 italic"
                  >
                    {{ t('admin.conditions.noDescription') }}
                  </span>
                </td>

                <!-- Sort Order -->
                <td class="px-6 py-4 text-center">
                  <span
                    class="inline-flex items-center justify-center size-7 rounded-full text-xs font-bold"
                    :class="[getConditionStyle(condition).badgeBg, getConditionStyle(condition).badgeText]"
                  >
                    {{ condition.sort_order }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <NuxtLink
                      :to="`/conditions/${condition.id}/edit`"
                      class="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-attic-500/10 hover:text-attic-500"
                      :title="t('admin.conditions.edit')"
                    >
                      <UIcon
                        name="i-lucide-edit"
                        class="w-4 h-4"
                      />
                    </NuxtLink>
                    <button
                      class="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                      :title="t('admin.conditions.delete')"
                      @click="confirmDelete(condition)"
                    >
                      <UIcon
                        name="i-lucide-trash-2"
                        class="w-4 h-4"
                      />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer with Pagination -->
        <div class="px-6 py-3 border-t border-mist-100 dark:border-mist-700 bg-mist-50/50 dark:bg-mist-700/20 flex items-center justify-between">
          <p class="text-xs text-muted">
            {{ t('admin.conditions.showing', { from: (currentPage - 1) * itemsPerPage + 1, to: Math.min(currentPage * itemsPerPage, filteredConditions.length), total: filteredConditions.length }) }}
            <span v-if="searchQuery && conditions?.length !== filteredConditions.length">
              {{ t('admin.conditions.filteredFrom', { total: conditions?.length || 0 }) }}
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
              {{ t('admin.conditions.prev') }}
            </button>
            <span class="text-xs text-muted px-2">
              {{ t('admin.conditions.page', { page: currentPage, pages: totalPages }) }}
            </span>
            <button
              class="px-3 py-1.5 text-xs font-medium border border-mist-200 dark:border-mist-600 rounded-lg hover:bg-mist-100 dark:hover:bg-mist-700 text-mist-600 dark:text-mist-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              :disabled="currentPage === totalPages"
              @click="nextPage"
            >
              {{ t('admin.conditions.next') }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal
      v-model:open="deleteModalOpen"
      :title="t('admin.conditions.deleteTitle')"
      :description="t('admin.conditions.deleteDescription')"
    >
      <template #content>
        <div class="max-w-md rounded-[20px] bg-white p-6 shadow-xl dark:bg-mist-800">
          <div class="flex items-start gap-4">
            <div class="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <UIcon
                name="i-lucide-alert-triangle"
                class="w-6 h-6 text-red-600 dark:text-red-400"
              />
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-bold text-mist-950 dark:text-white">
                {{ t('admin.conditions.deleteTitle') }}
              </h3>
              <p class="text-sm text-muted mt-2">
                {{ t('admin.conditions.deleteConfirm', { label: conditionToDelete?.label }) }}
              </p>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <UButton
              variant="ghost"
              color="neutral"
              @click="deleteModalOpen = false"
            >
              {{ t('admin.conditions.cancel') }}
            </UButton>
            <UButton
              color="error"
              @click="deleteCondition"
            >
              {{ t('admin.conditions.deleteButton') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
