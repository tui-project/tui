<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const confirmLogoutOpen = ref(false)
const { logout, loading: isLoggingOut } = useLogout()

const items = computed<NavigationMenuItem[]>(() => [
    {
        label: 'Dashboard',
        to: '/',
        icon: 'i-lucide-home',
        active: route.path === '/',
    },
    {
        label: 'History',
        to: '/history',
        icon: 'i-lucide-history',
        active: route.path.startsWith('/history'),
    },
    {
        label: 'Upload',
        to: '/upload',
        icon: 'i-lucide-upload',
        active: route.path.startsWith('/upload'),
    },
    {
        label: 'Settings',
        to: '/settings',
        icon: 'i-lucide-settings',
        active: route.path.startsWith('/settings'),
    },
    {
        label: 'About',
        to: '/about',
        icon: 'i-lucide-box',
        active: route.path.startsWith('/about'),
    },
])

async function onConfirmLogout() {
    await logout()
    confirmLogoutOpen.value = false
    await navigateTo('/login')
}
</script>

<template>
    <UDashboardGroup :ui="{ base: 'flex flex-col overflow-hidden' }">
        <UDashboardNavbar>
            <template #title>
                <AppLogo to="/" height="h-10" />
            </template>
            <template #right>
                <UColorModeButton color="primary" />
                <UButton variant="ghost" icon="i-lucide-log-out" aria-label="Log out" @click="confirmLogoutOpen = true" />
            </template>
        </UDashboardNavbar>

        <UModal v-model:open="confirmLogoutOpen" title="Log out" description="Are you sure you want to log out?" :close="false">
            <template #footer>
                <div class="flex w-full justify-end gap-2">
                    <UButton variant="outline" @click="confirmLogoutOpen = false"> Cancel </UButton>
                    <UButton :loading="isLoggingOut" :disabled="isLoggingOut" @click="onConfirmLogout"> Log out </UButton>
                </div>
            </template>
        </UModal>

        <div class="flex h-full overflow-hidden">
            <UDashboardSidebar resizable :min-size="11" :default-size="15" :max-size="50" :ui="{ root: 'min-h-0 min-w-40', body: 'py-3' }">
                <UNavigationMenu orientation="vertical" :items="items" variant="pill" class="py-3" :ui="{ link: 'px-2 py-2 text-base', linkLeadingIcon: 'size-5' }" />
            </UDashboardSidebar>

            <UDashboardPanel>
                <template #body>
                    <div class="mx-auto w-full max-w-480">
                        <slot />
                    </div>
                </template>
            </UDashboardPanel>
        </div>
    </UDashboardGroup>
</template>
