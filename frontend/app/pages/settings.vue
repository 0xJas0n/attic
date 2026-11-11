<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { OrganizationFeatures, CurrencyOptionsResponse } from '~/types/api'

definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const activeTab = computed({
  get: () => route.query.tab === 'integrations' ? 'integrations' : 'inventory',
  set: (tab: string | number) => {
    void router.push({ path: '/settings', query: { ...route.query, tab: String(tab) } })
  }
})
const tabs = computed(() => [
  { label: t('admin.settings.tabs.inventory'), value: 'inventory', icon: 'i-lucide-sliders-horizontal', slot: 'inventory' as const },
  { label: t('admin.settings.tabs.integrations'), value: 'integrations', icon: 'i-lucide-plug', slot: 'integrations' as const }
] satisfies TabsItem[])
const { isAdmin, loading: authLoading, fetchSession } = useAuth()
const { features, load, update } = useFeatures()
const { settings, loaded: settingsLoaded, error: settingsError, load: loadSettings, update: updateSettings } = useOrganizationSettings()
const { data: currencyCatalog, status: currencyStatus, error: currencyError, refresh: loadCurrencies } = useApi<CurrencyOptionsResponse>(
  '/api/organization/settings/currencies', { immediate: false }
)
const currencies = computed(() => currencyCatalog.value?.currencies || [])
const currenciesReady = computed(() => currencyStatus.value === 'success' && !currencyError.value && currencies.value.length > 0)
const currencyLoadFailed = computed(() => !!currencyError.value || currencyStatus.value === 'error' || (currencyStatus.value === 'success' && currencies.value.length === 0))
// Edit a copy, so unsaved changes (e.g. the currency) don't affect other pages; it follows the saved values.
const draft = ref({ ...settings.value })
watch(settings, (saved) => {
  draft.value = { ...saved }
})
const toast = useToast()
const api = useApiFetch()
const { data: mcp, refresh: refreshMCP, status: mcpStatus, error: mcpError } = useApi<{ enabled: boolean }>('/api/organization/mcp')
const mcpSaving = ref(false)
async function setMCP(enabled: boolean) {
  mcpSaving.value = true
  try {
    await api('/api/organization/mcp', { method: 'PUT', body: JSON.stringify({ enabled }) })
    await refreshMCP()
    toast.add({ title: enabled ? t('admin.settings.mcpEnabled') : t('admin.settings.mcpDisabled'), color: 'success' })
  } catch {
    toast.add({ title: t('admin.settings.mcpUpdateFailed'), color: 'error' })
  } finally { mcpSaving.value = false }
}
const savingFeatures = ref(false)
const savingGeneral = ref(false)
const labels = computed<Array<{ key: keyof OrganizationFeatures, label: string, description: string }>>(() => [
  { key: 'locations', label: t('admin.settings.feature.locations.label'), description: t('admin.settings.feature.locations.description') },
  { key: 'collections', label: t('admin.settings.feature.collections.label'), description: t('admin.settings.feature.collections.description') },
  { key: 'tags', label: t('admin.settings.feature.tags.label'), description: t('admin.settings.feature.tags.description') },
  { key: 'categories', label: t('admin.settings.feature.categories.label'), description: t('admin.settings.feature.categories.description') },
  { key: 'conditions', label: t('admin.settings.feature.conditions.label'), description: t('admin.settings.feature.conditions.description') },
  { key: 'warranties', label: t('admin.settings.feature.warranties.label'), description: t('admin.settings.feature.warranties.description') },
  { key: 'plugins', label: t('admin.settings.feature.plugins.label'), description: t('admin.settings.feature.plugins.description') }
])

onMounted(async () => {
  if (authLoading.value) await fetchSession()
  if (!isAdmin.value) return navigateTo('/')
  // Recovers from a failed load at login, so the real currency is shown before anyone can save.
  await Promise.all([
    ...(!settingsLoaded.value ? [loadSettings()] : []),
    ...(!currenciesReady.value ? [loadCurrencies()] : [])
  ])
})

// Each section saves with one request, so a save is never half-done.
async function saveFeatures() {
  savingFeatures.value = true
  try {
    await update({
      ...features.value,
      attributes: features.value.categories
    })
    toast.add({ title: t('admin.settings.featuresSaved'), color: 'success' })
  } catch {
    await load()
    toast.add({ title: t('admin.settings.featuresSaveFailed'), color: 'error' })
  } finally {
    savingFeatures.value = false
  }
}

