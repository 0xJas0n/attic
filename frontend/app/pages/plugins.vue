<script setup lang="ts">
import type { Plugin, PluginsResponse } from '~/types/api'
import { compareImportSources, importProvider, importSetupGroups, importSourceIcon, type ImportSetupGroup } from '~/utils/importSources'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const { data, status, error, refresh } = useApi<PluginsResponse>('/api/plugins')
const { features } = useFeatures()
const plugins = computed(() => data.value?.plugins || [])
const configured = computed(() => plugins.value.filter(plugin => plugin.enabled).sort(compareImportSources))
const setupGroups = computed(() => importSetupGroups(plugins.value))
const setupCount = computed(() => plugins.value.filter(plugin => !plugin.enabled).length)
const importModalOpen = ref(false)
const selectedPluginId = ref<string>()
const panelOpen = ref(false)
const detailSource = ref<Plugin | null>(null)
const setupGroup = ref<ImportSetupGroup | null>(null)
const panelTitle = computed(() => setupGroup.value ? t('admin.plugins.connectTitle', { name: setupGroup.value.provider.name }) : detailSource.value?.category_name || t('admin.plugins.sourceDetails'))
const panelDescription = computed(() => setupGroup.value
  ? t('admin.plugins.enableDescription', { label: setupGroup.value.label })
  : t('admin.plugins.sourceDescription', { name: detailSource.value ? importProvider(detailSource.value).name : t('admin.plugins.catalog') }))
let panelTrigger: HTMLElement | null = null
let pendingImport: Plugin | null = null

function showDetails(plugin: Plugin, event: MouseEvent) {
  panelTrigger = event.currentTarget as HTMLElement
  setupGroup.value = null
  detailSource.value = plugin
  panelOpen.value = true
}

function showSetup(group: ImportSetupGroup, event: MouseEvent) {
  panelTrigger = event.currentTarget as HTMLElement
  detailSource.value = null
  setupGroup.value = group
  panelOpen.value = true
}

function startImport(plugin: Plugin) {
  if (panelOpen.value) {
    pendingImport = plugin
    panelOpen.value = false
    return
  }
  selectedPluginId.value = plugin.id
  importModalOpen.value = true
}

function afterPanelClose() {
  if (pendingImport) {
    const plugin = pendingImport
    pendingImport = null
    startImport(plugin)
  }
}

