<script setup lang="ts">
import type { Location, LocationPhoto } from '~/types/api'
import { getLocationPhotoError } from '~/utils/locationValidation'

const props = defineProps<{ location: Location }>()
const emit = defineEmits<{ changed: [locationID: string] }>()
const config = useRuntimeConfig()
const api = useApiFetch()
const toast = useToast()
const { t } = useI18n()
interface FailedPhoto { file: File, error: string, retryable: boolean }
interface GalleryState {
  photos: LocationPhoto[]
  loading: boolean
  loaded: boolean
  error: string
  uploading: boolean
  total: number
  completed: number
  failed: FailedPhoto[]
  mutating: boolean
  request: number
}
// State lives across location selections; every request keeps its original ID.
const galleries = reactive<Record<string, GalleryState>>({})
function stateFor(id: string): GalleryState {
  galleries[id] ||= { photos: [], loading: false, loaded: false, error: '', uploading: false, total: 0, completed: 0, failed: [], mutating: false, request: 0 }
  return galleries[id]!
}
const state = computed(() => stateFor(props.location.id))
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
let dragDepth = 0
const viewerOpen = ref(false)
const viewerID = ref('')
const activeIndex = computed(() => state.value.photos.findIndex(photo => photo.id === viewerID.value))
const activePhoto = computed(() => state.value.photos[activeIndex.value])
const deleteOpen = ref(false)
const deleting = ref<{ locationID: string, photo: LocationPhoto } | null>(null)
const deleteError = ref('')
const deletingState = computed(() => deleting.value ? stateFor(deleting.value.locationID) : undefined)

async function loadPhotos(id: string) {
  const gallery = stateFor(id)
  const request = ++gallery.request
  gallery.loading = true
  gallery.error = ''
  try {
    const photos = await api<LocationPhoto[]>(`/api/locations/${id}/photos`)
    if (gallery.request === request) {
      gallery.photos = photos
      gallery.loaded = true
    }
  } catch {
    if (gallery.request === request) gallery.error = t('catalog.locationPhotos.loadFailed')
  } finally {
    if (gallery.request === request) gallery.loading = false
  }
}
watch(() => props.location.id, (id) => {
  viewerOpen.value = false
  deleteOpen.value = false
  dragging.value = false
  dragDepth = 0
  loadPhotos(id)
}, { immediate: true })

