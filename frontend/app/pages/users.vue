<script setup lang="ts">
import { formatKeyLastUsed } from '~/utils/apiKeys'

definePageMeta({
  middleware: 'auth'
})

interface User {
  id: string
  email: string
  name: string | null
  role: 'user' | 'admin'
  has_password: boolean
  has_oidc: boolean
  created_at: string
  api_key_count: number
  api_key_last_used_at: string | null
}

const { t, locale } = useI18n()
const { isAdmin, fetchSession } = useAuth()
const apiFetch = useApiFetch()
const toast = useToast()

// Redirect non-admins
onMounted(() => {
  if (!isAdmin.value) {
    navigateTo('/')
  }
})

const { data: users, refresh, status } = useApi<User[]>('/api/users')

// Search
const searchQuery = ref('')
const selectedRole = ref<'all' | 'user' | 'admin'>('all')

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Filtered users
const filteredUsers = computed(() => {
  if (!users.value) return []
  const query = searchQuery.value.trim().toLowerCase()
  return users.value.filter((user) => {
    const matchesSearch = !query
      || user.email.toLowerCase().includes(query)
      || user.name?.toLowerCase().includes(query)
    const matchesRole = selectedRole.value === 'all' || user.role === selectedRole.value
    return matchesSearch && matchesRole
  })
})

// Paginated users
const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredUsers.value.slice(start, end)
})

// Total pages
const totalPages = computed(() => Math.ceil(filteredUsers.value.length / itemsPerPage.value))

// Reset to page 1 when search changes
watch([searchQuery, selectedRole], () => {
  currentPage.value = 1
})

watch(totalPages, (pages) => {
  if (currentPage.value > Math.max(1, pages)) currentPage.value = Math.max(1, pages)
})

// Pagination helpers
function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

// Stats
const stats = computed(() => {
  if (!users.value) return { total: 0, admins: 0, members: 0 }
  const admins = users.value.filter(u => u.role === 'admin').length
  return { total: users.value.length, admins, members: users.value.length - admins }
})

// Modals
const isCreateModalOpen = ref(false)
const isEditModalOpen = ref(false)
const isResetPasswordModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const selectedUser = ref<User | null>(null)
const isLoading = ref(false)
const showCreatePassword = ref(false)

// Create user form
const createForm = ref({
  email: '',
  name: '',
  password: '',
  role: 'user' as 'user' | 'admin'
})

// Edit user form
const editForm = ref({
  email: '',
  name: '',
  role: 'user' as 'user' | 'admin'
})

// Reset password form
const resetPasswordForm = ref({
  password: ''
})

const roleOptions = computed(() => [
  { label: t('admin.users.role.user'), value: 'user' as const },
  { label: t('admin.users.role.admin'), value: 'admin' as const }
])

const openCreateModal = () => {
  createForm.value = { email: '', name: '', password: '', role: 'user' }
  showCreatePassword.value = false
  isCreateModalOpen.value = true
}

const openEditModal = (user: User) => {
  selectedUser.value = user
  editForm.value = {
    email: user.email,
    name: user.name || '',
    role: user.role
  }
  isEditModalOpen.value = true
}

const openResetPasswordModal = (user: User) => {
  selectedUser.value = user
  resetPasswordForm.value = { password: '' }
  isResetPasswordModalOpen.value = true
}

const openDeleteModal = (user: User) => {
  selectedUser.value = user
  isDeleteModalOpen.value = true
}

const createUser = async () => {
  if (!createForm.value.email.trim()) {
    toast.add({ title: t('admin.users.emailRequired'), color: 'error' })
    return
  }
  if (createForm.value.password.length < 8) {
    toast.add({ title: t('admin.users.passwordMin'), color: 'error' })
    return
  }

  isLoading.value = true
  try {
    await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({ ...createForm.value, email: createForm.value.email.trim() })
    })
    toast.add({ title: t('admin.users.created'), color: 'success' })
    isCreateModalOpen.value = false
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { error?: string } }
    toast.add({ title: err?.data?.error || t('admin.users.createFailed'), color: 'error' })
  } finally {
    isLoading.value = false
  }
}

