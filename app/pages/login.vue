<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
    layout: false,
})

const schema = z.object({
    username: z.string('Username is required'),
    password: z.string('Password is required'),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
    username: undefined,
    password: undefined,
})

const { login, loading: isSubmitting, errorMessage } = useLogin()

const loginError = computed(() => {
    if (!errorMessage.value) {
        return ''
    }

    if (errorMessage.value === 'invalid_credentials') {
        return 'Invalid username or password.'
    }

    return 'Failed to log in.'
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
    const loginResult = await login(event.data.username, event.data.password)

    if (loginResult) {
        await navigateTo('/')
    }
}
</script>

<template>
    <div class="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <UCard class="w-full">
            <template #header>
                <AppLogo />
                <p class="mt-3 text-lg text-muted">Sign in to continue.</p>
            </template>

            <UForm :schema="schema" :state="state" class="space-y-5" @submit="onSubmit">
                <UAlert v-if="loginError" color="error" variant="soft" :title="loginError" />

                <UFormField label="Username" name="username" required>
                    <UInput v-model="state.username" placeholder="enter your username" class="w-full" icon="material-symbols:person-rounded" />
                </UFormField>

                <UFormField label="Password" name="password" required>
                    <UInput v-model="state.password" type="password" placeholder="enter your password" class="w-full" icon="qlementine-icons:password-16" />
                </UFormField>

                <UButton type="submit" :loading="isSubmitting" :disabled="isSubmitting" block icon="i-lucide-log-in"> Log in </UButton>
            </UForm>
        </UCard>
    </div>
</template>