function restorePanelFocus(event: Event) {
  event.preventDefault()
  panelTrigger?.focus()
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6 pb-20 sm:pb-6">
    <header>
      <p class="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-attic-500">
        {{ t('admin.plugins.eyebrow') }}
      </p>
      <h1 class="text-2xl font-extrabold tracking-[-0.04em] text-mist-950 dark:text-white md:text-3xl">
        {{ t('admin.plugins.title') }}
      </h1>
      <p class="mt-2 text-sm leading-6 text-muted">
        {{ t('admin.plugins.subtitle') }}
      </p>
    </header>

    <div
      v-if="status === 'pending'"
      role="status"
      class="attic-panel flex items-center gap-3 rounded-2xl p-6 text-sm text-muted"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="size-5 animate-spin text-attic-500"
      />
      {{ t('admin.plugins.loading') }}
    </div>
    <div
      v-else-if="error || status === 'error'"
      role="alert"
      class="attic-panel space-y-3 rounded-2xl p-6"
    >
      <h2 class="font-bold text-mist-950 dark:text-white">
        {{ t('admin.plugins.loadFailed') }}
      </h2>
      <p class="text-sm text-muted">
        {{ t('admin.plugins.loadFailedBody') }}
      </p>
      <UButton
        variant="outline"
        icon="i-lucide-refresh-cw"
        class="min-h-11"
        @click="refresh()"
      >
        {{ t('admin.plugins.tryAgain') }}
      </UButton>
    </div>
    <div
      v-else-if="plugins.length === 0"
      class="attic-panel rounded-2xl px-6 py-12 text-center"
    >
      <UIcon
        name="i-lucide-library"
        class="mb-3 size-8 text-attic-500"
      />
      <h2 class="font-bold text-mist-950 dark:text-white">
        {{ t('admin.plugins.noneTitle') }}
      </h2>
      <p class="mt-2 text-sm text-muted">
        {{ t('admin.plugins.noneBody') }}
      </p>
    </div>
    <template v-else>
      <section
        v-if="configured.length"
        aria-labelledby="configured-heading"
      >
        <div class="mb-3 flex items-center gap-2.5">
          <h2
            id="configured-heading"
            class="text-sm font-bold text-mist-800 dark:text-mist-100"
          >
            {{ t('admin.plugins.configured') }}
          </h2>
          <span class="rounded-md bg-attic-50 px-2 py-0.5 text-xs font-bold text-attic-600 dark:bg-attic-500/15 dark:text-attic-300">{{ configured.length }}</span>
        </div>
        <ul class="attic-panel divide-y divide-mist-100 overflow-hidden rounded-2xl dark:divide-mist-700/60">
          <li
            v-for="plugin in configured"
            :key="plugin.id"
            class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-mist-50/70 dark:hover:bg-mist-700/20 sm:flex-nowrap sm:gap-4 sm:px-5"
          >
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-attic-50 text-attic-500 dark:bg-attic-500/10"
              aria-hidden="true"
            >
              <UIcon
                :name="importSourceIcon(plugin)"
                class="size-5"
              />
            </div>
            <div class="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
              <h3 class="break-words text-sm font-bold leading-5 text-mist-950 dark:text-white sm:text-base">
                {{ plugin.category_name }}
              </h3>
              <p class="mt-0.5 text-xs leading-5 text-muted">
                {{ importProvider(plugin).name }}
              </p>
            </div>
            <div class="ml-[3.25rem] flex w-full items-center justify-between gap-2 sm:ml-0 sm:w-auto sm:shrink-0">
              <UButton
                color="neutral"
                variant="ghost"
                class="min-h-11 rounded-lg px-3 text-xs font-semibold text-muted"
                :aria-label="t('admin.plugins.detailsFor', { name: plugin.category_name })"
                @click="showDetails(plugin, $event)"
              >
                {{ t('admin.plugins.details') }}
              </UButton>
              <UButton
                class="min-h-11 rounded-lg px-4 font-bold"
                icon="i-lucide-download"
                :aria-label="t('admin.plugins.importName', { name: plugin.category_name })"
                @click="startImport(plugin)"
              >
                {{ t('admin.plugins.import') }}
              </UButton>
            </div>
          </li>
        </ul>
      </section>
      <section
        v-if="setupGroups.length"
        aria-labelledby="setup-heading"
      >
        <div class="mb-3 flex items-center gap-2.5">
          <h2
            id="setup-heading"
            class="text-sm font-bold text-mist-800 dark:text-mist-100"
          >
            {{ t('admin.plugins.needsSetup') }}
          </h2>
          <span class="rounded-md bg-mist-100 px-2 py-0.5 text-xs font-bold text-muted dark:bg-mist-700">{{ setupCount }}</span>
        </div>
        <p
          v-if="!configured.length"
          class="mb-3 text-sm leading-6 text-muted"
        >
          {{ t('admin.plugins.connectHint') }}
        </p>
        <ul class="attic-panel divide-y divide-mist-100 overflow-hidden rounded-2xl dark:divide-mist-700/60">
          <li
            v-for="group in setupGroups"
            :key="group.provider.id"
            class="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-4 sm:px-5"
          >
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mist-100 text-mist-500 dark:bg-mist-700 dark:text-mist-300"
              aria-hidden="true"
            >
              <UIcon
                :name="importSourceIcon(group.sources[0]!)"
                class="size-5"
              />
            </div>
            <div class="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
              <h3 class="break-words text-sm font-bold leading-5 text-mist-800 dark:text-mist-100 sm:text-base">
                {{ group.label }}
              </h3>
              <p class="mt-0.5 text-xs leading-5 text-muted">
                {{ group.provider.name }} · {{ t('admin.plugins.serverSetupRequired') }}
              </p>
            </div>
            <UButton
              color="neutral"
              variant="outline"
              class="ml-[3.25rem] min-h-11 rounded-lg text-xs font-semibold sm:ml-0 sm:shrink-0"
              :aria-label="t('admin.plugins.setupInstructionsFor', { name: group.provider.name })"
              @click="showSetup(group, $event)"
            >
              {{ t('admin.plugins.setupInstructions') }}
            </UButton>
          </li>
        </ul>
      </section>
    </template>

    <details class="group border-t border-mist-200 pt-4 dark:border-mist-700">
      <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-muted [&::-webkit-details-marker]:hidden">
        <span class="flex items-center gap-2"><UIcon
          name="i-lucide-circle-help"
          class="size-4"
        />{{ t('admin.plugins.howTitle') }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-4 transition-transform group-open:rotate-180"
        />
      </summary>
      <ol class="mt-3 grid gap-4 pb-3 sm:grid-cols-3">
        <li
          v-for="(step, index) in [
            { title: t('admin.plugins.how.find.title'), copy: t('admin.plugins.how.find.copy') },
            { title: t('admin.plugins.how.review.title'), copy: t('admin.plugins.how.review.copy') },
            { title: t('admin.plugins.how.refine.title'), copy: t('admin.plugins.how.refine.copy') }
          ]"
          :key="step.title"
          class="text-sm leading-6"
        >
          <h3 class="font-bold text-mist-800 dark:text-mist-100">
            {{ index + 1 }}. {{ step.title }}
          </h3>
          <p class="mt-1 text-muted">
            {{ step.copy }}
          </p>
        </li>
      </ol>
    </details>

    <USlideover
      v-model:open="panelOpen"
      :title="panelTitle"
      :description="panelDescription"
      :ui="{ content: 'w-full sm:max-w-lg', header: 'pr-14', title: 'break-words', footer: 'justify-between', close: 'min-h-11 min-w-11' }"
      :content="{ onCloseAutoFocus: restorePanelFocus }"
      @after:leave="afterPanelClose"
    >
      <template #body>
        <div
          v-if="detailSource"
          class="space-y-7 text-mist-800 dark:text-mist-100"
        >
          <p class="text-sm leading-6 text-muted">
            {{ detailSource.description }}
          </p>
          <section aria-labelledby="search-methods-heading">
            <h3
              id="search-methods-heading"
              class="mb-3 text-sm font-bold"
            >
              {{ t('admin.plugins.searchBy') }}
            </h3>
            <ul class="flex flex-wrap gap-2">
              <li
                v-for="field in detailSource.search_fields"
                :key="field.key"
                class="rounded-lg bg-mist-100 px-3 py-1.5 text-sm text-mist-700 dark:bg-mist-700 dark:text-mist-100"
              >
                {{ field.label }}
              </li>
            </ul>
          </section>
          <section
            v-if="features.attributes && detailSource.attributes.length"
            aria-labelledby="imported-fields-heading"
          >
            <h3
              id="imported-fields-heading"
              class="mb-3 text-sm font-bold"
            >
              {{ t('admin.plugins.importedFields') }}
            </h3>
            <dl class="divide-y divide-mist-100 dark:divide-mist-700">
              <div
                v-for="attr in detailSource.attributes"
                :key="attr.key"
                class="flex justify-between gap-4 py-2.5 text-sm"
              >
                <dt class="min-w-0 break-words">
                  {{ attr.name }}
                </dt>
                <dd class="shrink-0 capitalize text-muted">
                  {{ attr.data_type }}
                </dd>
              </div>
            </dl>
          </section>
          <section
            v-if="features.categories"
            aria-labelledby="import-category-heading"
            class="rounded-xl bg-mist-50 p-4 dark:bg-mist-800"
          >
            <h3
              id="import-category-heading"
              class="text-sm font-bold"
            >
              {{ t('admin.plugins.category') }}
            </h3>
            <p class="mt-2 text-sm text-muted">
              {{ detailSource.category_name }}
            </p>
            <p class="mt-1 text-xs leading-5 text-muted">
              {{ detailSource.category_id ? t('admin.plugins.categoryExisting') : t('admin.plugins.categoryNew') }}
            </p>
          </section>
          <p class="text-xs leading-5 text-muted">
            {{ t('admin.plugins.serverNote') }}
          </p>
        </div>
        <div
          v-else-if="setupGroup"
          class="space-y-6 text-mist-800 dark:text-mist-100"
        >
          <div class="rounded-xl bg-mist-50 p-4 dark:bg-mist-800">
            <p class="text-xs font-bold uppercase tracking-wide text-muted">
              {{ t('admin.plugins.enablesImports') }}
            </p>
            <ul class="mt-2 space-y-1 text-sm font-semibold">
              <li
                v-for="source in setupGroup.sources"
                :key="source.id"
              >
                {{ source.category_name }}
              </li>
            </ul>
          </div>
          <template v-if="setupGroup.provider.credentials.length">
            <ol class="list-decimal space-y-5 pl-5 text-sm leading-6 text-muted marker:font-bold marker:text-attic-500">
              <li>
                <p>{{ setupGroup.provider.instruction ? t(setupGroup.provider.instruction) : '' }}</p>
                <a
                  :href="setupGroup.provider.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mt-1 inline-flex min-h-11 items-center gap-1.5 font-bold text-attic-600 underline underline-offset-4 dark:text-attic-300"
                >
                  {{ setupGroup.provider.linkLabel }}<UIcon
                    name="i-lucide-arrow-up-right"
                    class="size-4"
                  />
                </a>
              </li>
              <li>
                {{ t('admin.plugins.setEnv', setupGroup.provider.credentials.length) }}
                <ul class="mt-3 space-y-2">
                  <li
                    v-for="credential in setupGroup.provider.credentials"
                    :key="credential"
                    class="rounded-lg border border-mist-200 bg-mist-50 px-3 py-2 dark:border-mist-700 dark:bg-mist-800"
                  >
                    <code class="break-all text-xs font-semibold text-mist-800 dark:text-mist-100">{{ credential }}</code>
                  </li>
                </ul>
              </li>
              <li>{{ t('admin.plugins.restart') }}</li>
            </ol>
            <p
              v-if="setupGroup.provider.note"
              class="rounded-xl border border-attic-200 bg-attic-50/60 p-4 text-sm leading-6 text-mist-700 dark:border-attic-500/30 dark:bg-attic-500/10 dark:text-mist-200"
            >
              {{ t(setupGroup.provider.note) }}
            </p>
            <p class="text-xs leading-5 text-muted">
              {{ t('admin.plugins.credentialsNote') }}
            </p>
          </template>
          <div
            v-else
            class="space-y-3 text-sm leading-6 text-muted"
          >
            <p
              v-for="source in setupGroup.sources"
              :key="source.id"
              class="break-words"
            >
              {{ source.disabled_reason || t('admin.plugins.contactAdmin') }}
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          class="min-h-11 rounded-lg"
          @click="panelOpen = false"
        >
          {{ t('admin.plugins.close') }}
        </UButton>
        <UButton
          v-if="detailSource?.enabled"
          icon="i-lucide-download"
          class="min-h-11 rounded-lg font-bold"
          :aria-label="t('admin.plugins.importName', { name: detailSource.category_name })"
          @click="startImport(detailSource)"
        >
          {{ t('admin.plugins.import') }}
        </UButton>
      </template>
    </USlideover>

    <ImportModal
      v-model:open="importModalOpen"
      :initial-plugin-id="selectedPluginId"
    />
  </div>
</template>
