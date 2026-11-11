<script setup lang="ts">
import type { Collection } from '~/types/api'

definePageMeta({ middleware: 'auth' })
const { data: collections, status, error, refresh } = useApi<Collection[]>('/api/collections')
const apiFetch = useApiFetch()
const toast = useToast()
const { t } = useI18n()
const search = ref('')
const filteredCollections = computed(() => {
  const query = search.value.trim().toLowerCase()
  return (collections.value || []).filter(collection =>
    collection.name.toLowerCase().includes(query) || collection.description?.toLowerCase().includes(query)
  )
})
const summary = computed(() => {
  const items = collections.value || []
  const withAssets = items.filter(collection => collection.asset_count > 0).length
  const ready = status.value === 'success' && !error.value
  return [
    { label: t('catalog.collections.title'), value: ready ? items.length : '—' },
    { label: t('catalog.collections.withAssets'), value: ready ? withAssets : '—' },
    { label: t('catalog.collections.empty'), value: ready ? items.length - withAssets : '—' }
  ]
})
const editorOpen = ref(false)
const deleting = ref<Collection | null>(null)
const deleteOpen = computed({
  get: () => deleting.value !== null,
  set: (value) => {
    if (!value) deleting.value = null
  }
})
const editing = ref<string | null>(null)
const busy = ref(false)
const formError = ref('')
const form = reactive({ name: '', description: '', icon: 'i-lucide-library' })

function errorMessage(err: unknown, fallback: string) {
  const response = err as { data?: { error?: string } }
  return response?.data?.error || fallback
}

function edit(collection?: Collection) {
  editing.value = collection?.id || null
  Object.assign(form, { name: collection?.name || '', description: collection?.description || '', icon: collection?.icon || 'i-lucide-library' })
  formError.value = ''
  editorOpen.value = true
}

async function save() {
  if (busy.value || !form.name.trim()) return
  busy.value = true
  formError.value = ''
  try {
    await apiFetch(editing.value ? `/api/collections/${editing.value}` : '/api/collections', {
      method: editing.value ? 'PUT' : 'POST',
      body: JSON.stringify({ ...form, name: form.name.trim(), description: form.description.trim() })
    })
    editorOpen.value = false
    toast.add({ title: editing.value ? t('catalog.collections.updated') : t('catalog.collections.created'), color: 'success' })
    await refresh()
  } catch (err) {
    formError.value = errorMessage(err, t('catalog.collections.saveFailed'))
  } finally { busy.value = false }
}

async function remove() {
  if (!deleting.value || busy.value) return
  busy.value = true
  formError.value = ''
  try {
    await apiFetch(`/api/collections/${deleting.value.id}`, { method: 'DELETE' })
    deleting.value = null
    toast.add({ title: t('catalog.collections.deleted'), color: 'success' })
    await refresh()
  } catch (err) {
    formError.value = errorMessage(err, t('catalog.collections.deleteFailed'))
  } finally { busy.value = false }
}
</script>

