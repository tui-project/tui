<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const { getSettings, saveSettings, loading, error } = useSettings()
const mediaPathInput = ref('')
const alertMessage = ref('')
const successfullySaved = ref(false)
const formState = reactive({
    mediaPaths: [] as string[],
    tmdbApiKey: '',
})

const schema = z.object({
    mediaPaths: z.array(z.string()).min(1, 'At least one media path is required.'),
    tmdbApiKey: z.string(),
})

type SettingsFormState = z.output<typeof schema>

function addMediaPath() {
    const value = mediaPathInput.value.trim()
    if (!value || formState.mediaPaths.includes(value)) {
        mediaPathInput.value = ''
        return
    }

    formState.mediaPaths.push(value)
    mediaPathInput.value = ''
}

function removeMediaPath(path: string) {
    formState.mediaPaths = formState.mediaPaths.filter((item) => item !== path)
}

async function onSubmit(event: FormSubmitEvent<SettingsFormState>) {
    successfullySaved.value = false

    const response = await saveSettings({ mediaPaths: event.data.mediaPaths, tmdbApiKey: event.data.tmdbApiKey })
    if (response) {
        formState.mediaPaths = response.mediaPaths
        formState.tmdbApiKey = response.tmdbApiKey
        alertMessage.value = 'Settings successfully saved.'
        successfullySaved.value = true
    }

    if (error.value) {
        alertMessage.value = 'Unable to save settings. Please try again.'
    }
}

async function loadSettings() {
    const response = await getSettings()
    if (response) {
        formState.mediaPaths = response.mediaPaths
        formState.tmdbApiKey = response.tmdbApiKey
    }

    if (error.value) {
        alertMessage.value = 'Failed to load settings. Please try again.'
    }
}

onMounted(() => {
    loadSettings()
})
</script>

<template>
    <PageContainer>
        <PageHeader title="Settings" description="Configure settings for the application." />

        <UAlert v-if="error" color="error" variant="soft" :title="alertMessage" />
        <UAlert v-if="successfullySaved" color="success" variant="soft" :title="alertMessage" />

        <div v-if="loading" class="space-y-2">
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-20 w-full" />
        </div>

        <UForm v-else :schema="schema" :state="formState" @submit="onSubmit">
            <UCard title="Media paths" description="Root directory paths to access media" variant="subtle">
                <div class="space-y-3">
                    <UFormField name="mediaPaths">
                        <div class="flex gap-2">
                            <UInput v-model="mediaPathInput" size="xl" class="flex-1" placeholder="/path/to/media/folder" @keydown.enter.prevent="addMediaPath" />
                            <UButton size="xl" variant="outline" @click="addMediaPath">Add</UButton>
                        </div>
                    </UFormField>
                    <ul v-if="formState.mediaPaths.length > 0" class="space-y-2">
                        <li v-for="path in formState.mediaPaths" :key="path" class="flex items-center justify-between rounded-md border border-default p-2">
                            <span class="truncate pr-2 text-sm text-muted">{{ path }}</span>
                            <UButton color="error" variant="ghost" icon="i-lucide-x" :aria-label="`Remove ${path}`" @click="removeMediaPath(path)" />
                        </li>
                    </ul>
                    <div v-else class="text-sm text-muted">No media paths configured yet.</div>
                </div>
            </UCard>

            <UCard title="TMDB" description="API key used for metadata lookup" variant="subtle" class="mt-4">
                <UFormField label="TMDB API Key" name="tmdbApiKey">
                    <UInput v-model="formState.tmdbApiKey" size="xl" class="w-full" placeholder="Enter TMDB API key" />
                </UFormField>
            </UCard>

            <div class="flex justify-end pt-4">
                <UButton size="xl" type="submit" :loading="loading" :disabled="loading"> Save </UButton>
            </div>
        </UForm>
    </PageContainer>
</template>
