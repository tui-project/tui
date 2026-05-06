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
    ffmpegPath: '',
    ffprobePath: '',
    movieScreenshotCount: 6,
    tvEpisodeScreenshotCount: 3,
    imgbbApiKey: '',
})

const schema = z.object({
    mediaPaths: z.array(z.string()).min(1, 'At least one media path is required.'),
    tmdbApiKey: z.string(),
    ffmpegPath: z.string(),
    ffprobePath: z.string(),
    movieScreenshotCount: z.number().int().min(1, 'Movie screenshot count must be at least 1.'),
    tvEpisodeScreenshotCount: z.number().int().min(1, 'TV episode screenshot count must be at least 1.'),
    imgbbApiKey: z.string(),
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

    const response = await saveSettings({
        mediaPaths: event.data.mediaPaths,
        tmdbApiKey: event.data.tmdbApiKey,
        ffmpegPath: event.data.ffmpegPath,
        ffprobePath: event.data.ffprobePath,
        movieScreenshotCount: event.data.movieScreenshotCount,
        tvEpisodeScreenshotCount: event.data.tvEpisodeScreenshotCount,
        imgbbApiKey: event.data.imgbbApiKey,
    })
    if (response) {
        formState.mediaPaths = response.mediaPaths
        formState.tmdbApiKey = response.tmdbApiKey
        formState.ffmpegPath = response.ffmpegPath
        formState.ffprobePath = response.ffprobePath
        formState.movieScreenshotCount = response.movieScreenshotCount
        formState.tvEpisodeScreenshotCount = response.tvEpisodeScreenshotCount
        formState.imgbbApiKey = response.imgbbApiKey
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
        formState.ffmpegPath = response.ffmpegPath
        formState.ffprobePath = response.ffprobePath
        formState.movieScreenshotCount = response.movieScreenshotCount
        formState.tvEpisodeScreenshotCount = response.tvEpisodeScreenshotCount
        formState.imgbbApiKey = response.imgbbApiKey
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

            <UCard title="Screenshots" description="Configure screenshot generation and upload settings" variant="subtle" class="mt-4">
                <div class="space-y-4">
                    <UFormField label="FFmpeg Path" name="ffmpegPath">
                        <UInput v-model="formState.ffmpegPath" size="xl" class="w-full" placeholder="ffmpeg" />
                    </UFormField>

                    <UFormField label="FFprobe Path" name="ffprobePath">
                        <UInput v-model="formState.ffprobePath" size="xl" class="w-full" placeholder="ffprobe" />
                    </UFormField>

                    <div class="grid gap-4 md:grid-cols-2">
                        <UFormField label="Movie Screenshot Count" name="movieScreenshotCount">
                            <UInput v-model.number="formState.movieScreenshotCount" type="number" min="1" size="xl" class="w-full" placeholder="6" />
                        </UFormField>

                        <UFormField label="TV Episode Screenshot Count" name="tvEpisodeScreenshotCount">
                            <UInput v-model.number="formState.tvEpisodeScreenshotCount" type="number" min="1" size="xl" class="w-full" placeholder="3" />
                        </UFormField>
                    </div>

                    <UFormField label="ImgBB API Key" name="imgbbApiKey">
                        <UInput v-model="formState.imgbbApiKey" size="xl" class="w-full" placeholder="Enter ImgBB API key" />
                    </UFormField>
                </div>
            </UCard>

            <div class="flex justify-end pt-4">
                <UButton size="xl" type="submit" :loading="loading" :disabled="loading"> Save </UButton>
            </div>
        </UForm>
    </PageContainer>
</template>
