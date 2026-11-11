<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const { changePassword } = useAuth()
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref(false)
const busy = ref(false)

watch(open, () => {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  error.value = ''
  success.value = false
})

async function submit() {
  if (busy.value) return
  error.value = ''
  if (newPassword.value !== confirmPassword.value) {
    error.value = t('misc.passwordDialog.mismatch')
    return
  }
  if (newPassword.value.length < 8) {
    error.value = t('misc.passwordDialog.tooShort')
    return
  }
  busy.value = true
  try {
    const result = await changePassword(currentPassword.value, newPassword.value)
    if (!result.success) {
      error.value = result.error || t('misc.passwordDialog.failed')
      return
    }
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    success.value = true
  } catch {
    error.value = t('misc.passwordDialog.failed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('misc.passwordDialog.title')"
    :description="t('misc.passwordDialog.description')"
    :dismissible="!busy"
    :close="!busy"
  >
    <template #body>
      <form
        id="profile-password-form"
        class="space-y-5"
        @submit.prevent="submit"
      >
        <UAlert
          v-if="error"
          color="error"
          :title="error"
          icon="i-lucide-alert-circle"
        />
        <UAlert
          v-if="success"
          color="success"
          :title="t('misc.passwordDialog.successTitle')"
          :description="t('misc.passwordDialog.successBody')"
          icon="i-lucide-shield-check"
        />
        <template v-else>
          <UFormField
            :label="t('misc.passwordDialog.current')"
            name="currentPassword"
          >
            <UInput
              v-model="currentPassword"
              type="password"
              autocomplete="current-password"
              class="w-full"
              size="lg"
              required
              :disabled="busy"
            />
          </UFormField>
          <UFormField
            :label="t('misc.passwordDialog.new')"
            name="newPassword"
            :help="t('misc.passwordDialog.newHelp')"
          >
            <UInput
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              class="w-full"
              size="lg"
              required
              :disabled="busy"
            />
          </UFormField>
          <UFormField
            :label="t('misc.passwordDialog.confirm')"
            name="confirmPassword"
          >
            <UInput
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              class="w-full"
              size="lg"
              required
              :disabled="busy"
            />
          </UFormField>
        </template>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          :disabled="busy"
          @click="open = false"
        >
          {{ success ? t('misc.passwordDialog.done') : t('misc.passwordDialog.cancel') }}
        </UButton>
        <UButton
          v-if="!success"
          type="submit"
          form="profile-password-form"
          :loading="busy"
          :disabled="busy || !currentPassword || !newPassword || !confirmPassword"
        >
          {{ t('misc.passwordDialog.update') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