const updateUser = async () => {
  if (!selectedUser.value) return
  if (!editForm.value.email.trim()) {
    toast.add({ title: t('admin.users.emailRequired'), color: 'error' })
    return
  }

  isLoading.value = true
  try {
    await apiFetch(`/api/users/${selectedUser.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...editForm.value, email: editForm.value.email.trim() })
    })
    toast.add({ title: t('admin.users.updated'), color: 'success' })
    isEditModalOpen.value = false
    await Promise.all([refresh(), fetchSession()])
  } catch (error: unknown) {
    const err = error as { data?: { error?: string } }
    toast.add({ title: err?.data?.error || t('admin.users.updateFailed'), color: 'error' })
  } finally {
    isLoading.value = false
  }
}

const resetPassword = async () => {
  if (!selectedUser.value) return
  if (resetPasswordForm.value.password.length < 8) {
    toast.add({ title: t('admin.users.passwordMin'), color: 'error' })
    return
  }

  isLoading.value = true
  try {
    await apiFetch(`/api/users/${selectedUser.value.id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(resetPasswordForm.value)
    })
    toast.add({ title: t('admin.users.passwordReset'), color: 'success' })
    isResetPasswordModalOpen.value = false
  } catch (error: unknown) {
    const err = error as { data?: { error?: string } }
    toast.add({ title: err?.data?.error || t('admin.users.passwordResetFailed'), color: 'error' })
  } finally {
    isLoading.value = false
  }
}

const deleteUser = async () => {
  if (!selectedUser.value) return
  isLoading.value = true
  try {
    await apiFetch(`/api/users/${selectedUser.value.id}`, {
      method: 'DELETE'
    })
    toast.add({ title: t('admin.users.deleted'), color: 'success' })
    isDeleteModalOpen.value = false
    refresh()
  } catch (error: unknown) {
    const err = error as { data?: { error?: string } }
    toast.add({ title: err?.data?.error || t('admin.users.deleteFailed'), color: 'error' })
  } finally {
    isLoading.value = false
  }
}

// Get user initials
function getInitials(user: User): string {
  if (user.name) {
    const parts = user.name.split(' ')
    if (parts.length >= 2) {
      const first = parts[0]?.[0] ?? ''
      const second = parts[1]?.[0] ?? ''
      if (first && second) {
        return (first + second).toUpperCase()
      }
    }
    return user.name.substring(0, 2).toUpperCase()
  }
  return user.email.substring(0, 2).toUpperCase()
}

