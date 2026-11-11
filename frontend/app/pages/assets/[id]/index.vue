<script setup lang="ts">
import { formatPurchasePrice } from '~/utils/currency'
import type { Asset, Warranty, Attachment, Category } from '~/types/api'

definePageMeta({
  middleware: 'auth'
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const toast = useToast()
const apiFetch = useApiFetch()
const { features } = useFeatures()
const { settings } = useOrganizationSettings()

const assetUrl = computed(() => `/api/assets/${route.params.id}`)
const { data: asset, refresh: refreshAsset } = useApi<Asset>(
  () => assetUrl.value,
  { key: assetUrl }
)
const { data: warranty, refresh: refreshWarranty } = useApi<Warranty>(
  () => `/api/assets/${route.params.id}/warranty`,
  { immediate: features.value.warranties }
)
const { data: attachments, refresh: refreshAttachments } = useApi<Attachment[]>(
  () => `/api/assets/${route.params.id}/attachments`
)

// Fetch category with attribute definitions when asset loads
const categoryWithAttrs = ref<Category | null>(null)

watch(() => asset.value?.category_id, async (categoryId) => {
  if (features.value.categories && categoryId) {
    try {
      categoryWithAttrs.value = await apiFetch<Category>(`/api/categories/${categoryId}?inherited=true`)
    } catch {
      categoryWithAttrs.value = null
    }
  } else {
    categoryWithAttrs.value = null
  }
}, { immediate: true })

// Get attribute value formatted for display
function getAttributeValue(key: string): string {
  const value = asset.value?.attributes?.[key]
  if (value === undefined || value === null || value === '') return '-'
  const definition = categoryWithAttrs.value?.attributes?.find(a => a.attribute?.key === key)?.attribute
  if (definition?.data_type === 'select') {
    const label = (v: unknown) => definition.options?.find(o => o.value === v)?.label || String(v)
    return Array.isArray(value) ? value.map(label).join(', ') || '-' : label(value)
  }
  if (typeof value === 'boolean') return value ? t('assets.detail.yes') : t('assets.detail.no')
  return String(value)
}

const deleteModalOpen = ref(false)
const warrantyModalOpen = ref(false)
const detaching = ref(false)
async function detachAsset() {
  if (detaching.value) return
  detaching.value = true
  try {
    await apiFetch(`/api/assets/${route.params.id}/parent`, { method: 'PATCH', body: JSON.stringify({ parent_id: null }) })
    await refreshAsset()
    toast.add({ title: t('assets.detail.detached'), color: 'success' })
  } catch (err: unknown) {
    const failure = err as { data?: { error?: string } }
    toast.add({ title: failure.data?.error || t('assets.detail.detachFailed'), color: 'error' })
  } finally { detaching.value = false }
}
const config = useRuntimeConfig()

// Warranty form
const warrantyForm = reactive({
  provider: '',
  policy_number: '',
  start_date: '',
  end_date: '',
  notes: ''
})

// Initialize warranty form when warranty data loads
watch(warranty, (w) => {
  if (w) {
    warrantyForm.provider = w.provider || ''
    warrantyForm.policy_number = w.policy_number || ''
    warrantyForm.start_date = w.start_date?.split('T')[0] || ''
    warrantyForm.end_date = w.end_date?.split('T')[0] || ''
    warrantyForm.notes = w.notes || ''
  }
}, { immediate: true })

function openWarrantyModal() {
  if (!features.value.warranties) return
  if (!warranty.value) {
    warrantyForm.provider = ''
    warrantyForm.policy_number = ''
    warrantyForm.start_date = ''
    warrantyForm.end_date = ''
    warrantyForm.notes = ''
  }
  warrantyModalOpen.value = true
}

watch(() => route.query.warranty, (action) => {
  if (features.value.warranties && action === 'edit') openWarrantyModal()
}, { immediate: true })

async function saveWarranty() {
  try {
    const method = warranty.value ? 'PUT' : 'POST'
    await apiFetch(`/api/assets/${route.params.id}/warranty`, {
      method,
      body: JSON.stringify({
        provider: warrantyForm.provider || undefined,
        policy_number: warrantyForm.policy_number || undefined,
        start_date: warrantyForm.start_date || undefined,
        end_date: warrantyForm.end_date || undefined,
        notes: warrantyForm.notes || undefined
      })
    })
    toast.add({ title: t('assets.detail.warrantySaved'), color: 'success' })
    warrantyModalOpen.value = false
    refreshWarranty()
  } catch {
    toast.add({ title: t('assets.detail.warrantySaveFailed'), color: 'error' })
  }
}

async function deleteWarranty() {
  if (!confirm(t('assets.detail.confirmDeleteWarranty'))) return
  try {
    await apiFetch(`/api/assets/${route.params.id}/warranty`, {
      method: 'DELETE'
    })
    toast.add({ title: t('assets.detail.warrantyDeleted'), color: 'success' })
    refreshWarranty()
  } catch {
    toast.add({ title: t('assets.detail.warrantyDeleteFailed'), color: 'error' })
  }
}

async function deleteAsset() {
  try {
    await apiFetch(`/api/assets/${route.params.id}`, {
      method: 'DELETE'
    })
    toast.add({ title: t('assets.detail.deleted'), color: 'success' })
    router.push('/assets')
  } catch {
    toast.add({ title: t('assets.detail.deleteFailed'), color: 'error' })
  }
}

async function downloadAttachment(attachment: Attachment) {
  try {
    const response = await apiFetch<{ url: string }>(`/api/attachments/${attachment.id}`)
    if (response.url) {
      window.open(response.url, '_blank')
    }
  } catch {
    toast.add({ title: t('assets.detail.downloadFailed'), color: 'error' })
  }
}

async function deleteAttachment(attachment: Attachment) {
  if (!confirm(t('assets.detail.confirmDeleteAttachment', { name: attachment.file_name }))) return
  try {
    await apiFetch(`/api/attachments/${attachment.id}`, {
      method: 'DELETE'
    })
    toast.add({ title: t('assets.detail.attachmentDeleted'), color: 'success' })
    refreshAttachments()
    // Refresh asset in case we deleted the main image
    if (asset.value?.main_attachment_id === attachment.id) {
      refreshAsset()
    }
  } catch {
    toast.add({ title: t('assets.detail.attachmentDeleteFailed'), color: 'error' })
  }
}

// State for attachment thumbnail URLs
const attachmentUrls = ref<Record<string, string>>({})
const imageViewerOpen = ref(false)
const activeImageIndex = ref(0)
const imageZoom = ref(1)

function resetImageZoom() {
  imageZoom.value = 1
}

function changeImageZoom(amount: number) {
  imageZoom.value = Math.min(3, Math.max(1, Math.round((imageZoom.value + amount) * 10) / 10))
}

function selectGalleryImage(index: number) {
  activeImageIndex.value = index
  resetImageZoom()
}

const imageGallery = computed(() => {
  const images = (attachments.value || [])
    .filter(attachment => isImageAttachment(attachment) && attachmentUrls.value[attachment.id])
    .map(attachment => ({
      id: attachment.id,
      name: attachment.file_name,
      url: attachmentUrls.value[attachment.id]!
    }))
  const mainImageUrl = asset.value?.main_attachment_url
  if (mainImageUrl) {
    const mainImageId = asset.value?.main_attachment_id
    const mainIndex = images.findIndex(image => image.id === mainImageId)
    if (mainIndex >= 0) {
      images[mainIndex]!.url = mainImageUrl
      images.unshift(...images.splice(mainIndex, 1))
    } else {
      images.unshift({
        id: mainImageId || 'main-image',
        name: asset.value?.main_attachment?.file_name || t('assets.detail.imageOf', { name: asset.value?.name }),
        url: mainImageUrl
      })
    }
  }
  return images
})

function openImageViewer(imageId?: string) {
  const index = imageGallery.value.findIndex(image => image.id === imageId)
  if (index < 0) return
  activeImageIndex.value = index
  resetImageZoom()
  imageViewerOpen.value = true
}

function showAdjacentImage(direction: -1 | 1) {
  const count = imageGallery.value.length
  if (count < 2) return
  selectGalleryImage((activeImageIndex.value + direction + count) % count)
}

function handleImageViewerKeydown(event: KeyboardEvent) {
  if (!imageViewerOpen.value) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    showAdjacentImage(-1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    showAdjacentImage(1)
  }
}

watch(imageViewerOpen, (open) => {
  if (typeof window === 'undefined') return
  if (open) window.addEventListener('keydown', handleImageViewerKeydown)
  else window.removeEventListener('keydown', handleImageViewerKeydown)
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', handleImageViewerKeydown)
})

// Helper to check if attachment is an image
function isImageAttachment(attachment: Attachment): boolean {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
  return attachment.content_type ? imageTypes.includes(attachment.content_type) : false
}

// Load thumbnail URLs for image attachments
watch(attachments, async (atts) => {
  if (!atts) return
  for (const att of atts) {
    if (isImageAttachment(att) && !attachmentUrls.value[att.id]) {
      try {
        const response = await apiFetch<{ url: string }>(`/api/attachments/${att.id}`)
        if (response.url) {
          attachmentUrls.value[att.id] = response.url
        }
      } catch {
        // Ignore errors loading thumbnails
      }
    }
  }
}, { immediate: true })

// Set main image
async function setMainImage(attachment: Attachment) {
  try {
    await apiFetch(`/api/assets/${route.params.id}/main-image/${attachment.id}`, {
      method: 'PUT'
    })
    toast.add({ title: t('assets.detail.mainImageUpdated'), color: 'success' })
    refreshAsset()
  } catch {
    toast.add({ title: t('assets.detail.mainImageFailed'), color: 'error' })
  }
}

// Clear main image
async function clearMainImage() {
  try {
    await apiFetch(`/api/assets/${route.params.id}/main-image`, {
      method: 'DELETE'
    })
    toast.add({ title: t('assets.detail.mainImageCleared'), color: 'success' })
    refreshAsset()
  } catch {
    toast.add({ title: t('assets.detail.mainImageClearFailed'), color: 'error' })
  }
}

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const dragging = ref(false)
let dragDepth = 0

function triggerUpload() {
  fileInput.value?.click()
}

const uploadQueue: File[] = []
const retryFiles = ref<File[]>([])

async function uploadFiles(files: File[]) {
  if (!files.length || uploading.value) {
    if (uploading.value) uploadQueue.push(...files)
    return
  }

  uploading.value = true
  let succeeded = 0
  let index = 0
  try {
    for (; index < files.length; index++) {
      const file = files[index]!
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${config.public.apiBase}/api/assets/${route.params.id}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`)
      }
      succeeded++
    }

    toast.add({
      title: succeeded > 1 ? t('assets.detail.filesUploaded', { count: succeeded }) : t('assets.detail.fileUploaded'),
      color: 'success'
    })
  } catch {
    const remaining = files.slice(index)
    if (succeeded === 0) {
      toast.add({ title: t('assets.detail.uploadFailed'), color: 'error' })
    } else {
      toast.add({
        title: t('assets.detail.partialUpload', { done: succeeded, total: files.length }),
        color: 'warning'
      })
    }
    if (remaining.length) {
      retryFiles.value = [...retryFiles.value, ...remaining]
    }
  } finally {
    if (succeeded > 0) {
      refreshAttachments()
      // Refresh asset in case this was auto-set as main image
      refreshAsset()
    }
    uploading.value = false
  }

  if (uploadQueue.length) {
    const next = uploadQueue.splice(0)
    await uploadFiles(next)
  }
}

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return
  await uploadFiles(Array.from(files))
  input.value = ''
}

function retryUpload() {
  const files = retryFiles.value
  if (!files.length || uploading.value) return
  retryFiles.value = []
  void uploadFiles(files)
}

function onDragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
  dragDepth++
  dragging.value = true
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onDragLeave(event: DragEvent) {
  event.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragDepth = 0
  dragging.value = false
  const files = event.dataTransfer?.files
  if (files?.length) void uploadFiles(Array.from(files))
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return '-'
  // Preserve currency-specific precision while showing at least two decimals.
  return formatPurchasePrice(value, settings.value.currency)
}

function daysUntilExpiry(endDate?: string) {
  if (!endDate) return null
  const end = new Date(endDate)
  const now = new Date()
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const warrantyStatus = computed((): { color: 'error' | 'warning' | 'success', text: string } | null => {
  if (!warranty.value?.end_date) return null
  const days = daysUntilExpiry(warranty.value.end_date)
  if (days === null) return null
  if (days < 0) return { color: 'error', text: t('assets.detail.expired') }
  if (days <= 30) return { color: 'warning', text: t('assets.detail.daysLeft', { count: days }, days) }
  return { color: 'success', text: t('assets.detail.daysLeft', { count: days }, days) }
})
</script>

<template>
  <div class="mx-auto max-w-[1320px] pb-8">
    <!-- Breadcrumbs -->
    <nav class="mb-5 flex items-center gap-1.5 text-xs font-semibold text-muted">
      <NuxtLink
        to="/"
        class="hover:text-attic-500 transition-colors"
      >
        {{ t('assets.detail.home') }}
      </NuxtLink>
      <UIcon
        name="i-lucide-chevron-right"
        class="w-4 h-4"
      />
      <NuxtLink
        to="/assets"
        class="hover:text-attic-500 transition-colors"
      >
        {{ t('assets.detail.assets') }}
      </NuxtLink>
      <UIcon
        name="i-lucide-chevron-right"
        class="w-4 h-4"
      />
      <span class="text-mist-950 dark:text-white">{{ asset?.name || t('assets.detail.loadingShort') }}</span>
    </nav>

    <div
      v-if="asset"
      class="space-y-6"
    >
      <header class="space-y-3">
        <!-- Header & Title -->
        <div class="flex flex-col items-start justify-between gap-4 md:flex-row">
          <div class="min-w-0 space-y-1">
            <div class="mb-2 flex items-center gap-2">
              <span
                v-if="features.categories"
                class="rounded-full bg-attic-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-attic-600 ring-1 ring-attic-100 dark:bg-attic-500/10 dark:text-attic-300 dark:ring-attic-500/20"
              >
                {{ asset.category?.name || t('assets.detail.uncategorized') }}
              </span>
              <span
                v-if="features.conditions && asset.condition?.label"
                class="text-xs font-semibold text-muted"
              >{{ asset.condition.label }}</span>
            </div>
            <h1 class="break-words text-3xl font-extrabold tracking-[-0.04em] text-mist-950 dark:text-white md:text-4xl">
              {{ asset.name }}
            </h1>
          </div>
          <div class="flex gap-2 shrink-0">
            <UButton
              :to="`/assets/${route.params.id}/edit`"
              variant="outline"
              class="rounded-xl font-bold"
              icon="i-lucide-pencil"
            >
              {{ t('assets.detail.editAsset') }}
            </UButton>
            <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :aria-label="t('assets.detail.deleteNamed', { name: asset.name })"
              :title="t('assets.detail.deleteNamed', { name: asset.name })"
              @click="deleteModalOpen = true"
            >
              {{ t('assets.detail.delete') }}
            </UButton>
          </div>
        </div>

        <section
          v-if="asset.parent"
          :aria-label="t('assets.picker.inside')"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
        >
          <span class="text-muted">{{ t('assets.picker.inside') }}</span>
          <NuxtLink
            :to="`/assets/${asset.parent.id}`"
            class="min-w-0 break-words font-semibold text-attic-500 hover:underline"
          >{{ asset.parent.name }}</NuxtLink>
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-unlink"
            :loading="detaching"
            :disabled="detaching"
            @click="detachAsset"
          >
            {{ t('assets.detail.detach') }}
          </UButton>
        </section>
        <div
          v-if="features.collections && asset.collections?.length"
          class="flex flex-wrap gap-2"
          :aria-label="t('assets.detail.collections')"
        >
          <UButton
            v-for="collection in asset.collections"
            :key="collection.id"
            :to="{ path: '/assets', query: { collection_id: collection.id } }"
            :icon="collection.icon"
            variant="soft"
            size="sm"
          >
            {{ collection.name }}
          </UButton>
        </div>
        <div
          v-if="features.tags && asset.tags?.length"
          class="flex flex-wrap gap-2"
          :aria-label="t('assets.detail.tags')"
        >
          <UButton
            v-for="tag in asset.tags"
            :key="tag.id"
            :to="{ path: '/assets', query: { tag_id: tag.id } }"
            icon="i-lucide-tag"
            variant="soft"
            color="neutral"
            size="sm"
          >
            {{ tag.name }}
          </UButton>
        </div>
      </header>
      <div class="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <!-- Main Image / Placeholder -->
        <div class="attic-panel relative group self-start overflow-hidden rounded-[20px]">
          <div
            class="flex items-center justify-center overflow-hidden bg-mist-50 dark:bg-mist-800/50"
            :class="asset.main_attachment_url ? 'aspect-[4/3] max-h-72 lg:max-h-none' : 'h-24 lg:h-52'"
          >
            <button
              v-if="asset.main_attachment_url"
              type="button"
              class="h-full w-full cursor-zoom-in"
              :aria-label="t('assets.detail.viewGallery', { name: asset.name })"
              @click="openImageViewer(asset.main_attachment_id)"
            >
              <img
                :src="asset.main_attachment_url"
                :alt="asset.name"
                class="h-full w-full object-cover"
              >
            </button>
            <div
              v-else
              class="flex items-center gap-3 p-4 lg:flex-col lg:gap-2"
            >
              <UIcon
                name="i-lucide-package"
                class="size-8 text-mist-300 dark:text-mist-600 lg:size-10"
              />
              <p class="text-sm text-gray-400">
                {{ t('assets.detail.noImage') }}
              </p>
            </div>
          </div>
          <!-- Clear main image button (shown on hover when image exists) -->
          <button
            v-if="asset.main_attachment_url"
            class="absolute right-3 top-3 rounded-xl bg-black/50 p-2 text-white opacity-100 transition-opacity hover:bg-black/70 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
            :title="t('assets.detail.removeMainImage')"
            @click.stop="clearMainImage"
          >
            <UIcon
              name="i-lucide-x"
              class="w-4 h-4"
            />
          </button>
        </div>

        <div class="min-w-0 space-y-6">
          <section
            v-if="asset.description"
            :aria-label="t('assets.detail.description')"
            class="attic-panel overflow-hidden rounded-[20px]"
          >
            <h2 class="border-b border-mist-100 bg-mist-50/60 px-4 py-3.5 text-base font-bold text-default dark:border-mist-700 dark:bg-mist-800/50 sm:px-5">
              {{ t('assets.detail.description') }}
            </h2>
            <p class="whitespace-pre-wrap break-words px-4 py-4 text-sm leading-relaxed text-mist-700 dark:text-mist-300 sm:px-5">
              {{ asset.description }}
            </p>
          </section>
          <section
            :aria-label="t('assets.detail.details')"
            class="attic-panel overflow-hidden rounded-[20px]"
          >
            <h2 class="flex items-center gap-2 border-b border-mist-100 bg-mist-50/60 px-4 py-3.5 text-base font-bold text-default dark:border-mist-700 dark:bg-mist-800/50 sm:px-5">
              <UIcon
                name="i-lucide-clipboard-list"
                class="size-4 text-attic-500"
              />{{ t('assets.detail.details') }}
            </h2>
            <dl class="grid grid-cols-2 gap-x-6 gap-y-5 p-4 sm:grid-cols-3 sm:p-5">
              <div
                v-if="features.locations"
                class="min-w-0"
              >
                <dt class="text-xs text-muted">
                  {{ t('assets.detail.location') }}
                </dt>
                <dd class="mt-1 break-words text-sm font-semibold text-default">
                  {{ asset.location?.name || t('assets.detail.notAssigned') }}
                </dd>
              </div>
              <div
                v-if="features.conditions"
                class="min-w-0"
              >
                <dt class="text-xs text-muted">
                  {{ t('assets.detail.condition') }}
                </dt>
                <dd class="mt-1 break-words text-sm font-semibold text-default">
                  {{ asset.condition?.label || t('assets.detail.notSpecified') }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  {{ t('assets.detail.quantity') }}
                </dt>
                <dd class="mt-1 text-sm font-semibold text-default">
                  {{ asset.quantity }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  {{ t('assets.detail.unitPrice') }}
                </dt>
                <dd class="mt-1 text-sm font-semibold tabular-nums text-default">
                  {{ asset.purchase_price == null ? t('assets.detail.notPriced') : formatCurrency(asset.purchase_price) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  {{ t('assets.detail.purchaseDate') }}
                </dt>
                <dd class="mt-1 text-sm font-semibold text-default">
                  {{ formatDate(asset.purchase_at) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  {{ t('assets.detail.created') }}
                </dt>
                <dd class="mt-1 text-sm font-semibold text-default">
                  {{ formatDate(asset.created_at) }}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
      <AssetContentsBrowser
        :key="asset.id"
        :asset="asset"
        :summary="asset.containment_summary"
        @changed="refreshAsset()"
      />
      <div class="space-y-6">
        <!-- Personal Notes (if present) -->
        <section
          v-if="asset.notes"
          :aria-label="t('assets.detail.personalNotes')"
          class="attic-panel overflow-hidden rounded-[20px]"
        >
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-mist-100 bg-mist-50/60 px-4 py-3.5 dark:border-mist-700 dark:bg-mist-800/50 sm:px-5">
            <h3 class="flex items-center gap-2 text-base font-bold text-mist-950 dark:text-white">
              <UIcon
                name="i-lucide-notebook-pen"
                class="size-5 text-attic-500"
                aria-hidden="true"
              />
              {{ t('assets.detail.personalNotes') }}
            </h3>
            <NuxtLink
              :to="`/assets/${route.params.id}/edit`"
              class="text-attic-500 text-sm font-bold hover:underline flex items-center gap-1"
            >
              <UIcon
                name="i-lucide-edit"
                class="w-4 h-4"
              />
              {{ t('assets.detail.editNotes') }}
            </NuxtLink>
          </div>
          <div class="bg-terracotta-50/50 px-4 py-4 dark:bg-terracotta-950/10 sm:px-5">
            <p class="whitespace-pre-wrap break-words text-sm leading-relaxed text-mist-700 dark:text-mist-300">
              {{ asset.notes }}
            </p>
          </div>
        </section>

        <!-- Category Attributes -->
        <section
          v-if="features.categories && categoryWithAttrs?.attributes?.length"
          class="attic-panel overflow-hidden rounded-[20px]"
        >
          <div class="flex items-center justify-between border-b border-mist-100 bg-mist-50/60 px-5 py-3.5 dark:border-mist-700 dark:bg-mist-800/50">
            <h3 class="text-base font-bold flex items-center gap-2 text-mist-950 dark:text-white">
              <UIcon
                name="i-lucide-sliders-horizontal"
                class="w-5 h-5 text-attic-500"
              />
              {{ t('assets.detail.categoryAttributes', { name: categoryWithAttrs.name }) }}
            </h3>
            <span class="text-[10px] px-2 py-0.5 bg-attic-500/10 text-attic-500 rounded-full font-bold uppercase tracking-widest">
              {{ t('assets.detail.customData') }}
            </span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 divide-y divide-x-0 md:divide-x md:divide-y-0 divide-gray-100 dark:divide-gray-700">
            <div class="divide-y divide-gray-100 dark:divide-gray-700">
              <div
                v-for="ca in categoryWithAttrs.attributes.filter((_, i) => i % 2 === 0)"
                :key="ca.attribute_id"
                class="flex items-center justify-between p-4 transition-colors hover:bg-mist-50 dark:hover:bg-mist-700/50"
              >
                <span class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ ca.attribute?.name }}</span>
                <URLAttributeDisplay
                  v-if="ca.attribute?.data_type === 'url'"
                  :value="asset?.attributes?.[ca.attribute.key]"
                />
                <span
                  v-else
                  class="min-w-0 break-all text-sm font-bold text-mist-950 dark:text-white"
                >{{ getAttributeValue(ca.attribute?.key || '') }}</span>
              </div>
            </div>
            <div class="divide-y divide-gray-100 dark:divide-gray-700">
              <div
                v-for="ca in categoryWithAttrs.attributes.filter((_, i) => i % 2 === 1)"
                :key="ca.attribute_id"
                class="flex items-center justify-between p-4 transition-colors hover:bg-mist-50 dark:hover:bg-mist-700/50"
              >
                <span class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ ca.attribute?.name }}</span>
                <URLAttributeDisplay
                  v-if="ca.attribute?.data_type === 'url'"
                  :value="asset?.attributes?.[ca.attribute.key]"
                />
                <span
                  v-else
                  class="min-w-0 break-all text-sm font-bold text-mist-950 dark:text-white"
                >{{ getAttributeValue(ca.attribute?.key || '') }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Warranty Section -->
        <section
          v-if="features.warranties"
          class="attic-panel overflow-hidden rounded-[20px]"
        >
          <div class="flex items-center justify-between border-b border-mist-100 bg-mist-50/60 px-5 py-3.5 dark:border-mist-700 dark:bg-mist-800/50">
            <h3 class="text-base font-bold flex items-center gap-2 text-mist-950 dark:text-white">
              <UIcon
                name="i-lucide-shield-check"
                class="w-5 h-5 text-attic-500"
              />
              {{ t('assets.detail.warrantyInfo') }}
            </h3>
            <button
              class="text-attic-500 text-sm font-bold hover:underline flex items-center gap-1"
              @click="openWarrantyModal"
            >
              <UIcon
                :name="warranty ? 'i-lucide-pencil' : 'i-lucide-plus'"
                class="w-4 h-4"
              />
              {{ warranty ? t('assets.detail.edit') : t('assets.detail.addWarranty') }}
            </button>
          </div>
          <div v-if="warranty">
            <div class="grid grid-cols-1 md:grid-cols-2 divide-y divide-x-0 md:divide-x md:divide-y-0 divide-gray-100 dark:divide-gray-700">
              <div class="divide-y divide-gray-100 dark:divide-gray-700">
                <div class="p-5 flex justify-between items-center">
                  <span class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('assets.detail.provider') }}</span>
                  <span class="text-sm font-bold text-mist-950 dark:text-white">{{ warranty.provider || '-' }}</span>
                </div>
                <div class="p-5 flex justify-between items-center">
                  <span class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('assets.detail.policyNumber') }}</span>
                  <span class="text-sm font-bold font-mono text-mist-950 dark:text-white">{{ warranty.policy_number || '-' }}</span>
                </div>
              </div>
              <div class="divide-y divide-gray-100 dark:divide-gray-700">
                <div class="p-5 flex justify-between items-center">
                  <span class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('assets.detail.startDate') }}</span>
                  <span class="text-sm font-bold text-mist-950 dark:text-white">{{ formatDate(warranty.start_date) }}</span>
                </div>
                <div class="p-5 flex justify-between items-center">
                  <span class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('assets.detail.endDate') }}</span>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-bold text-mist-950 dark:text-white">{{ formatDate(warranty.end_date) }}</span>
                    <UBadge
                      v-if="warrantyStatus"
                      :color="warrantyStatus.color"
                      size="xs"
                    >
                      {{ warrantyStatus.text }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="warranty.notes"
              class="p-5 border-t border-gray-100 dark:border-gray-700"
            >
              <span class="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-1">{{ t('assets.detail.notes') }}</span>
              <p class="text-sm text-mist-950 dark:text-white">
                {{ warranty.notes }}
              </p>
            </div>
          </div>
          <div
            v-else
            class="p-8 text-center"
          >
            <UIcon
              name="i-lucide-shield-off"
              class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3"
            />
            <p class="text-gray-500 dark:text-gray-400 mb-4">
              {{ t('assets.detail.noWarranty') }}
            </p>
            <UButton
              variant="soft"
              size="sm"
              @click="openWarrantyModal"
            >
              {{ t('assets.detail.addWarranty') }}
            </UButton>
          </div>
        </section>

        <!-- Attachments Section -->
        <section
          class="attic-panel relative overflow-hidden rounded-[20px]"
          :class="{ 'ring-2 ring-attic-500 dark:ring-attic-400': dragging }"
          @dragenter="onDragEnter"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <div
            v-if="dragging"
            class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-attic-500/10"
          >
            <div class="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-attic-500 shadow-lg dark:bg-mist-800 dark:text-attic-300">
              <UIcon
                name="i-lucide-upload"
                class="w-4 h-4"
              />
              {{ t('assets.detail.dropFiles') }}
            </div>
          </div>
          <div class="flex items-center justify-between border-b border-mist-100 bg-mist-50/60 px-5 py-3.5 dark:border-mist-700 dark:bg-mist-800/50">
            <h3 class="text-base font-bold flex items-center gap-2 text-mist-950 dark:text-white">
              <UIcon
                name="i-lucide-paperclip"
                class="w-5 h-5 text-attic-500"
              />
              {{ t('assets.detail.attachments') }}
            </h3>
            <button
              class="text-attic-500 text-sm font-bold hover:underline flex items-center gap-1"
              :disabled="uploading"
              @click="triggerUpload"
            >
              <UIcon
                name="i-lucide-upload"
                class="w-4 h-4"
              />
              {{ uploading ? t('assets.detail.uploading') : t('assets.detail.addFiles') }}
            </button>
            <input
              ref="fileInput"
              type="file"
              multiple
              class="hidden"
              @change="handleFileUpload"
            >
          </div>
          <div
            v-if="retryFiles.length"
            class="flex items-center justify-between gap-3 border-b border-terracotta-100 bg-terracotta-50 px-5 py-2.5 dark:border-terracotta-900/40 dark:bg-terracotta-950/10"
          >
            <span class="text-xs font-semibold text-terracotta-700 dark:text-terracotta-300">
              {{ t('assets.detail.notUploaded', { count: retryFiles.length }, retryFiles.length) }}
            </span>
            <div class="flex items-center gap-2">
              <button
                class="text-xs font-bold text-terracotta-700 hover:underline dark:text-terracotta-300"
                @click="retryUpload"
              >
                {{ t('assets.detail.retry') }}
              </button>
              <button
                class="text-xs font-bold text-muted hover:underline"
                @click="retryFiles = []"
              >
                {{ t('assets.detail.dismiss') }}
              </button>
            </div>
          </div>
          <div
            v-if="attachments?.length"
            class="divide-y divide-gray-100 dark:divide-gray-700"
          >
            <div
              v-for="attachment in attachments"
              :key="attachment.id"
              class="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                  <!-- Show thumbnail for images -->
                  <button
                    v-if="isImageAttachment(attachment) && attachmentUrls[attachment.id]"
                    type="button"
                    class="h-full w-full cursor-zoom-in"
                    :aria-label="t('assets.detail.viewFile', { name: attachment.file_name })"
                    @click="openImageViewer(attachment.id)"
                  >
                    <img
                      :src="attachmentUrls[attachment.id]"
                      :alt="attachment.file_name"
                      class="h-full w-full object-cover"
                    >
                  </button>
                  <UIcon
                    v-else
                    name="i-lucide-file"
                    class="w-5 h-5 text-gray-400"
                  />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <p class="font-medium text-sm text-mist-950 dark:text-white">
                      {{ attachment.file_name }}
                    </p>
                    <UBadge
                      v-if="asset.main_attachment_id === attachment.id"
                      color="primary"
                      size="xs"
                    >
                      {{ t('assets.detail.mainImage') }}
                    </UBadge>
                  </div>
                  <p class="text-xs text-gray-500">
                    {{ formatBytes(attachment.file_size) }}
                  </p>
                </div>
              </div>
              <div class="flex gap-1">
                <!-- Set as main image button (only for images) -->
                <UButton
                  v-if="isImageAttachment(attachment) && asset.main_attachment_id !== attachment.id"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-image"
                  size="sm"
                  :title="t('assets.detail.setMainImage')"
                  @click="setMainImage(attachment)"
                />
                <UButton
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-download"
                  size="sm"
                  @click="downloadAttachment(attachment)"
                />
                <UButton
                  variant="ghost"
                  color="error"
                  icon="i-lucide-trash-2"
                  size="sm"
                  @click="deleteAttachment(attachment)"
                />
              </div>
            </div>
          </div>
          <div
            v-else
            class="m-4 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-6 transition-colors"
            :class="dragging
              ? 'border-attic-500 bg-attic-50/60 dark:border-attic-400 dark:bg-attic-500/10'
              : 'border-mist-200 bg-mist-50/40 dark:border-mist-600 dark:bg-mist-800/30'"
          >
            <div class="flex items-center gap-3">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-attic-50 text-attic-500 dark:bg-attic-500/10 dark:text-attic-300">
                <UIcon
                  name="i-lucide-upload"
                  class="size-5"
                />
              </div>
              <div>
                <p class="text-sm font-bold text-mist-950 dark:text-white">
                  {{ t('assets.detail.noAttachments') }}
                </p>
                <p class="mt-1 max-w-xs text-sm text-muted">
                  {{ t('assets.detail.attachmentsHint') }}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
              <span>{{ t('assets.detail.dragFiles') }}</span>
              <UButton
                variant="soft"
                size="sm"
                :loading="uploading"
                @click="triggerUpload"
              >
                {{ t('assets.detail.chooseFiles') }}
              </UButton>
            </div>
          </div>
        </section>

        <AssetHistory
          :asset-id="asset.id"
          :created-at="asset.created_at"
          :updated-at="asset.updated_at"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-else
      class="flex items-center justify-center py-24"
    >
      <div class="text-center">
        <UIcon
          name="i-lucide-loader-2"
          class="w-12 h-12 animate-spin text-attic-500 mx-auto mb-4"
        />
        <p class="text-gray-500">
          {{ t('assets.detail.loading') }}
        </p>
      </div>
    </div>

    <!-- Image Gallery -->
    <UModal
      v-model:open="imageViewerOpen"
      fullscreen
      :title="imageGallery[activeImageIndex]?.name || t('assets.detail.assetImage')"
      :description="t('assets.detail.galleryDescription')"
    >
      <template #content>
        <div class="flex h-[100dvh] w-screen flex-col bg-mist-950 text-white">
          <div class="flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold">
                {{ imageGallery[activeImageIndex]?.name || asset?.name }}
              </p>
              <p class="text-xs text-white/60">
                {{ t('assets.detail.imageCount', { current: activeImageIndex + 1, total: imageGallery.length }) }}
              </p>
            </div>
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              :aria-label="t('assets.detail.closeViewer')"
              @click="imageViewerOpen = false"
            />
          </div>

          <div class="relative flex min-h-0 flex-1">
            <div class="size-full overflow-auto px-14 py-3 sm:px-20">
              <div class="flex min-h-full min-w-full items-center justify-center">
                <img
                  v-if="imageGallery[activeImageIndex]"
                  :key="imageGallery[activeImageIndex]!.url"
                  :src="imageGallery[activeImageIndex]!.url"
                  :alt="imageGallery[activeImageIndex]!.name"
                  class="max-h-full max-w-full origin-top-left select-none object-contain transition-transform duration-150"
                  :style="{ transform: `scale(${imageZoom})` }"
                >
              </div>
            </div>
            <UButton
              v-if="imageGallery.length > 1"
              variant="solid"
              color="neutral"
              icon="i-lucide-chevron-left"
              :aria-label="t('assets.detail.previousImage')"
              class="absolute left-2 top-1/2 -translate-y-1/2 sm:left-6"
              @click="showAdjacentImage(-1)"
            />
            <UButton
              v-if="imageGallery.length > 1"
              variant="solid"
              color="neutral"
              icon="i-lucide-chevron-right"
              :aria-label="t('assets.detail.nextImage')"
              class="absolute right-2 top-1/2 -translate-y-1/2 sm:right-6"
              @click="showAdjacentImage(1)"
            />
          </div>

          <div class="flex shrink-0 flex-col items-center gap-3 px-4 pb-4">
            <div class="flex items-center gap-2">
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-lucide-zoom-out"
                :aria-label="t('assets.detail.zoomOut')"
                :disabled="imageZoom <= 1"
                @click="changeImageZoom(-0.5)"
              />
              <button
                type="button"
                class="min-w-12 text-center text-xs tabular-nums text-white/70 hover:text-white"
                :aria-label="t('assets.detail.resetZoom')"
                :disabled="imageZoom === 1"
                @click="resetImageZoom"
              >
                {{ Math.round(imageZoom * 100) }}%
              </button>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-lucide-zoom-in"
                :aria-label="t('assets.detail.zoomIn')"
                :disabled="imageZoom >= 3"
                @click="changeImageZoom(0.5)"
              />
            </div>
            <div
              v-if="imageGallery.length > 1"
              class="max-w-full overflow-x-auto"
            >
              <div class="flex w-max min-w-full justify-center gap-2">
                <button
                  v-for="(image, index) in imageGallery"
                  :key="image.id"
                  type="button"
                  class="size-12 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity sm:size-14"
                  :class="index === activeImageIndex ? 'border-white' : 'border-transparent opacity-55 hover:opacity-100'"
                  :aria-label="t('assets.detail.showImage', { index: index + 1, name: image.name })"
                  :aria-current="index === activeImageIndex ? 'true' : undefined"
                  @click="selectGalleryImage(index)"
                >
                  <img
                    :src="image.url"
                    :alt="image.name"
                    class="size-full object-cover"
                  >
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete Asset Modal -->
    <UModal
      v-model:open="deleteModalOpen"
      :title="t('assets.detail.deleteAssetTitle')"
      :description="t('assets.detail.cannotUndo')"
    >
      <template #content>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <UIcon
                name="i-lucide-alert-triangle"
                class="w-6 h-6 text-red-500"
              />
            </div>
            <div>
              <h3 class="font-bold text-lg text-mist-950 dark:text-white">
                {{ t('assets.detail.deleteAssetTitle') }}
              </h3>
              <p class="text-sm text-gray-500">
                {{ t('assets.detail.cannotUndo') }}
              </p>
            </div>
          </div>
          <p class="text-gray-600 dark:text-gray-300 mb-6">
            <i18n-t
              keypath="assets.detail.deleteConfirm"
              scope="global"
            >
              <template #name>
                <strong>{{ asset?.name }}</strong>
              </template>
            </i18n-t>
          </p>
          <div class="flex justify-end gap-3">
            <UButton
              variant="ghost"
              @click="deleteModalOpen = false"
            >
              {{ t('assets.detail.cancel') }}
            </UButton>
            <UButton
              color="error"
              @click="deleteAsset"
            >
              {{ t('assets.detail.deleteAssetTitle') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Warranty Modal -->
    <UModal
      v-if="features.warranties"
      v-model:open="warrantyModalOpen"
      :title="warranty ? t('assets.detail.editWarranty') : t('assets.detail.addWarrantyTitle')"
      :description="t('assets.detail.warrantyHint')"
    >
      <template #content>
        <div class="w-full max-w-lg overflow-hidden rounded-[20px] bg-white shadow-xl dark:bg-mist-800">
          <div class="flex items-start gap-3 border-b border-mist-100 px-6 py-5 dark:border-mist-700">
            <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-attic-50 text-attic-500 dark:bg-attic-500/10">
              <UIcon
                name="i-lucide-shield-check"
                class="size-4.5"
              />
            </div>
            <div>
              <h3 class="font-extrabold text-mist-950 dark:text-white">
                {{ warranty ? t('assets.detail.editWarranty') : t('assets.detail.addWarrantyTitle') }}
              </h3>
              <p class="text-xs text-muted">
                {{ t('assets.detail.warrantyHint') }}
              </p>
            </div>
          </div>

          <form
            class="space-y-4 p-6"
            @submit.prevent="saveWarranty"
          >
            <div class="space-y-2">
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {{ t('assets.detail.provider') }}
              </label>
              <input
                v-model="warrantyForm.provider"
                type="text"
                :placeholder="t('assets.detail.providerPlaceholder')"
                class="block w-full rounded-xl border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
              >
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {{ t('assets.detail.policyNumber') }}
              </label>
              <input
                v-model="warrantyForm.policy_number"
                type="text"
                :placeholder="t('assets.detail.policyPlaceholder')"
                class="block w-full rounded-xl border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
              >
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {{ t('assets.detail.startDate') }}
                </label>
                <input
                  v-model="warrantyForm.start_date"
                  type="date"
                  class="block w-full rounded-xl border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
                >
              </div>

              <div class="space-y-2">
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {{ t('assets.detail.endDate') }}
                </label>
                <input
                  v-model="warrantyForm.end_date"
                  type="date"
                  class="block w-full rounded-xl border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
                >
              </div>
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {{ t('assets.detail.notes') }}
              </label>
              <textarea
                v-model="warrantyForm.notes"
                rows="3"
                :placeholder="t('assets.detail.notesPlaceholder')"
                class="block w-full resize-none rounded-xl border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm focus:border-attic-500 focus:ring-attic-500 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
              />
            </div>
          </form>

          <div class="flex justify-between border-t border-mist-100 bg-mist-50/60 px-6 py-4 dark:border-mist-700 dark:bg-mist-900/30">
            <UButton
              v-if="warranty"
              variant="ghost"
              color="error"
              @click="deleteWarranty(); warrantyModalOpen = false"
            >
              {{ t('assets.detail.delete') }}
            </UButton>
            <div class="flex gap-3 ml-auto">
              <UButton
                variant="ghost"
                @click="warrantyModalOpen = false"
              >
                {{ t('assets.detail.cancel') }}
              </UButton>
              <UButton @click="saveWarranty">
                {{ t('assets.detail.save') }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
