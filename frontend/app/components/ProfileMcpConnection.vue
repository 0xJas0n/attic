<script setup lang="ts">
const { t } = useI18n()
const { isAdmin } = useAuth()
const config = useRuntimeConfig()
const toast = useToast()
const { data: mcp, status, error, refresh } = useApi<{ enabled: boolean }>('/api/organization/mcp')
const endpoint = computed(() => `${String(config.public.apiBase || (import.meta.client ? window.location.origin : '')).replace(/\/+$/, '')}/mcp`)
const authorization = 'Authorization: Bearer <your-api-key>'
const clientConfig = computed(() => JSON.stringify({
  mcpServers: {
    attic: { url: endpoint.value, headers: { Authorization: 'Bearer <your-api-key>' } }
  }
}, null, 2))
const copied = ref('')

async function copy(value: string, field: string) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = field
    toast.add({ title: t('misc.mcp.copied'), color: 'success' })
  } catch {
    toast.add({ title: t('misc.mcp.copyFailed'), color: 'error' })
  }
}
</script>

<template>
  <section
    class="space-y-5"
    aria-labelledby="mcp-connection-heading"
  >
    <div class="attic-panel overflow-hidden rounded-2xl">
      <div class="flex items-start justify-between gap-4 border-b border-mist-100 px-5 py-5 dark:border-mist-700 sm:px-6">
        <div>
          <h2
            id="mcp-connection-heading"
            class="text-lg font-extrabold text-mist-950 dark:text-white"
          >
            {{ t('misc.mcp.title') }}
          </h2>
          <p class="mt-1 max-w-xl text-sm leading-6 text-muted">
            {{ t('misc.mcp.subtitle') }}
          </p>
        </div>
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-refresh-cw"
          :aria-label="t('misc.mcp.refreshAria')"
          :loading="status === 'pending'"
          @click="refresh()"
        />
      </div>
      <div class="p-5 sm:p-6">
        <div
          v-if="status === 'pending' || status === 'idle'"
          role="status"
          class="flex items-center gap-3 text-sm text-muted"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-5 animate-spin"
          />
          {{ t('misc.mcp.checking') }}
        </div>
        <UAlert
          v-else-if="error || !mcp"
          color="error"
          :title="t('misc.mcp.loadErrorTitle')"
          :description="t('misc.mcp.loadErrorBody')"
        >
          <template #actions>
            <UButton
              color="error"
              variant="outline"
              :label="t('misc.mcp.retry')"
              @click="refresh()"
            />
          </template>
        </UAlert>
        <template v-else>
          <div class="flex items-start gap-3.5">
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-xl"
              :class="mcp.enabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-mist-100 text-mist-500 dark:bg-mist-700 dark:text-mist-300'"
            >
              <UIcon
                :name="mcp.enabled ? 'i-lucide-circle-check' : 'i-lucide-circle-pause'"
                class="size-5"
              />
            </div>
            <div class="min-w-0">
              <p
                class="text-sm font-bold text-mist-950 dark:text-white"
                role="status"
              >
                {{ mcp.enabled ? t('misc.mcp.enabledTitle') : t('misc.mcp.disabledTitle') }}
              </p>
              <p class="mt-1 max-w-xl text-sm leading-6 text-muted">
                {{ mcp.enabled ? t('misc.mcp.enabledBody') : t('misc.mcp.disabledBody') }}
              </p>
              <UButton
                v-if="isAdmin"
                to="/settings?tab=integrations"
                variant="link"
                class="mt-1 px-0"
                trailing-icon="i-lucide-arrow-up-right"
              >
                {{ t('misc.mcp.manage') }}
              </UButton>
            </div>
          </div>
        </template>
      </div>
    </div>

    <details
      v-if="status === 'success' && !error && mcp"
      :open="mcp.enabled"
      class="attic-panel overflow-hidden rounded-2xl"
    >
      <summary class="cursor-pointer px-5 py-5 text-sm font-bold text-mist-950 marker:text-attic-500 focus-visible:outline-2 focus-visible:outline-attic-500 dark:text-white sm:px-6">
        {{ mcp.enabled ? t('misc.mcp.setup') : t('misc.mcp.viewSetup') }}
      </summary>
      <div class="border-t border-mist-100 p-5 dark:border-mist-700 sm:p-6">
        <ol class="space-y-7">
          <li class="flex gap-3.5">
            <span
              aria-hidden="true"
              class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-attic-50 text-xs font-bold text-attic-700 dark:bg-attic-500/10 dark:text-attic-300"
            >1</span>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-bold text-mist-950 dark:text-white">
                {{ t('misc.mcp.step1Title') }}
              </h3>
              <p class="mt-1 text-sm leading-6 text-muted">
                {{ t('misc.mcp.step1Body') }}
              </p>
              <UButton
                to="/profile?tab=api-keys"
                variant="outline"
                size="sm"
                icon="i-lucide-key-round"
                class="mt-3"
              >
                {{ t('misc.mcp.step1Button') }}
              </UButton>
            </div>
          </li>
          <li class="flex gap-3.5">
            <span
              aria-hidden="true"
              class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-attic-50 text-xs font-bold text-attic-700 dark:bg-attic-500/10 dark:text-attic-300"
            >2</span>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-bold text-mist-950 dark:text-white">
                {{ t('misc.mcp.step2Title') }}
              </h3>
              <p class="mt-1 text-sm leading-6 text-muted">
                {{ t('misc.mcp.step2Body') }}
              </p>
              <dl class="mt-4 space-y-4">
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <dt class="text-muted">
                    {{ t('misc.mcp.transport') }}
                  </dt>
                  <dd class="font-semibold text-mist-950 dark:text-white">
                    Streamable HTTP
                  </dd>
                </div>
                <div>
                  <dt class="mb-1.5 text-xs font-semibold text-mist-700 dark:text-mist-200">
                    {{ t('misc.mcp.serverUrl') }}
                  </dt>
                  <dd class="flex items-start gap-2 rounded-xl border border-mist-200 bg-mist-50 p-3 dark:border-mist-700 dark:bg-mist-900/50">
                    <code class="min-w-0 flex-1 break-all py-1 text-xs leading-5 text-mist-800 dark:text-mist-100">{{ endpoint }}</code>
                    <UButton
                      :icon="copied === 'endpoint' ? 'i-lucide-check' : 'i-lucide-copy'"
                      variant="ghost"
                      color="neutral"
                      size="xs"
                      :aria-label="t('misc.mcp.copyServerUrl')"
                      @click="copy(endpoint, 'endpoint')"
                    />
                  </dd>
                </div>
                <div>
                  <dt class="mb-1.5 text-xs font-semibold text-mist-700 dark:text-mist-200">
                    {{ t('misc.mcp.authHeader') }}
                  </dt>
                  <dd class="flex items-start gap-2 rounded-xl border border-mist-200 bg-mist-50 p-3 dark:border-mist-700 dark:bg-mist-900/50">
                    <code class="min-w-0 flex-1 break-all py-1 text-xs leading-5 text-mist-800 dark:text-mist-100">{{ authorization }}</code>
                    <UButton
                      :icon="copied === 'header' ? 'i-lucide-check' : 'i-lucide-copy'"
                      variant="ghost"
                      color="neutral"
                      size="xs"
                      :aria-label="t('misc.mcp.copyAuthHeader')"
                      @click="copy(authorization, 'header')"
                    />
                  </dd>
                  <i18n-t
                    keypath="misc.mcp.replaceKey"
                    tag="p"
                    class="mt-1.5 text-xs leading-5 text-muted"
                  >
                    <template #placeholder>
                      <code>&lt;your-api-key&gt;</code>
                    </template>
                  </i18n-t>
                </div>
              </dl>
            </div>
          </li>
          <li class="flex gap-3.5">
            <span
              aria-hidden="true"
              class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-attic-50 text-xs font-bold text-attic-700 dark:bg-attic-500/10 dark:text-attic-300"
            >3</span>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-bold text-mist-950 dark:text-white">
                {{ t('misc.mcp.step3Title') }}
              </h3>
              <p class="mt-1 text-sm leading-6 text-muted">
                {{ t('misc.mcp.step3Body') }}
              </p>
            </div>
          </li>
        </ol>
        <details class="mt-6 overflow-hidden rounded-xl border border-mist-200 dark:border-mist-700">
          <summary class="cursor-pointer px-4 py-3 text-sm font-semibold text-mist-950 dark:text-white">
            {{ t('misc.mcp.jsonExample') }}
          </summary>
          <div class="border-t border-mist-100 p-4 dark:border-mist-700">
            <i18n-t
              keypath="misc.mcp.jsonNote"
              tag="p"
              class="mb-3 text-xs leading-5 text-muted"
            >
              <template #name>
                <code>mcpServers</code>
              </template>
            </i18n-t>
            <div class="overflow-hidden rounded-xl bg-mist-50 dark:bg-mist-900/50">
              <div class="flex items-center justify-between gap-3 border-b border-mist-200 px-3 py-2 dark:border-mist-700">
                <span class="text-xs font-medium text-muted">JSON</span>
                <UButton
                  :icon="copied === 'config' ? 'i-lucide-check' : 'i-lucide-copy'"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  :aria-label="t('misc.mcp.copyConfig')"
                  @click="copy(clientConfig, 'config')"
                />
              </div>
              <pre class="overflow-x-auto p-4 text-xs leading-6 text-mist-800 dark:text-mist-100"><code>{{ clientConfig }}</code></pre>
            </div>
          </div>
        </details>
        <p class="mt-5 text-xs leading-5 text-muted">
          {{ t('misc.mcp.footer') }}
        </p>
      </div>
    </details>
  </section>
</template>