// Get avatar color based on user
function getAvatarColor(user: User): { bg: string, text: string } {
  const colors: Array<{ bg: string, text: string }> = [
    { bg: 'bg-attic-100 dark:bg-attic-900/30', text: 'text-attic-700 dark:text-attic-300' },
    { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
    { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
    { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
    { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
    { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300' }
  ]
  const index = user.email.charCodeAt(0) % colors.length
  return colors[index]!
}

// Get role style
function getRoleStyle(role: string): { bgColor: string, textColor: string, borderColor: string } {
  if (role === 'admin') {
    return {
      bgColor: 'bg-purple-50 dark:bg-purple-900/30',
      textColor: 'text-purple-700 dark:text-purple-300',
      borderColor: 'border-purple-100 dark:border-purple-900/50'
    }
  }
  return {
    bgColor: 'bg-mist-100 dark:bg-mist-700',
    textColor: 'text-mist-700 dark:text-mist-300',
    borderColor: 'border-mist-200 dark:border-mist-600'
  }
}

// Format relative date
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return t('admin.users.added.today')
  if (diffDays === 1) return t('admin.users.added.yesterday')
  if (diffDays < 7) return t('admin.users.added.days', { count: diffDays })
  if (diffDays < 30) return t('admin.users.added.weeks', { count: Math.floor(diffDays / 7) }, Math.floor(diffDays / 7))
  if (diffDays < 365) return t('admin.users.added.months', { count: Math.floor(diffDays / 30) }, Math.floor(diffDays / 30))
  return t('admin.users.added.years', { count: Math.floor(diffDays / 365) }, Math.floor(diffDays / 365))
}
</script>

<template>
  <div class="space-y-5 pb-6">
    <!-- Page Header -->
    <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-attic-500">
          {{ t('admin.users.eyebrow') }}
        </p>
        <h1 class="text-2xl font-extrabold tracking-[-0.04em] text-mist-950 dark:text-white md:text-3xl">
          {{ t('admin.users.title') }}
        </h1>
        <p class="mt-1 max-w-2xl text-sm text-muted">
          {{ t('admin.users.subtitle') }}
        </p>
      </div>
      <!-- Quick Stats -->
      <div class="attic-panel flex divide-x divide-mist-100 rounded-xl px-2 py-2 dark:divide-mist-700">
        <div class="px-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-muted">
              {{ t('admin.users.statTotal') }}
            </p>
            <p class="text-lg font-bold text-mist-950 dark:text-white leading-none">
              {{ stats.total }}
            </p>
          </div>
        </div>
        <div class="px-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-muted">
              {{ t('admin.users.statAdmins') }}
            </p>
            <p class="text-lg font-bold text-mist-950 dark:text-white leading-none">
              {{ stats.admins }}
            </p>
          </div>
        </div>
        <div class="px-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-muted">
              {{ t('admin.users.statMembers') }}
            </p>
            <p class="text-lg font-bold leading-none text-mist-950 dark:text-white">
              {{ stats.members }}
            </p>
          </div>
        </div>
      </div>
    </header>

    <!-- Toolbar -->
    <div class="attic-panel flex flex-col gap-3 rounded-[18px] p-3 md:flex-row md:items-center md:justify-between md:p-4">
      <!-- Search -->
      <div class="flex w-full flex-col gap-3 sm:flex-row">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          :placeholder="t('admin.users.searchPlaceholder')"
          class="w-full md:max-w-sm"
          size="lg"
        />
        <div class="flex gap-1 rounded-xl bg-mist-50 p-1 dark:bg-mist-700/60">
          <button
            v-for="role in ['all', 'user', 'admin'] as const"
            :key="role"
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors"
            :class="selectedRole === role ? 'bg-white text-attic-600 shadow-sm dark:bg-mist-800 dark:text-attic-300' : 'text-muted hover:text-mist-600'"
            @click="selectedRole = role"
          >
            {{ role === 'all' ? t('admin.users.filterAll') : role === 'user' ? t('admin.users.statMembers') : t('admin.users.statAdmins') }}
          </button>
        </div>
      </div>
      <!-- Actions -->
      <UButton
        icon="i-lucide-plus"
        class="w-full shrink-0 whitespace-nowrap rounded-xl font-bold shadow-primary md:w-auto"
        @click="openCreateModal"
      >
        {{ t('admin.users.addPerson') }}
      </UButton>
    </div>

    <!-- Data Table -->
    <div class="attic-panel overflow-hidden rounded-[20px]">
      <!-- Loading State -->
      <div
        v-if="status === 'pending'"
        class="flex items-center justify-center py-20"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-8 h-8 text-attic-500 animate-spin"
        />
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!users?.length"
        class="flex flex-col items-center justify-center py-20 px-4 text-center"
      >
        <div class="size-16 rounded-full bg-mist-100 dark:bg-mist-700 flex items-center justify-center mb-4">
          <UIcon
            name="i-lucide-users"
            class="w-8 h-8 text-muted"
          />
        </div>
        <h3 class="text-lg font-bold text-mist-950 dark:text-white mb-2">
          {{ t('admin.users.emptyTitle') }}
        </h3>
        <p class="text-sm text-muted mb-4 max-w-sm">
          {{ t('admin.users.emptyBody') }}
        </p>
        <UButton @click="openCreateModal">
          {{ t('admin.users.addUser') }}
        </UButton>
      </div>

      <!-- No Results -->
      <div
        v-else-if="!filteredUsers.length"
        class="flex flex-col items-center justify-center py-20 px-4 text-center"
      >
        <UIcon
          name="i-lucide-search-x"
          class="w-12 h-12 text-mist-300 mb-4"
        />
        <h3 class="text-lg font-bold text-mist-950 dark:text-white mb-2">
          {{ t('admin.users.noResults') }}
        </h3>
        <p class="text-sm text-muted">
          {{ t('admin.users.noMatch') }}
        </p>
        <button
          type="button"
          class="mt-2 text-sm font-semibold text-attic-500"
          @click="searchQuery = ''; selectedRole = 'all'"
        >
          {{ t('admin.users.clearFilters') }}
        </button>
      </div>

      <!-- Table -->
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[800px] border-collapse">
            <thead class="bg-mist-50/50 dark:bg-mist-700/30 border-b border-mist-100 dark:border-mist-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted">
                  {{ t('admin.users.colUser') }}
                </th>
                <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted">
                  {{ t('admin.users.colEmail') }}
                </th>
                <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted">
                  {{ t('admin.users.colRole') }}
                </th>
                <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted">
                  {{ t('admin.users.colAuth') }}
                </th>
                <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted">
                  {{ t('admin.users.colApiKeys') }}
                </th>
                <th class="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-muted">
                  {{ t('admin.users.colActions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-mist-100 dark:divide-mist-700">
              <tr
                v-for="user in paginatedUsers"
                :key="user.id"
                class="group hover:bg-mist-50/50 dark:hover:bg-mist-700/30 transition-colors"
              >
                <!-- User Details with Avatar -->
                <td class="px-6 py-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="size-10 rounded-full flex items-center justify-center font-bold text-sm"
                      :class="[getAvatarColor(user).bg, getAvatarColor(user).text]"
                    >
                      {{ getInitials(user) }}
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-mist-950 dark:text-white">
                        {{ user.name || user.email.split('@')[0] }}
                      </p>
                      <p class="text-xs text-muted">
                        {{ formatRelativeDate(user.created_at) }}
                      </p>
                    </div>
                  </div>
                </td>

                <!-- Email Address -->
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2 text-sm text-muted">
                    <UIcon
                      name="i-lucide-mail"
                      class="w-4 h-4 opacity-70"
                    />
                    {{ user.email }}
                  </div>
                </td>

                <!-- Role Badge -->
                <td class="px-6 py-4">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer"
                    :class="[getRoleStyle(user.role).bgColor, getRoleStyle(user.role).textColor, getRoleStyle(user.role).borderColor]"
                    @click="openEditModal(user)"
                  >
                    <UIcon
                      :name="user.role === 'admin' ? 'i-lucide-shield' : 'i-lucide-user'"
                      class="w-3.5 h-3.5"
                    />
                    {{ user.role === 'admin' ? t('admin.users.role.admin') : t('admin.users.role.user') }}
                  </span>
                </td>

                <!-- Auth Methods -->
                <td class="px-6 py-4">
                  <div class="flex gap-1.5">
                    <span
                      v-if="user.has_password"
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                    >
                      {{ t('admin.users.authPassword') }}
                    </span>
                    <span
                      v-if="user.has_oidc"
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    >
                      {{ t('admin.users.authOidc') }}
                    </span>
                  </div>
                </td>

                <td
                  class="px-6 py-4"
                  data-testid="user-api-key-usage"
                >
                  <p class="whitespace-nowrap text-sm font-semibold text-mist-950 dark:text-white">
                    {{ t('admin.users.activeKeys', { count: user.api_key_count || 0 }, user.api_key_count || 0) }}
                  </p>
                  <p
                    v-if="user.api_key_count"
                    class="mt-1 whitespace-nowrap text-xs text-muted"
                    :title="user.api_key_last_used_at ? new Date(user.api_key_last_used_at).toLocaleString(locale) : undefined"
                  >
                    {{ user.api_key_last_used_at ? t('admin.users.lastUsed', { when: formatKeyLastUsed(user.api_key_last_used_at) }) : t('admin.users.neverUsed') }}
                  </p>
                </td>

                <!-- Actions -->
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      class="size-8 rounded flex items-center justify-center text-muted hover:text-attic-500 hover:bg-attic-500/10 transition-colors"
                      :title="t('admin.users.resetPasswordTitle')"
                      @click="openResetPasswordModal(user)"
                    >
                      <UIcon
                        name="i-lucide-key"
                        class="w-4 h-4"
                      />
                    </button>
                    <button
                      class="size-8 rounded flex items-center justify-center text-muted hover:text-attic-500 hover:bg-attic-500/10 transition-colors"
                      :title="t('admin.users.editUser')"
                      @click="openEditModal(user)"
                    >
                      <UIcon
                        name="i-lucide-edit"
                        class="w-4 h-4"
                      />
                    </button>
                    <button
                      class="size-8 rounded flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      :title="t('admin.users.deleteUser')"
                      @click="openDeleteModal(user)"
                    >
                      <UIcon
                        name="i-lucide-trash-2"
                        class="w-4 h-4"
                      />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer with Pagination -->
        <div class="px-6 py-3 border-t border-mist-100 dark:border-mist-700 bg-mist-50/50 dark:bg-mist-700/20 flex items-center justify-between">
          <p class="text-xs text-muted">
            {{ t('admin.users.showing', { from: (currentPage - 1) * itemsPerPage + 1, to: Math.min(currentPage * itemsPerPage, filteredUsers.length), total: filteredUsers.length }) }}
            <span v-if="searchQuery && users?.length !== filteredUsers.length">
              {{ t('admin.users.filteredFrom', { total: users?.length || 0 }) }}
            </span>
          </p>
          <div
            v-if="totalPages > 1"
            class="flex items-center gap-2"
          >
            <button
              class="px-3 py-1.5 text-xs font-medium border border-mist-200 dark:border-mist-600 rounded-lg hover:bg-mist-100 dark:hover:bg-mist-700 text-mist-600 dark:text-mist-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              :disabled="currentPage === 1"
              @click="prevPage"
            >
              {{ t('admin.users.prev') }}
            </button>
            <span class="text-xs text-muted px-2">
              {{ t('admin.users.page', { page: currentPage, pages: totalPages }) }}
            </span>
            <button
              class="px-3 py-1.5 text-xs font-medium border border-mist-200 dark:border-mist-600 rounded-lg hover:bg-mist-100 dark:hover:bg-mist-700 text-mist-600 dark:text-mist-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              :disabled="currentPage === totalPages"
              @click="nextPage"
            >
              {{ t('admin.users.next') }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Create User Modal -->
    <UModal
      v-model:open="isCreateModalOpen"
      :title="t('admin.users.addModalTitle')"
      :description="t('admin.users.addModalDescription')"
    >
      <template #content>
        <div class="w-full max-w-lg overflow-hidden rounded-[22px] bg-white shadow-xl dark:bg-mist-800">
          <div class="flex items-center gap-4 border-b border-mist-100 bg-mist-50/70 px-6 py-5 dark:border-mist-700 dark:bg-mist-900/30">
            <div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-attic-500 text-white shadow-primary">
              <UIcon
                name="i-lucide-user-plus"
                class="size-5"
              />
            </div>
            <div>
              <p class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-attic-500">
                {{ t('admin.users.newAccount') }}
              </p>
              <p class="text-lg font-extrabold text-mist-950 dark:text-white">
                {{ t('admin.users.addModalHeading') }}
              </p>
              <p class="text-xs text-muted">
                {{ t('admin.users.addModalSubtitle') }}
              </p>
            </div>
          </div>

          <form
            id="create-person-form"
            class="space-y-5 p-6"
            @submit.prevent="createUser"
          >
            <div class="space-y-2">
              <label class="block text-xs font-bold uppercase tracking-wider text-muted">
                Email address <span class="text-terracotta-500">*</span>
              </label>
              <input
                v-model="createForm.email"
                type="email"
                placeholder="user@example.com"
                required
                autocomplete="email"
                class="w-full rounded-xl border border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm outline-none transition-all placeholder:text-dimmed focus:border-attic-500 focus:ring-2 focus:ring-attic-500/15 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
              >
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-bold uppercase tracking-wider text-muted">
                {{ t('admin.users.displayName') }}
              </label>
              <input
                v-model="createForm.name"
                type="text"
                :placeholder="t('admin.users.namePlaceholder')"
                autocomplete="name"
                class="w-full rounded-xl border border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm outline-none transition-all placeholder:text-dimmed focus:border-attic-500 focus:ring-2 focus:ring-attic-500/15 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
              >
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-bold uppercase tracking-wider text-muted">
                Temporary password <span class="text-terracotta-500">*</span>
              </label>
              <div class="relative">
                <input
                  v-model="createForm.password"
                  :type="showCreatePassword ? 'text' : 'password'"
                  :placeholder="t('admin.users.passwordPlaceholder')"
                  minlength="8"
                  required
                  autocomplete="new-password"
                  class="w-full rounded-xl border border-mist-200 bg-white py-3 pl-4 pr-11 text-sm text-mist-950 shadow-sm outline-none transition-all placeholder:text-dimmed focus:border-attic-500 focus:ring-2 focus:ring-attic-500/15 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
                >
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-mist-600"
                  :aria-label="showCreatePassword ? t('admin.users.hidePassword') : t('admin.users.showPassword')"
                  @click="showCreatePassword = !showCreatePassword"
                >
                  <UIcon
                    :name="showCreatePassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                    class="size-4"
                  />
                </button>
              </div>
              <p class="text-xs text-muted">
                {{ t('admin.users.passwordHint') }}
              </p>
            </div>

            <fieldset class="space-y-2">
              <legend class="text-xs font-bold uppercase tracking-wider text-muted">
                {{ t('admin.users.accessLevel') }}
              </legend>
              <div class="grid grid-cols-2 gap-3">
                <button
                  v-for="option in roleOptions"
                  :key="option.value"
                  type="button"
                  class="flex items-start gap-3 rounded-xl border p-3 text-left transition-all"
                  :class="createForm.role === option.value ? 'border-attic-500 bg-attic-50 ring-2 ring-attic-500/10 dark:bg-attic-500/10' : 'border-mist-200 hover:border-attic-300 dark:border-mist-600'"
                  :aria-pressed="createForm.role === option.value"
                  @click="createForm.role = option.value"
                >
                  <div
                    class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg"
                    :class="createForm.role === option.value ? 'bg-attic-500 text-white' : 'bg-mist-100 text-muted dark:bg-mist-700'"
                  >
                    <UIcon
                      :name="option.value === 'admin' ? 'i-lucide-shield' : 'i-lucide-user'"
                      class="size-3.5"
                    />
                  </div>
                  <div>
                    <p class="text-sm font-extrabold text-mist-900 dark:text-white">
                      {{ option.value === 'admin' ? t('admin.users.role.administrator') : t('admin.users.role.member') }}
                    </p><p class="mt-0.5 text-[11px] leading-4 text-muted">
                      {{ option.value === 'admin' ? t('admin.users.role.adminAccess') : t('admin.users.role.memberAccess') }}
                    </p>
                  </div>
                </button>
              </div>
            </fieldset>
          </form>

          <div class="flex justify-end gap-2 border-t border-mist-100 bg-mist-50/60 px-6 py-4 dark:border-mist-700 dark:bg-mist-900/30">
            <UButton
              variant="ghost"
              color="neutral"
              class="rounded-xl"
              @click="isCreateModalOpen = false"
            >
              {{ t('admin.users.cancel') }}
            </UButton>
            <UButton
              type="submit"
              form="create-person-form"
              icon="i-lucide-user-plus"
              :loading="isLoading"
              class="rounded-xl font-bold shadow-primary"
            >
              {{ t('admin.users.addPerson') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Edit User Modal -->
    <UModal
      v-model:open="isEditModalOpen"
      :title="t('admin.users.editTitle', { name: selectedUser?.name || selectedUser?.email.split('@')[0] || t('admin.users.person') })"
      :description="selectedUser?.email || t('admin.users.editDescription')"
    >
      <template #content>
        <div class="w-full max-w-lg overflow-hidden rounded-[22px] bg-white shadow-xl dark:bg-mist-800">
          <div class="flex items-center gap-4 border-b border-mist-100 bg-mist-50/70 px-6 py-5 dark:border-mist-700 dark:bg-mist-900/30">
            <div
              v-if="selectedUser"
              class="flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black"
              :class="[getAvatarColor(selectedUser).bg, getAvatarColor(selectedUser).text]"
            >
              {{ getInitials(selectedUser) }}
            </div>
            <div class="min-w-0">
              <p class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-attic-500">
                {{ t('admin.users.accountSettings') }}
              </p>
              <p class="truncate text-lg font-extrabold text-mist-950 dark:text-white">
                Edit {{ selectedUser?.name || selectedUser?.email.split('@')[0] }}
              </p>
              <p class="truncate text-xs text-muted">
                {{ selectedUser?.email }}
              </p>
            </div>
          </div>

          <form
            id="edit-person-form"
            class="space-y-5 p-6"
            @submit.prevent="updateUser"
          >
            <div class="space-y-2">
              <label class="block text-xs font-bold uppercase tracking-wider text-muted">
                {{ t('admin.users.emailAddress') }}
              </label>
              <input
                v-model="editForm.email"
                type="email"
                placeholder="user@example.com"
                required
                class="w-full rounded-xl border border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm outline-none transition-all placeholder:text-dimmed focus:border-attic-500 focus:ring-2 focus:ring-attic-500/15 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
              >
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-bold uppercase tracking-wider text-muted">
                {{ t('admin.users.displayName') }}
              </label>
              <input
                v-model="editForm.name"
                type="text"
                :placeholder="t('admin.users.namePlaceholder')"
                class="w-full rounded-xl border border-mist-200 bg-white px-4 py-3 text-sm text-mist-950 shadow-sm outline-none transition-all placeholder:text-dimmed focus:border-attic-500 focus:ring-2 focus:ring-attic-500/15 dark:border-mist-600 dark:bg-mist-800 dark:text-white"
              >
            </div>

            <fieldset class="space-y-2">
              <legend class="text-xs font-bold uppercase tracking-wider text-muted">
                {{ t('admin.users.accessLevel') }}
              </legend>
              <div class="grid grid-cols-2 gap-3">
                <button
                  v-for="option in roleOptions"
                  :key="option.value"
                  type="button"
                  class="flex items-start gap-3 rounded-xl border p-3 text-left transition-all"
                  :class="editForm.role === option.value
                    ? 'border-attic-500 bg-attic-50 ring-2 ring-attic-500/10 dark:bg-attic-500/10'
                    : 'border-mist-200 hover:border-attic-300 dark:border-mist-600'"
                  :aria-pressed="editForm.role === option.value"
                  @click="editForm.role = option.value"
                >
                  <div
                    class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg"
                    :class="editForm.role === option.value ? 'bg-attic-500 text-white' : 'bg-mist-100 text-muted dark:bg-mist-700'"
                  >
                    <UIcon
                      :name="option.value === 'admin' ? 'i-lucide-shield' : 'i-lucide-user'"
                      class="size-3.5"
                    />
                  </div>
                  <div>
                    <p class="text-sm font-extrabold text-mist-900 dark:text-white">
                      {{ option.value === 'admin' ? t('admin.users.role.administrator') : t('admin.users.role.member') }}
                    </p>
                    <p class="mt-0.5 text-[11px] leading-4 text-muted">
                      {{ option.value === 'admin' ? t('admin.users.role.adminAccess') : t('admin.users.role.memberAccess') }}
                    </p>
                  </div>
                </button>
              </div>
            </fieldset>

            <div class="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <UIcon
                name="i-lucide-info"
                class="mt-0.5 size-3.5 shrink-0"
              />
              {{ t('admin.users.roleNote') }}
            </div>
          </form>

          <div class="flex justify-end gap-2 border-t border-mist-100 bg-mist-50/60 px-6 py-4 dark:border-mist-700 dark:bg-mist-900/30">
            <UButton
              variant="ghost"
              color="neutral"
              class="rounded-xl"
              @click="isEditModalOpen = false"
            >
              {{ t('admin.users.cancel') }}
            </UButton>
            <UButton
              type="submit"
              form="edit-person-form"
              icon="i-lucide-save"
              :loading="isLoading"
              class="rounded-xl font-bold shadow-primary"
            >
              {{ t('admin.users.saveChanges') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Reset Password Modal -->
    <UModal
      v-model:open="isResetPasswordModalOpen"
      :title="t('admin.users.resetPasswordTitle')"
      :description="t('admin.users.resetDescription', { email: selectedUser?.email || t('admin.users.thisUser') })"
    >
      <template #content>
        <div class="w-full max-w-lg overflow-hidden rounded-[24px] bg-white shadow-xl ring-1 ring-mist-200/80 dark:bg-mist-800 dark:ring-mist-700">
          <div class="relative overflow-hidden bg-gradient-to-br from-attic-500 via-attic-600 to-[#174AE8] px-6 py-6 text-white sm:px-7">
            <div class="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full border-[24px] border-white/10" />
            <div class="relative flex items-start gap-4">
              <div class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <UIcon
                  name="i-lucide-key-round"
                  class="size-6"
                />
              </div>
              <div>
                <p class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/70">
                  {{ t('admin.users.accountAdmin') }}
                </p>
                <h2 class="mt-1 text-xl font-extrabold tracking-[-0.03em]">
                  {{ t('admin.users.resetPassword') }}
                </h2>
                <p class="mt-1 text-sm text-white/75">
                  {{ t('admin.users.resetSubtitle') }}
                </p>
              </div>
            </div>
          </div>

          <form
            class="space-y-5 p-6 sm:p-7"
            @submit.prevent="resetPassword"
          >
            <div class="flex items-center gap-3 rounded-2xl bg-attic-50 px-4 py-3 dark:bg-attic-500/10">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-attic-500 shadow-sm dark:bg-mist-800">
                <UIcon
                  name="i-lucide-user-round"
                  class="size-4"
                />
              </div>
              <div class="min-w-0">
                <p class="text-[11px] font-extrabold uppercase tracking-[0.12em] text-attic-600 dark:text-attic-300">
                  {{ t('admin.users.resettingFor') }}
                </p>
                <p class="truncate text-sm font-bold text-mist-800 dark:text-white">
                  {{ selectedUser?.email || t('admin.users.selectedUser') }}
                </p>
              </div>
            </div>

            <UFormField
              :label="t('admin.users.newPassword')"
              name="resetPassword"
              help="Use at least 8 characters."
            >
              <UInput
                v-model="resetPasswordForm.password"
                type="password"
                :placeholder="t('admin.users.tempPasswordPlaceholder')"
                autocomplete="new-password"
                icon="i-lucide-lock-keyhole"
                size="lg"
                required
              />
            </UFormField>

            <div class="flex flex-col-reverse gap-2 border-t border-mist-100 pt-5 sm:flex-row sm:justify-end dark:border-mist-700">
              <UButton
                type="button"
                variant="ghost"
                color="neutral"
                class="rounded-xl font-bold"
                @click="isResetPasswordModalOpen = false"
              >
                {{ t('admin.users.cancel') }}
              </UButton>
              <UButton
                type="submit"
                class="rounded-xl font-bold shadow-primary"
                :loading="isLoading"
                :disabled="isLoading || !resetPasswordForm.password"
              >
                <UIcon
                  v-if="!isLoading"
                  name="i-lucide-key-round"
                  class="size-4"
                />
                {{ t('admin.users.resetPassword') }}
              </UButton>
            </div>
          </form>
        </div>
      </template>
    </UModal>

    <!-- Delete User Modal -->
    <UModal
      v-model:open="isDeleteModalOpen"
      :title="t('admin.users.deleteUser')"
      :description="t('admin.users.deleteDescription')"
    >
      <template #content>
        <div class="w-full max-w-md rounded-[20px] bg-white p-6 shadow-xl dark:bg-mist-800">
          <div class="flex items-start gap-4">
            <div class="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <UIcon
                name="i-lucide-alert-triangle"
                class="w-6 h-6 text-red-600 dark:text-red-400"
              />
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-bold text-mist-950 dark:text-white">
                {{ t('admin.users.deleteButton') }}
              </h3>
              <p class="text-sm text-muted mt-2">
                {{ t('admin.users.deleteConfirm', { email: selectedUser?.email }) }}
              </p>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <UButton
              variant="ghost"
              color="neutral"
              @click="isDeleteModalOpen = false"
            >
              {{ t('admin.users.cancel') }}
            </UButton>
            <UButton
              color="error"
              :loading="isLoading"
              @click="deleteUser"
            >
              {{ t('admin.users.deleteButton') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
