<script setup lang="ts">
import type { AssetAttributeValue, Asset, Category, Location, Condition, Tag } from '~/types/api'
import { isValidAssetQuantity } from '~/utils/assetValidation'
import { tagAssignment } from '~/utils/tags'

definePageMeta({
  middleware: 'auth'
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const apiFetch = useApiFetch()
const { features } = useFeatures()
const { settings } = useOrganizationSettings()

const assetUrl = computed(() => `/api/assets/${route.params.id}`)
const { data: asset, status: assetStatus, clear: clearAsset } = useApi<Asset>(
  () => assetUrl.value,
  { key: assetUrl }
)
const { data: categories } = useApi<Category[]>('/api/categories', { immediate: features.value.categories })
const { data: locations } = useApi<Location[]>('/api/locations', { immediate: features.value.locations })
const { data: conditions } = useApi<Condition[]>('/api/conditions', { immediate: features.value.conditions })
const { data: tags } = useApi<Tag[]>('/api/tags', { immediate: features.value.tags })

const detailsOpen = ref(false)
const purchaseOpen = ref(false)
function revealInvalidSection(event: Event) {
  (event.currentTarget as HTMLDetailsElement).open = true
}

const loading = ref(false)
const categoryLoading = ref(false)
const selectedCategory = ref<Category | null>(null)
const parentValid = ref(true)
const parentAsset = ref<Asset | null>(null)
const addedContents = ref<Asset[]>([])
const removedContents = ref<string[]>([])
const form = reactive({
  parent_id: null as string | null,
  collection_ids: [] as string[],
  tag_names: [] as string[],
  name: '',
  description: '',
  category_id: undefined as string | undefined,
  location_id: undefined as string | undefined,
  condition_id: undefined as string | undefined,
  quantity: 1,
  attributes: {} as Record<string, AssetAttributeValue>,
  purchase_at: '',
  purchase_price: undefined as number | undefined,
  purchase_note: '',
  notes: ''
})

watch(parentAsset, (parent) => {
  if (parent) form.location_id = parent.location_id || undefined
})

// Initialize form when asset loads
watch(
  asset,
  (newAsset) => {
    if (newAsset) {
      form.parent_id = newAsset.parent_id || null
      form.name = newAsset.name
      form.description = newAsset.description || ''
      form.category_id = newAsset.category_id
      form.location_id = newAsset.location_id || undefined
      form.collection_ids = [...(newAsset.collection_ids || [])]
      form.tag_names = (newAsset.tags || []).map(tag => tag.name)
      form.condition_id = newAsset.condition_id || undefined
      form.quantity = newAsset.quantity
      form.attributes = newAsset.attributes
        ? Object.fromEntries(
            Object.entries(newAsset.attributes).map(([k, v]) => [
              k,
              v as AssetAttributeValue
            ])
          )
        : {}
      form.purchase_at = newAsset.purchase_at?.split('T')[0] || ''
      form.purchase_price = newAsset.purchase_price ?? undefined
      form.purchase_note = newAsset.purchase_note || ''
      form.notes = newAsset.notes || ''
      detailsOpen.value = Boolean(
        form.condition_id || form.description.trim() || form.notes.trim() || form.quantity !== 1
      )
      purchaseOpen.value = Boolean(
        form.purchase_at || form.purchase_price != null || form.purchase_note.trim()
      )
    }
  },
  { immediate: true }
)

// Fetch category with attributes when category changes
let categoryRequestId = 0
watch(
  () => form.category_id,
  async (categoryId) => {
    const requestId = ++categoryRequestId
    if (features.value.categories && categoryId) {
      categoryLoading.value = true
      try {
        const category = await apiFetch<Category>(
          `/api/categories/${categoryId}?inherited=true`
        )
        if (requestId !== categoryRequestId) return
        selectedCategory.value = category
        // Initialize attribute values for new category
        const newAttributes: Record<string, AssetAttributeValue> = {}
        selectedCategory.value?.attributes?.forEach((ca) => {
          if (ca.attribute) {
            // Preserve existing value if key exists
            newAttributes[ca.attribute.key]
              = form.attributes[ca.attribute.key]
                ?? getDefaultValue(ca.attribute.data_type)
          }
        })
        form.attributes = newAttributes
      } catch {
        if (requestId === categoryRequestId) selectedCategory.value = null
      } finally {
        if (requestId === categoryRequestId) categoryLoading.value = false
      }
    } else {
      categoryLoading.value = false
      selectedCategory.value = null
      form.attributes = {}
    }
  },
  { immediate: true }
)

function getDefaultValue(dataType: string): AssetAttributeValue {
  switch (dataType) {
    case 'url':
    case 'select':
      return undefined
    case 'number':
      return 0
    case 'boolean':
      return false
    default:
      return ''
  }
}

function getInputType(dataType: string): string {
  switch (dataType) {
    case 'number':
      return 'number'
    case 'date':
      return 'date'
    case 'boolean':
      return 'checkbox'
    default:
      return 'text'
  }
}

interface LocationOption {
  label: string
  value: string
}

interface LocationTreeNode {
  location: Location
  children: LocationTreeNode[]
}

function buildHierarchicalLocationOptions(items: Location[]): LocationOption[] {
  const childrenMap = new Map<string | undefined, Location[]>()
  items.forEach((location) => {
    const parentId = location.parent_id || undefined
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(location)
  })

  const buildTree = (parentId: string | undefined): LocationTreeNode[] => {
    const children = childrenMap.get(parentId) || []
    return children
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(location => ({
        location,
        children: buildTree(location.id)
      }))
  }

  const flattenTree = (nodes: LocationTreeNode[], depth = 0): LocationOption[] => {
    return nodes.flatMap((node) => {
      const indent = depth > 0 ? `${'\u00A0'.repeat(depth * 2)}└ ` : ''
      return [
        { label: `${indent}${node.location.name}`, value: node.location.id },
        ...flattenTree(node.children, depth + 1)
      ]
    })
  }

  return flattenTree(buildTree(undefined))
}

const locationOptions = computed(() => [
  { label: t('assets.new.noLocation'), value: undefined },
  ...(locations.value ? buildHierarchicalLocationOptions(locations.value) : [])
])

const conditionOptions = computed(() => [
  { label: t('assets.new.noCondition'), value: undefined },
  ...(conditions.value?.map(c => ({ label: c.label, value: c.id })) || [])
])

async function submitForm() {
  if (loading.value) return
  if (form.parent_id && !parentValid.value) {
    toast.add({ title: t('assets.new.resolveParent'), color: 'error' })
    return
  }
  if (!form.name) {
    toast.add({ title: t('assets.new.nameRequired'), color: 'error' })
    return
  }

  if (!isValidAssetQuantity(form.quantity)) {
    toast.add({ title: t('assets.validation.quantity'), color: 'error' })
    return
  }

  loading.value = true
  try {
    const payload = {
      name: form.name,
      parent_id: form.parent_id,
      add_child_ids: addedContents.value.map(asset => asset.id),
      remove_child_ids: removedContents.value,
      description: form.description || undefined,
      category_id: features.value.categories ? form.category_id : undefined,
      location_id: features.value.locations && !form.parent_id ? form.location_id || undefined : undefined,
      collection_ids: features.value.collections ? form.collection_ids : undefined,
      ...(features.value.tags ? tagAssignment(form.tag_names, tags.value || []) : {}),
      condition_id: features.value.conditions ? form.condition_id || undefined : undefined,
      quantity: form.quantity,
      attributes: features.value.categories && Object.keys(form.attributes).length > 0
        ? form.attributes
        : undefined,
      purchase_at: form.purchase_at || undefined,
      purchase_price: form.purchase_price ?? undefined,
      purchase_note: form.purchase_note || undefined,
      notes: form.notes || undefined
    }

    await apiFetch(`/api/assets/${route.params.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })

    clearAsset()
    toast.add({ title: t('assets.edit.updated'), color: 'success' })
    router.push(`/assets/${route.params.id}`)
  } catch (err: unknown) {
    const error = err as { data?: { error?: string }, message?: string }
    toast.add({
      title: error?.data?.error || error?.message || t('assets.edit.updateFailed'),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1040px] space-y-5 pb-6">
    <!-- Loading State -->
    <div
      v-if="assetStatus === 'pending'"
      class="flex items-center justify-center py-24"
    >
      <div class="text-center">
        <UIcon
          name="i-lucide-loader-2"
          class="w-12 h-12 animate-spin text-attic-500 mx-auto mb-4"
        />
        <p class="text-gray-500">
          {{ t('assets.edit.loading') }}
        </p>
      </div>
    </div>

    <template v-else>
      <!-- Breadcrumbs & Heading -->
      <div class="space-y-3">
        <nav
          :aria-label="t('assets.new.breadcrumb')"
          class="flex text-xs"
        >
          <ol class="flex items-center gap-1.5">
            <li>
              <NuxtLink
                to="/"
                class="font-semibold text-muted transition-colors hover:text-attic-500"
              >
                {{ t('assets.new.dashboard') }}
              </NuxtLink>
            </li>
            <li>
              <span class="text-gray-300 dark:text-gray-600">/</span>
            </li>
            <li>
              <NuxtLink
                to="/assets"
                class="font-semibold text-muted transition-colors hover:text-attic-500"
              >
                {{ t('assets.new.assets') }}
              </NuxtLink>
            </li>
            <li>
              <span class="text-gray-300 dark:text-gray-600">/</span>
            </li>
            <li>
              <NuxtLink
                :to="`/assets/${route.params.id}`"
                class="max-w-48 truncate font-semibold text-muted transition-colors hover:text-attic-500"
              >
                {{ asset?.name || t('assets.edit.asset') }}
              </NuxtLink>
            </li>
            <li>
              <span class="text-gray-300 dark:text-gray-600">/</span>
            </li>
            <li>
              <span
                aria-current="page"
                class="font-bold text-attic-500"
              >{{ t('assets.edit.edit') }}</span>
            </li>
          </ol>
        </nav>

        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p class="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-attic-500">
              {{ t('assets.edit.eyebrow') }}
            </p>
            <h1 class="text-2xl font-extrabold tracking-[-0.04em] text-mist-950 dark:text-white md:text-3xl">
              {{ t('assets.edit.title', { name: asset?.name }) }}
            </h1>
            <p class="mt-1 text-sm text-muted">
              {{ t('assets.edit.subtitle') }}
            </p>
          </div>
          <div class="hidden items-center gap-2 sm:flex">
            <UButton
              :to="`/assets/${route.params.id}`"
              variant="ghost"
              color="neutral"
              class="rounded-xl font-semibold"
            >
              {{ t('assets.new.cancel') }}
            </UButton>
            <UButton
              :loading="loading"
              class="rounded-xl font-bold shadow-primary"
              icon="i-lucide-save"
              @click="submitForm"
            >
              {{ t('assets.edit.save') }}
            </UButton>
          </div>
        </div>
      </div>

      <!-- Main Form Card -->
      <form
        class="space-y-5"
        @submit.prevent="submitForm"
      >
        <div class="space-y-5">
          <!-- Section 1: Universal Essentials -->
          <section class="attic-panel space-y-5 rounded-[20px] p-5 sm:p-6">
            <div class="flex items-start gap-3">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-attic-50 text-attic-500 dark:bg-attic-500/10">
                <UIcon
                  name="i-lucide-package"
                  class="size-4.5"
                />
              </div>
              <div>
                <h2 class="font-extrabold text-mist-950 dark:text-white">
                  {{ t('assets.new.basicInfo') }}
                </h2>
                <p class="text-xs text-muted">
                  {{ t('assets.edit.basicInfoHint') }}
                </p>
              </div>
            </div>
            <div class="grid grid-cols-1 items-start gap-5 md:grid-cols-12">
              <!-- Name -->
              <div class="md:col-span-8 space-y-2">
                <label
                  for="asset-name"
                  class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  {{ t('assets.new.assetName') }} <span class="text-amber-500">*</span>
                </label>
                <div class="relative group">
                  <input
                    id="asset-name"
                    v-model="form.name"
                    type="text"
                    :placeholder="t('assets.new.namePlaceholder')"
                    class="block w-full rounded-xl border-mist-200 bg-white px-4 py-3 text-mist-950 shadow-sm transition-colors placeholder:text-dimmed focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
                  >
                  <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity">
                    <UIcon
                      name="i-lucide-pencil"
                      class="w-5 h-5 text-attic-500"
                    />
                  </div>
                </div>
              </div>

              <!-- Location -->
              <div
                v-if="features.locations && !form.parent_id"
                class="md:col-span-4 space-y-2"
              >
                <label
                  for="location"
                  class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  {{ t('assets.edit.location') }}
                </label>
                <USelectMenu
                  id="location"
                  v-model="form.location_id"
                  :items="locationOptions"
                  :placeholder="t('assets.edit.locationPlaceholder')"
                  value-key="value"
                  class="w-full"
                  size="lg"
                />
              </div>
            </div>

            <AssetPicker
              v-model="form.parent_id"
              :label="t('assets.picker.inside')"
              :exclude-subtree-of="String(route.params.id)"
              :show-location="features.locations"
              @valid="parentValid = $event"
              @resolved="parentAsset = $event"
            />
            <AssetCategoryField
              v-if="features.categories"
              v-model="form.category_id"
              :categories="categories || []"
              :selected-category="selectedCategory"
              :loading="categoryLoading"
            />
            <AssetCollectionsField
              v-if="features.collections"
              v-model="form.collection_ids"
            />
            <AssetTagsField
              v-if="features.tags"
              v-model="form.tag_names"
              :tags="tags || []"
            />
          </section>

          <hr class="hidden">

          <AssetContents
            v-model:added="addedContents"
            v-model:removed="removedContents"
            :asset-id="String(route.params.id)"
            editing
          />

          <!-- Section 2: Additional Details -->
          <details
            :open="detailsOpen"
            class="attic-panel space-y-5 rounded-[20px] p-5 sm:p-6"
            @invalid.capture="revealInvalidSection"
          >
            <summary class="flex cursor-pointer list-none items-start gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-attic-500 [&::-webkit-details-marker]:hidden">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <UIcon
                  name="i-lucide-clipboard-list"
                  class="size-4.5"
                />
              </div>
              <div>
                <h2 class="font-extrabold text-mist-950 dark:text-white">
                  {{ t('assets.new.detailsTitle') }}
                </h2>
                <p class="text-xs text-muted">
                  {{ t('assets.edit.detailsHint') }}
                </p>
              </div>
              <UIcon
                name="i-lucide-chevron-down"
                class="ml-auto mt-2 size-4 shrink-0 text-muted transition-transform in-open:rotate-180"
              />
            </summary>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Condition -->
              <div
                v-if="features.conditions"
                class="space-y-2"
              >
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {{ t('assets.new.condition') }}
                </label>
                <USelectMenu
                  v-model="form.condition_id"
                  :items="conditionOptions"
                  :placeholder="t('assets.new.conditionPlaceholder')"
                  value-key="value"
                  class="w-full"
                  size="lg"
                />
              </div>

              <!-- Quantity -->
              <div class="space-y-2">
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {{ t('assets.new.quantity') }}
                </label>
                <input
                  v-model.number="form.quantity"
                  type="number"
                  min="1"
                  class="block w-full rounded-xl border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
                >
              </div>
            </div>

            <!-- Description -->
            <div class="space-y-2">
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {{ t('assets.new.description') }}
              </label>
              <textarea
                v-model="form.description"
                rows="4"
                :placeholder="t('assets.new.descriptionPlaceholder')"
                class="block w-full resize-none rounded-xl border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm placeholder:text-dimmed focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
              />
            </div>

            <!-- Personal Notes -->
            <div class="space-y-2">
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {{ t('assets.new.personalNotes') }}
              </label>
              <textarea
                v-model="form.notes"
                rows="3"
                :placeholder="t('assets.new.notesPlaceholder')"
                class="block w-full resize-none rounded-xl border-terracotta-100 bg-terracotta-50/40 px-4 py-3 text-sm text-mist-950 shadow-sm placeholder:text-dimmed focus:border-terracotta-300 focus:ring-terracotta-300 dark:border-terracotta-900/40 dark:bg-terracotta-950/10 dark:text-white"
              />
            </div>
          </details>

          <!-- Category Attributes -->
          <template v-if="features.categories && selectedCategory?.attributes?.length">
            <hr class="hidden">

            <section
              id="category-fields"
              class="attic-panel scroll-mt-6 space-y-5 rounded-[20px] p-5 sm:p-6"
            >
              <div class="flex items-start gap-3">
                <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-terracotta-50 text-terracotta-500 dark:bg-terracotta-500/10 dark:text-terracotta-300">
                  <UIcon
                    name="i-lucide-sliders-horizontal"
                    class="size-4.5"
                  />
                </div>
                <div>
                  <h2 class="font-extrabold text-mist-950 dark:text-white">
                    {{ t('assets.new.categoryFields', { name: selectedCategory.name }) }}
                  </h2>
                  <p class="text-xs text-muted">
                    {{ t('assets.new.categoryFieldsHint') }}
                  </p>
                </div>
              </div>

              <div class="max-w-3xl space-y-5">
                <div
                  v-for="ca in selectedCategory.attributes"
                  :key="ca.attribute_id"
                  class="space-y-2"
                >
                  <template v-if="ca.attribute">
                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {{ ca.attribute.name }}
                      <span
                        v-if="ca.inherited"
                        class="ml-1 normal-case font-semibold text-attic-500"
                      >({{ t('assets.new.inherited') }})</span>
                      <span
                        v-if="ca.required"
                        class="text-amber-500"
                      >*</span>
                    </label>

                    <URLAttributeInput
                      v-if="ca.attribute.data_type === 'url'"
                      v-model="form.attributes[ca.attribute.key]"
                      :required="ca.required"
                      :name="ca.attribute.name"
                    />
                    <SelectAttributeInput
                      v-else-if="ca.attribute.data_type === 'select'"
                      :attribute="ca.attribute"
                      :model-value="form.attributes[ca.attribute.key]"
                      :required="ca.required"
                      @update:model-value="form.attributes[ca.attribute.key] = $event"
                    />
                    <!-- Boolean type: checkbox -->
                    <div
                      v-else-if="ca.attribute.data_type === 'boolean'"
                      class="flex items-center gap-2 py-2"
                    >
                      <input
                        :id="`attr-${ca.attribute.key}`"
                        v-model="form.attributes[ca.attribute.key]"
                        type="checkbox"
                        class="rounded border-gray-300 dark:border-gray-600 text-attic-500 focus:ring-attic-500"
                      >
                      <label
                        :for="`attr-${ca.attribute.key}`"
                        class="text-sm text-gray-600 dark:text-gray-300"
                      >
                        {{ ca.attribute.name }}
                      </label>
                    </div>

                    <!-- Text (long) type: textarea -->
                    <textarea
                      v-else-if="ca.attribute.data_type === 'text'"
                      :value="String(form.attributes[ca.attribute.key] ?? '')"
                      :placeholder="t('assets.new.enterNamed', { name: ca.attribute.name })"
                      rows="4"
                      class="block w-full resize-none rounded-xl border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm placeholder:text-dimmed focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
                      @input="form.attributes[ca.attribute.key] = ($event.target as HTMLTextAreaElement).value"
                    />

                    <!-- Other types: input -->
                    <input
                      v-else
                      v-model="form.attributes[ca.attribute.key]"
                      :type="getInputType(ca.attribute.data_type)"
                      :step="ca.attribute.data_type === 'number' ? 'any' : undefined"
                      :placeholder="t('assets.new.enterNamed', { name: ca.attribute.name })"
                      class="block w-full rounded-xl border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm placeholder:text-dimmed focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
                    >
                  </template>
                </div>
              </div>
            </section>
          </template>

          <div
            v-else-if="features.categories && form.category_id && !selectedCategory?.attributes?.length"
            class="attic-panel rounded-[20px] py-5 text-center text-sm text-muted"
          >
            <p>{{ t('assets.edit.noCustomAttributes') }}</p>
          </div>

          <hr class="hidden">

          <!-- Section 3: Purchase Information -->
          <details
            :open="purchaseOpen"
            class="attic-panel space-y-5 rounded-[20px] p-5 sm:p-6"
            @invalid.capture="revealInvalidSection"
          >
            <summary class="flex cursor-pointer list-none items-start gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-attic-500 [&::-webkit-details-marker]:hidden">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <UIcon
                  name="i-lucide-receipt"
                  class="size-4.5"
                />
              </div>
              <div>
                <h2 class="font-extrabold text-mist-950 dark:text-white">
                  {{ t('assets.new.purchaseTitle') }}
                </h2>
                <p class="text-xs text-muted">
                  {{ t('assets.new.purchaseHint') }}
                </p>
              </div>
              <UIcon
                name="i-lucide-chevron-down"
                class="ml-auto mt-2 size-4 shrink-0 text-muted transition-transform in-open:rotate-180"
              />
            </summary>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Purchase Date -->
              <div class="space-y-2">
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {{ t('assets.new.purchaseDate') }}
                </label>
                <input
                  v-model="form.purchase_at"
                  type="date"
                  class="block w-full rounded-xl border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
                >
              </div>

              <!-- Purchase Price -->
              <div class="space-y-2">
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {{ t('assets.new.purchasePrice') }}
                </label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 pointer-events-none">{{ settings.currency }}</span>
                  <input
                    v-model.number="form.purchase_price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    class="block w-full rounded-xl border-mist-200 bg-white py-3 pl-14 pr-4 text-sm text-mist-950 shadow-sm placeholder:text-dimmed focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
                  >
                </div>
              </div>
            </div>

            <!-- Purchase Notes -->
            <div class="space-y-2">
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {{ t('assets.new.purchaseNotes') }}
              </label>
              <textarea
                v-model="form.purchase_note"
                rows="3"
                :placeholder="t('assets.new.purchaseNotesPlaceholder')"
                class="block w-full resize-none rounded-xl border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm placeholder:text-dimmed focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
              />
            </div>
          </details>
        </div>

        <!-- Footer Action Area -->
        <div class="attic-panel flex flex-col items-center justify-between gap-3 rounded-[18px] px-4 py-3 sm:flex-row">
          <div class="text-xs text-muted">
            <span class="text-amber-500">*</span> {{ t('assets.new.requiredFields') }}
          </div>
          <div class="flex items-center gap-3">
            <UButton
              :to="`/assets/${route.params.id}`"
              variant="ghost"
              color="neutral"
            >
              {{ t('assets.new.cancel') }}
            </UButton>
            <UButton
              type="submit"
              :loading="loading"
              class="rounded-xl shadow-primary"
              icon="i-lucide-save"
            >
              {{ t('assets.edit.save') }}
            </UButton>
          </div>
        </div>
      </form>
    </template>
  </div>
</template>