<template>
  <div class="space-y-6 pb-6">
    <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-attic-500">
          {{ t('catalog.collections.eyebrow') }}
        </p>
        <h1 class="text-2xl font-extrabold tracking-[-0.04em] text-mist-950 dark:text-white md:text-3xl">
          {{ t('catalog.collections.title') }}
        </h1>
        <p class="mt-1 max-w-2xl text-sm text-muted">
          {{ t('catalog.collections.intro') }}
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        class="shrink-0 rounded-xl font-bold shadow-primary"
        @click="edit()"
      >
        {{ t('catalog.collections.new') }}
      </UButton>
    </header>
    <LibrarySummary :items="summary" />
    <LibraryToolbar
      v-model="search"
      :title="t('catalog.collections.library')"
      :placeholder="t('catalog.collections.search')"
      :count="filteredCollections.length"
      :total="collections?.length || 0"
    />
    <div
      v-if="status === 'pending'"
      role="status"
      class="py-12 text-center text-muted"
    >
      {{ t('catalog.collections.loading') }}
    </div>
    <div
      v-else-if="error"
      role="alert"
      class="attic-panel rounded-2xl p-8 text-center"
    >
      <p>{{ t('catalog.collections.loadError') }}</p>
      <UButton
        class="mt-3"
        @click="refresh()"
      >
        {{ t('common.tryAgain') }}
      </UButton>
    </div>
    <div
      v-else-if="!collections?.length"
      class="attic-panel rounded-2xl px-6 py-16 text-center"
    >
      <UIcon
        name="i-lucide-library"
        class="size-12 text-attic-500"
      />
      <h2 class="mt-4 text-xl font-bold">
        {{ t('catalog.collections.emptyTitle') }}
      </h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-muted">
        {{ t('catalog.collections.emptyBody') }}
      </p>
      <UButton
        class="mt-5"
        icon="i-lucide-plus"
        @click="edit()"
      >
        {{ t('catalog.collections.createFirst') }}
      </UButton>
    </div>
    <div
      v-else-if="!filteredCollections.length"
      class="attic-panel rounded-2xl px-6 py-14 text-center"
    >
      <UIcon
        name="i-lucide-search-x"
        class="mx-auto mb-3 size-7 text-mist-300"
      />
      <p class="font-bold text-mist-700 dark:text-mist-200">
        {{ t('catalog.collections.noMatch') }}
      </p>
      <UButton
        variant="ghost"
        class="mt-2"
        @click="search = ''"
      >
        {{ t('catalog.shared.clearSearch') }}
      </UButton>
    </div>
    <div
      v-else
      class="attic-panel overflow-hidden rounded-[20px]"
    >
      <div class="hidden grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)_auto] gap-4 border-b border-mist-100 bg-mist-50/70 px-5 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted dark:border-mist-700 dark:bg-mist-800/70 sm:grid">
        <span>{{ t('catalog.collections.colCollection') }}</span>
        <span>{{ t('catalog.shared.description') }}</span>
        <span class="pr-2 text-right">{{ t('catalog.shared.actions') }}</span>
      </div>
      <div
        role="list"
        class="divide-y divide-mist-100 dark:divide-mist-700"
      >
        <LibraryCard
          v-for="collection in filteredCollections"
          :key="collection.id"
          :name="collection.name"
          :description="collection.description"
          :icon="collection.icon || 'i-lucide-library'"
          :asset-count="collection.asset_count"
          :assets-to="'/assets?collection_id=' + encodeURIComponent(collection.id)"
          @edit="edit(collection)"
          @delete="formError = ''; deleting = collection"
        />
      </div>
    </div>
    <UModal
      v-model:open="editorOpen"
      :title="editing ? t('catalog.collections.edit') : t('catalog.collections.new')"
      :description="t('catalog.collections.editorHint')"
      :dismissible="!busy"
    >
      <template #body>
        <form
          class="space-y-5"
          @submit.prevent="save"
        >
          <UFormField
            :label="t('catalog.shared.name')"
            required
          >
            <UInput
              v-model="form.name"
              required
              maxlength="255"
              :placeholder="t('catalog.collections.namePlaceholder')"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField :label="t('catalog.shared.description')">
            <UTextarea
              v-model="form.description"
              maxlength="2000"
              :placeholder="t('catalog.collections.descriptionPlaceholder')"
              class="w-full"
            />
          </UFormField>
          <IconPicker v-model="form.icon" />
          <p
            v-if="formError"
            role="alert"
            class="text-sm text-error"
          >
            {{ formError }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="busy"
              @click="editorOpen = false"
            >
              {{ t('catalog.shared.cancel') }}
            </UButton><UButton
              type="submit"
              :loading="busy"
              :disabled="!form.name.trim()"
            >
              {{ editing ? t('catalog.collections.saveChanges') : t('catalog.collections.create') }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
    <UModal
      v-model:open="deleteOpen"
      :title="t('catalog.collections.deleteTitle')"
      :description="t('catalog.collections.deleteBody', { name: deleting?.name || t('catalog.collections.thisCollection') })"
      :dismissible="!busy"
    >
      <template #body>
        <p
          v-if="formError"
          role="alert"
          class="mb-4 text-sm text-error"
        >
          {{ formError }}
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="busy"
            @click="deleting = null"
          >
            {{ t('catalog.shared.cancel') }}
          </UButton><UButton
            color="error"
            :loading="busy"
            @click="remove"
          >
            {{ t('catalog.collections.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
