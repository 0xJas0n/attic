<script setup lang="ts">
const { t } = useI18n()
const { user, isOIDCEnabled, isAuthDisabled } = useAuth()
const passwordOpen = ref(false)
const signInMethod = computed(() => isAuthDisabled.value ? t('misc.profileAccount.authDisabled') : isOIDCEnabled.value ? t('misc.profileAccount.sso') : t('misc.profileAccount.emailPassword'))
</script>

<template>
  <section
    class="attic-panel overflow-hidden rounded-2xl"
    aria-labelledby="account-security-heading"
  >
    <div class="border-b border-mist-100 px-5 py-5 dark:border-mist-700 sm:px-6">
      <h2
        id="account-security-heading"
        class="text-lg font-extrabold text-mist-950 dark:text-white"
      >
        {{ t('misc.profileAccount.security') }}
      </h2>
      <p class="mt-1 text-sm leading-6 text-muted">
        {{ t('misc.profileAccount.securityBody') }}
      </p>
    </div>
    <dl class="divide-y divide-mist-100 px-5 dark:divide-mist-700 sm:px-6">
      <div
        v-if="user?.email"
        class="flex flex-col gap-1 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
      >
        <dt class="text-sm font-semibold text-mist-950 dark:text-white">
          {{ t('misc.profileAccount.emailAddress') }}
        </dt>
        <dd class="break-all text-sm text-muted">
          {{ user.email }}
        </dd>
      </div>
      <div class="flex flex-col gap-1 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <dt class="text-sm font-semibold text-mist-950 dark:text-white">
          {{ t('misc.profileAccount.signInMethod') }}
        </dt>
        <dd class="text-sm text-muted">
          {{ signInMethod }}
        </dd>
      </div>
    </dl>
    <div class="flex flex-col items-start justify-between gap-4 border-t border-mist-100 bg-mist-50/50 px-5 py-5 dark:border-mist-700 dark:bg-mist-900/30 sm:flex-row sm:items-center sm:px-6">
      <div class="max-w-md">
        <h3 class="text-sm font-bold text-mist-950 dark:text-white">
          {{ t('misc.profileAccount.password') }}
        </h3>
        <p class="mt-1 text-sm leading-6 text-muted">
          {{ isAuthDisabled ? t('misc.profileAccount.passwordDisabled') : isOIDCEnabled ? t('misc.profileAccount.passwordSso') : t('misc.profileAccount.passwordUnique') }}
        </p>
      </div>
      <UButton
        v-if="!isOIDCEnabled && !isAuthDisabled"
        variant="outline"
        icon="i-lucide-lock-keyhole"
        class="shrink-0"
        @click="passwordOpen = true"
      >
        {{ t('misc.profileAccount.changePassword') }}
      </UButton>
    </div>
    <PasswordChangeDialog
      v-if="!isOIDCEnabled && !isAuthDisabled"
      v-model:open="passwordOpen"
    />
  </section>
</template>