async function saveGeneralSettings() {
  if (savingGeneral.value || !settingsLoaded.value || !currenciesReady.value || !currencies.value.includes(draft.value.currency)) return
  savingGeneral.value = true
  try {
    await updateSettings({ ...draft.value })
    toast.add({ title: t('admin.settings.generalSaved'), color: 'success' })
  } catch {
    await loadSettings()
    draft.value = { ...settings.value }
    toast.add({ title: t('admin.settings.generalSaveFailed'), color: 'error' })
  } finally {
    savingGeneral.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
    <div>
      <h1 class="text-3xl font-black text-mist-950 dark:text-white">
        {{ t('admin.settings.title') }}
      </h1>
      <p class="text-muted mt-2">
        {{ t('admin.settings.subtitle') }}
      </p>
    </div>
    <UTabs
      v-model="activeTab"
      :items="tabs"
      variant="link"
      class="w-full gap-6"
    >
      <template #inventory>
        <div class="space-y-6">
          <UCard>
            <template #header>
              <h2 class="text-lg font-extrabold text-mist-950 dark:text-white">
                {{ t('admin.settings.features') }}
              </h2>
            </template>
            <div class="divide-y divide-mist-100 dark:divide-mist-800">
              <div
                v-for="item in labels"
                :key="item.key"
                class="py-5 first:pt-0 flex items-center justify-between gap-6"
              >
                <div>
                  <p class="font-bold text-mist-950 dark:text-white">
                    {{ item.label }}
                  </p>
                  <p class="text-sm text-muted mt-1">
                    {{ item.description }}
                  </p>
                </div>
                <USwitch
                  v-model="features[item.key]"
                  :aria-label="t('admin.settings.enableFeature', { name: item.label })"
                />
              </div>
            </div>
            <div class="mt-6 flex justify-end">
              <UButton
                :loading="savingFeatures"
                @click="saveFeatures"
              >
                {{ t('admin.settings.saveFeatures') }}
              </UButton>
            </div>
          </UCard>
          <UCard>
            <template #header>
              <h2 class="text-lg font-extrabold text-mist-950 dark:text-white">
                {{ t('admin.settings.general') }}
              </h2>
            </template>
            <div class="pb-5 flex items-center justify-between gap-6">
              <div>
                <p class="font-bold text-mist-950 dark:text-white">
                  {{ t('admin.settings.currency') }}
                </p>
                <p class="text-sm text-muted mt-1">
                  {{ t('admin.settings.currencyHint') }}
                </p>
              </div>
              <USelectMenu
                v-model="draft.currency"
                :aria-label="t('admin.settings.currencyAria')"
                :items="currencies"
                :disabled="!settingsLoaded || !currenciesReady"
                class="w-28 shrink-0"
              />
            </div>
            <p
              v-if="currencyStatus === 'pending'"
              role="status"
              class="mb-4 text-sm text-muted"
            >
              {{ t('admin.settings.loadingCurrencies') }}
            </p>
            <div
              v-else-if="currencyLoadFailed"
              role="alert"
              class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-error/10 px-4 py-3 text-sm text-error"
            >
              <span>{{ t('admin.settings.currencyLoadFailed') }}</span>
              <UButton
                size="sm"
                color="error"
                variant="soft"
                @click="loadCurrencies()"
              >
                {{ t('admin.settings.retryCurrencies') }}
              </UButton>
            </div>
            <div
              v-if="settingsError"
              role="alert"
              class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-error/10 px-4 py-3 text-sm text-error"
            >
              <span>{{ t('admin.settings.settingsLoadFailed') }}</span>
              <UButton
                size="sm"
                color="error"
                variant="soft"
                @click="loadSettings"
              >
                {{ t('admin.settings.retry') }}
              </UButton>
            </div>
            <div class="mt-6 flex justify-end">
              <UButton
                :loading="savingGeneral"
                :disabled="!settingsLoaded || !currenciesReady || !currencies.includes(draft.currency)"
                @click="saveGeneralSettings"
              >
                {{ t('admin.settings.saveSettings') }}
              </UButton>
            </div>
          </UCard>
        </div>
      </template>
      <template #integrations>
        <p class="mb-4 text-sm text-muted">
          {{ t('admin.settings.integrationsHint') }}
        </p>
        <UCard>
          <div class="flex items-center justify-between gap-6">
            <div>
              <h2 class="text-lg font-bold">
                {{ t('admin.settings.mcpServer') }}
              </h2>
              <p class="mt-1 text-sm text-muted">
                {{ t('admin.settings.mcpHint') }}
              </p>
            </div>
            <USwitch
              :model-value="mcp?.enabled ?? false"
              :disabled="mcpSaving || mcpStatus !== 'success' || !!mcpError || !mcp"
              :aria-label="t('admin.settings.mcpEnableAria')"
              @update:model-value="setMCP"
            />
          </div>
          <p
            v-if="mcpStatus === 'pending'"
            role="status"
            class="mt-4 text-sm text-muted"
          >
            {{ t('admin.settings.mcpLoading') }}
          </p>
          <UAlert
            v-else-if="mcpError"
            class="mt-4"
            color="error"
            :title="t('admin.settings.mcpLoadFailed')"
          >
            <template #actions>
              <UButton
                :label="t('admin.settings.retryLabel')"
                color="error"
                variant="outline"
                @click="refreshMCP()"
              />
            </template>
          </UAlert>
          <p
            v-else-if="mcp"
            class="mt-4 text-sm leading-6 text-muted"
          >
            {{ mcp.enabled ? t('admin.settings.mcpOnNote') : t('admin.settings.mcpOffNote') }}
          </p>
          <div class="mt-5 border-t border-mist-100 pt-5 dark:border-mist-700">
            <UButton
              to="/profile?tab=mcp"
              variant="outline"
              icon="i-lucide-arrow-up-right"
            >
              {{ t('admin.settings.viewInstructions') }}
            </UButton>
          </div>
        </UCard>
      </template>
    </UTabs>
  </div>
</template>
