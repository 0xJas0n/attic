<script setup lang="ts">
import { formatPurchasePrice } from '~/utils/currency'
import type { Asset } from '~/types/api'

const props = defineProps<{ asset: Asset, editing?: boolean, removed?: boolean }>()
const emit = defineEmits<{ remove: [], undo: [] }>()
const { t } = useI18n()
const { settings } = useOrganizationSettings()
const price = computed(() => props.asset.purchase_price == null
  ? t('assets.contentsNode.priceUnknown')
  : formatPurchasePrice(props.asset.purchase_price * props.asset.quantity, settings.value.currency))
</script>

<template>
  <li class="contents-node min-w-0">
    <div
      class="contents-row flex items-center gap-3 rounded-xl p-3"
      :class="{ 'opacity-50': removed }"
    >
      <span
        class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-mist-100 text-mist-400 dark:bg-mist-800"
        aria-hidden="true"
      ><UIcon
        name="i-lucide-package"
        class="size-4"
      /></span>
      <div class="min-w-0 flex-1">
        <NuxtLink
          :to="`/assets/${asset.id}`"
          class="break-words text-sm font-bold text-default transition-colors hover:text-attic-500"
        >{{ asset.name }}</NuxtLink>
        <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span
            v-if="asset.child_count"
            class="inline-flex items-center gap-1 text-attic-500 dark:text-attic-300"
          >
            <UIcon
              name="i-lucide-layers"
              class="size-3"
              aria-hidden="true"
            />
            {{ t('assets.contentsNode.components', { count: asset.child_count }, asset.child_count) }}
          </span>
          <span>{{ t('assets.contentsNode.qty', { count: asset.quantity }) }}</span>
          <span>{{ price }}</span>
        </div>
        <p
          v-if="removed"
          class="text-xs text-muted"
        >
          {{ t('assets.contentsNode.willDetach') }}
        </p>
      </div>
      <UButton
        v-if="editing"
        type="button"
        variant="link"
        :aria-label="removed ? t('assets.contentsNode.undoRemovalOf', { name: asset.name }) : t('assets.contentsNode.detachNamed', { name: asset.name })"
        @click="removed ? emit('undo') : emit('remove')"
      >
        {{ removed ? t('assets.contentsNode.undo') : t('assets.contentsNode.detach') }}
      </UButton>
    </div>
  </li>
</template>
