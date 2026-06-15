<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
    layout: false,
})

const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/

const schema = z.object({
    username: z.string('Username is required'),
    password: z
        .string('Password is required')
        .min(8, 'Password must be at least 8 characters')
        .regex(strongPasswordPattern, 'Password must include uppercase, lowercase, number, and special character'),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
    username: undefined,
    password: undefined,
})
const { initialize, loading: isSubmitting, errorMessage } = useSetup()

const setupError = computed(() => {
    if (!errorMessage.value) {
        return ''
    }

    if (errorMessage.value === 'setup_completed') {
        return 'Setup is already completed. Please log in.'
    }

    return 'Failed to complete setup.'
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
    const setupResult = await initialize(event.data.username, event.data.password)
    if (setupResult) {
        await navigateTo('/login')
    }
}
</script>

<template>
    <div class="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <UCard class="w-full">
            <template #header>
                <AppLogo />
                <p class="mt-3 text-lg text-muted">Create your admin user account.</p>
            </template>

            <UForm :schema="schema" :state="state" class="space-y-5" @submit="onSubmit">
                <UAlert v-if="setupError" color="error" variant="soft" :title="setupError" />

                <UFormField label="Username" name="username" required>
                    <UInput v-model="state.username" placeholder="choose a username" class="w-full" icon="material-symbols:person-rounded" />
                </UFormField>

                <UFormField label="Password" name="password" required>
                    <UInput v-model="state.password" type="password" placeholder="choose a password" class="w-full" icon="qlementine-icons:password-16" />
                </UFormField>

                <UButton type="submit" :loading="isSubmitting" :disabled="isSubmitting" block icon="i-lucide-user-round-plus"> Complete setup </UButton>
            </UForm>
        </UCard>
    </div>
</template>