async function uploadFiles(id: string, files: File[]) {
  const gallery = stateFor(id)
  if (!files.length || gallery.uploading || gallery.mutating) return
  gallery.uploading = true
  gallery.total = files.length
  gallery.completed = 0
  let succeeded = 0
  try {
    for (const file of files) {
      const validationError = getLocationPhotoError(file, t)
      if (validationError) {
        gallery.failed.push({ file, error: validationError, retryable: false })
        gallery.completed++
        continue
      }
      try {
        const body = new FormData()
        body.append('file', file)
        const response = await fetch(`${config.public.apiBase}/api/locations/${id}/photos`, { method: 'POST', body, credentials: 'include' })
        const result = await response.json().catch(() => null)
        if (!response.ok) {
          if (response.status === 401) navigateTo('/login')
          gallery.failed.push({ file, error: result?.error || t('catalog.locationPhotos.uploadFailed'), retryable: response.status >= 500 || response.status === 429 })
        } else {
          gallery.photos.push(result as LocationPhoto)
          succeeded++
        }
      } catch {
        gallery.failed.push({ file, error: t('catalog.locationPhotos.connectionLost'), retryable: true })
      } finally { gallery.completed++ }
    }
  } finally {
    gallery.uploading = false
    if (succeeded) {
      await loadPhotos(id)
      emit('changed', id)
    }
  }
}
function chooseFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  uploadFiles(props.location.id, files)
}
function retryFailed() {
  const id = props.location.id
  const gallery = stateFor(id)
  const files = gallery.failed.filter(item => item.retryable).map(item => item.file)
  gallery.failed = gallery.failed.filter(item => !item.retryable)
  uploadFiles(id, files)
}
function dropFiles(event: DragEvent) {
  dragging.value = false
  dragDepth = 0
  uploadFiles(props.location.id, Array.from(event.dataTransfer?.files || []))
}
function dragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  dragDepth++
  dragging.value = true
}
function dragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) dragging.value = false
}
async function setCover(id: string, photoID: string, selected: boolean) {
  const gallery = stateFor(id)
  gallery.mutating = true
  try {
    await api(`/api/locations/${id}/photos/${photoID}/cover`, { method: selected ? 'PUT' : 'DELETE' })
    await loadPhotos(id)
    emit('changed', id)
  } catch {
    toast.add({ title: t('catalog.locationPhotos.coverFailed'), color: 'error' })
  } finally { gallery.mutating = false }
}
function photoActions(photo: LocationPhoto) {
  const id = props.location.id
  return [
    { label: photo.is_cover ? t('catalog.locationPhotos.removeCover') : t('catalog.locationPhotos.setCover'), icon: photo.is_cover ? 'i-lucide-star-off' : 'i-lucide-star', onSelect: () => setCover(id, photo.id, !photo.is_cover) },
    { label: t('catalog.locationPhotos.deletePhoto'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => {
      deleting.value = { locationID: id, photo }
      deleteError.value = ''
      deleteOpen.value = true
    } }
  ]
}
async function deletePhoto() {
  if (!deleting.value) return
  const { locationID: id, photo } = deleting.value
  const gallery = stateFor(id)
  gallery.mutating = true
  deleteError.value = ''
  try {
    await api(`/api/locations/${id}/photos/${photo.id}`, { method: 'DELETE' })
    const index = gallery.photos.findIndex(item => item.id === photo.id)
    gallery.photos = gallery.photos.filter(item => item.id !== photo.id)
    await loadPhotos(id)
    if (viewerID.value === photo.id) viewerID.value = gallery.photos[Math.min(index, gallery.photos.length - 1)]?.id || ''
    if (!gallery.photos.length) viewerOpen.value = false
    deleteOpen.value = false
    emit('changed', id)
  } catch {
    deleteError.value = t('catalog.locationPhotos.deleteFailed')
  } finally { gallery.mutating = false }
}
function openPhoto(photo: LocationPhoto) {
  viewerID.value = photo.id
  viewerOpen.value = true
}
function adjacentPhoto(direction: number) {
  const photos = state.value.photos
  if (photos.length < 2) return
  viewerID.value = photos[(activeIndex.value + direction + photos.length) % photos.length]!.id
}
function viewerKeydown(event: KeyboardEvent) {
  if (!viewerOpen.value) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    adjacentPhoto(event.key === 'ArrowLeft' ? -1 : 1)
  }
}
onMounted(() => window.addEventListener('keydown', viewerKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', viewerKeydown))
</script>

<template>
  <section
    class="relative rounded-2xl border p-4 transition-colors sm:p-5"
    :class="dragging ? 'border-attic-500 bg-attic-50 dark:bg-attic-500/10' : 'border-mist-200 dark:border-mist-700'"
    :aria-label="t('catalog.locationPhotos.sectionLabel')"
    @dragenter.prevent="dragEnter"
    @dragover.prevent
    @dragleave.prevent="dragLeave"
    @drop.prevent="dropFiles"
  >
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-extrabold text-mist-950 dark:text-white">
          {{ t('catalog.locationPhotos.title') }}
        </h2>
        <span class="rounded-md bg-mist-100 px-2 py-0.5 text-xs text-muted dark:bg-mist-700">{{ state.photos.length }}</span>
      </div>
      <div class="flex items-center gap-1">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          size="sm"
          :aria-label="t('catalog.locationPhotos.refresh')"
          :disabled="state.loading || state.uploading || state.mutating"
          @click="loadPhotos(location.id)"
        />
        <UButton
          icon="i-lucide-plus"
          :disabled="state.loading || state.uploading || state.mutating"
          @click="fileInput?.click()"
        >
          {{ t('catalog.locationPhotos.add') }}
        </UButton>
      </div>
      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif"
        :aria-label="t('catalog.locationPhotos.addInput')"
        class="sr-only"
        :disabled="state.loading || state.uploading || state.mutating"
        @change="chooseFiles"
      >
    </header>
    <div
      v-if="state.uploading"
      class="mb-4 rounded-xl bg-mist-50 p-3 text-xs text-muted dark:bg-mist-900/50"
      role="status"
    >
      <p>{{ t('catalog.locationPhotos.uploading', { current: Math.min(state.completed + 1, state.total), total: state.total }) }}</p>
      <progress
        :value="state.completed"
        :max="state.total"
        :aria-label="t('catalog.locationPhotos.progress')"
        class="mt-2 h-1.5 w-full accent-attic-500"
      />
    </div>
    <div
      v-if="state.failed.length"
      class="mb-4 rounded-xl border border-amber-200 p-3 dark:border-amber-800"
      role="alert"
    >
      <p class="text-sm font-semibold text-mist-950 dark:text-white">
        {{ t('catalog.locationPhotos.someFailed') }}
      </p>
      <ul class="mt-2 space-y-2">
        <li
          v-for="(failure, index) in state.failed"
          :key="index"
          class="flex items-start justify-between gap-2 text-xs text-muted"
        >
          <p class="min-w-0">
            <span class="break-all font-semibold">{{ failure.file.name }}</span> — {{ failure.error }}
          </p>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            size="xs"
            :aria-label="t('catalog.locationPhotos.dismiss', { name: failure.file.name })"
            :disabled="state.uploading"
            @click="state.failed.splice(index, 1)"
          />
        </li>
      </ul>
      <UButton
        v-if="state.failed.some(item => item.retryable)"
        class="mt-3"
        size="sm"
        color="neutral"
        variant="outline"
        :disabled="state.uploading || state.mutating"
        @click="retryFailed"
      >
        {{ t('catalog.locationPhotos.retry') }}
      </UButton>
    </div>
    <div
      v-if="state.error"
      class="mb-4 text-sm text-red-600 dark:text-red-400"
      role="alert"
    >
      {{ state.error }} <button
        type="button"
        class="font-semibold underline"
        @click="loadPhotos(location.id)"
      >
        {{ t('common.tryAgain') }}
      </button>
    </div>
    <div
      v-if="state.loading && !state.loaded"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3"
      :aria-label="t('catalog.locationPhotos.loading')"
    >
      <USkeleton
        v-for="index in 3"
        :key="index"
        class="aspect-[4/3] w-full rounded-xl"
      />
    </div>
    <div
      v-else-if="state.photos.length"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      <article
        v-for="(photo, index) in state.photos"
        :key="photo.id"
        class="min-w-0 overflow-hidden rounded-xl border border-mist-200 dark:border-mist-700"
        :data-photo-id="photo.id"
      >
        <button
          type="button"
          class="relative block aspect-[4/3] w-full overflow-hidden bg-mist-100 focus-visible:outline-2 focus-visible:outline-attic-500 dark:bg-mist-900"
          :aria-label="t('catalog.locationPhotos.viewPhoto', { index: index + 1, name: photo.file_name })"
          :disabled="!photo.url"
          @click="openPhoto(photo)"
        >
          <img
            v-if="photo.url"
            :src="photo.url"
            :alt="photo.file_name"
            loading="lazy"
            class="size-full object-cover"
            data-testid="location-photo"
          >
          <UIcon
            v-else
            name="i-lucide-image-off"
            class="size-6 text-muted"
          />
          <span
            v-if="photo.is_cover"
            class="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-mist-950/80 px-2 py-1 text-[10px] font-bold text-white"
          ><UIcon
            name="i-lucide-star"
            class="size-3"
          />{{ t('catalog.locationPhotos.cover') }}</span>
        </button>
        <div class="flex items-center justify-between gap-1 px-2 py-1.5">
          <span
            class="truncate text-xs text-muted"
            :title="photo.file_name"
          >{{ photo.file_name }}</span>
          <UDropdownMenu :items="photoActions(photo)">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis"
              size="sm"
              :aria-label="t('catalog.locationPhotos.actionsFor', { name: photo.file_name })"
              :disabled="state.uploading || state.mutating"
            />
          </UDropdownMenu>
        </div>
      </article>
    </div>
    <div
      v-else-if="!state.error && !state.loading"
      class="rounded-xl border border-dashed border-mist-200 px-4 py-8 text-center dark:border-mist-600"
    >
      <UIcon
        name="i-lucide-images"
        class="mb-2 size-7 text-mist-400"
      />
      <p class="text-sm font-semibold text-mist-950 dark:text-white">
        {{ t('catalog.locationPhotos.emptyTitle') }}
      </p>
      <p class="mt-1 text-xs leading-5 text-muted">
        {{ t('catalog.locationPhotos.emptyBody') }}
      </p>
    </div>
    <p class="mt-3 text-xs text-muted">
      {{ t('catalog.locationPhotos.limits') }}
    </p>
    <div
      v-if="dragging"
      class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-attic-50/90 text-sm font-bold text-attic-600 dark:bg-mist-900/90 dark:text-attic-300"
    >
      {{ t('catalog.locationPhotos.drop') }}
    </div>
  </section>

  <UModal
    v-model:open="viewerOpen"
    fullscreen
    :title="activePhoto?.file_name || t('catalog.locationPhotos.viewerTitle')"
    :description="t('catalog.locationPhotos.viewerHint')"
  >
    <template #content>
      <div class="flex h-dvh w-screen flex-col bg-mist-950 text-white">
        <header class="flex shrink-0 items-center justify-between gap-4 p-4 sm:px-6">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold">
              {{ activePhoto?.file_name }}
            </p><p class="mt-1 text-xs text-white/60">
              {{ t('catalog.locationPhotos.position', { index: activeIndex + 1, total: state.photos.length }) }}
            </p>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            class="text-white hover:bg-white/10"
            :aria-label="t('catalog.locationPhotos.closeViewer')"
            @click="viewerOpen = false"
          />
        </header>
        <div class="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-6 sm:px-20">
          <img
            v-if="activePhoto?.url"
            :src="activePhoto.url"
            :alt="activePhoto.file_name"
            class="max-h-full max-w-full object-contain"
            data-testid="location-photo-viewer"
          >
          <UButton
            v-if="state.photos.length > 1"
            color="neutral"
            variant="ghost"
            icon="i-lucide-chevron-left"
            class="absolute left-2 top-1/2 text-white hover:bg-white/10 sm:left-6"
            :aria-label="t('catalog.locationPhotos.previous')"
            @click="adjacentPhoto(-1)"
          />
          <UButton
            v-if="state.photos.length > 1"
            color="neutral"
            variant="ghost"
            icon="i-lucide-chevron-right"
            class="absolute right-2 top-1/2 text-white hover:bg-white/10 sm:right-6"
            :aria-label="t('catalog.locationPhotos.next')"
            @click="adjacentPhoto(1)"
          />
        </div>
      </div>
    </template>
  </UModal>
  <UModal
    v-model:open="deleteOpen"
    :title="t('catalog.locationPhotos.deleteTitle')"
    :description="t('catalog.locationPhotos.deleteBody', { name: deleting?.photo.file_name || t('catalog.locationPhotos.thisPhoto') })"
    :dismissible="!deletingState?.mutating"
  >
    <template #body>
      <p
        v-if="deleteError"
        role="alert"
        class="text-sm text-red-600 dark:text-red-400"
      >
        {{ deleteError }}
      </p><p
        v-else
        class="text-sm text-muted"
      >
        {{ t('catalog.locationPhotos.deleteNote') }}
      </p>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="deletingState?.mutating"
          @click="deleteOpen = false"
        >
          {{ t('catalog.shared.cancel') }}
        </UButton><UButton
          color="error"
          :loading="deletingState?.mutating"
          @click="deletePhoto"
        >
          {{ t('catalog.locationPhotos.deletePhoto') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
