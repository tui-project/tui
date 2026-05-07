<script setup lang="ts">
import * as z from 'zod'
import { ref } from 'vue'
import type { FormErrorEvent, FormSubmitEvent } from '@nuxt/ui'
import type { AppSettings } from '../composables/useSettings'

type SettingsFormState = z.output<typeof schema>

const { getSettings, saveSettings, loading, error } = useSettings()

const schema = z
    .object({
        mediaPaths: z.array(z.string()).min(1, 'At least one media path is required.'),
        tmdbApiKey: z.string().trim().min(1, 'TMDB API Key is required.'),
        imageHostProviders: z.array(z.object({ selected: z.boolean(), code: z.string(), name: z.string(), apiKey: z.string().nullable().optional() })),
        trackers: z.array(
            z.object({
                selected: z.boolean(),
                code: z.string(),
                name: z.string(),
                apiKey: z.string().nullable().optional(),
                passKey: z.string().nullable().optional(),
            })
        ),
        ffmpegPath: z.string().trim().min(1, 'FFmpeg Path is required.'),
        ffprobePath: z.string().trim().min(1, 'FFprobe Path is required.'),
        movieScreenshotCount: z.number().int().min(1, 'Movie screenshot count must be at least 1.'),
        tvEpisodeScreenshotCount: z.number().int().min(1, 'TV episode screenshot count must be at least 1.'),
    })
    .superRefine((value, ctx) => {
        const selectedImageHosts = value.imageHostProviders.filter((provider) => provider.selected)

        if (selectedImageHosts.length > 0) {
            for (const provider of selectedImageHosts) {
                const providerIndex = value.imageHostProviders.findIndex((item) => item.code === provider.code)
                if (!provider.apiKey?.trim()) {
                    ctx.addIssue({
                        code: 'custom',
                        path: ['imageHostProviders', providerIndex, 'apiKey'],
                        message: `${provider.name} API Key is required when ${provider.name} is selected.`,
                    })
                }
            }
        }

        for (const [index, tracker] of value.trackers.entries()) {
            if (!tracker?.selected) {
                continue
            }

            if (!tracker.apiKey?.trim()) {
                ctx.addIssue({ code: 'custom', path: ['trackers', index, 'apiKey'], message: `API Key is required for ${tracker.code}.` })
            }

            if (!tracker.passKey?.trim()) {
                ctx.addIssue({ code: 'custom', path: ['trackers', index, 'passKey'], message: `Pass Key is required for ${tracker.code}.` })
            }
        }
    })

const successfullySaved = ref(false)
const formState = reactive<AppSettings>({
    mediaPaths: [] as string[],
    tmdbApiKey: '',
    imageHostProviders: [] as AppSettings['imageHostProviders'],
    trackers: [] as AppSettings['trackers'],
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
    movieScreenshotCount: 6,
    tvEpisodeScreenshotCount: 3,
})

async function onError(event: FormErrorEvent) {
    successfullySaved.value = false

    const firstError = event?.errors?.[0]
    if (!firstError) {
        return
    }

    if (firstError.id) {
        const element = document.getElementById(firstError.id)
        element?.focus()
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
}

function isTrackerSelected(trackerCode: string) {
    return formState.trackers.find((tracker) => tracker.code === trackerCode)?.selected ?? false
}

function toggleTracker(trackerCode: string, checked: boolean | 'indeterminate') {
    const tracker = formState.trackers.find((item) => item.code === trackerCode)
    if (!tracker) {
        return
    }

    tracker.selected = checked === true
}

function isImageHostSelected(providerCode: string) {
    return formState.imageHostProviders.find((provider) => provider.code === providerCode)?.selected ?? false
}

function toggleImageHostProvider(providerCode: string, checked: boolean | 'indeterminate') {
    const provider = formState.imageHostProviders.find((item) => item.code === providerCode)
    if (!provider) {
        return
    }

    provider.selected = checked === true
}

async function onSubmit(event: FormSubmitEvent<SettingsFormState>) {
    successfullySaved.value = false

    const response = await saveSettings(buildSaveSettingsRequest(event.data))

    if (response) {
        formState.mediaPaths = response.mediaPaths
        formState.tmdbApiKey = response.tmdbApiKey
        formState.imageHostProviders = response.imageHostProviders
        formState.trackers = response.trackers
        formState.ffmpegPath = response.ffmpegPath
        formState.ffprobePath = response.ffprobePath
        formState.movieScreenshotCount = response.movieScreenshotCount
        formState.tvEpisodeScreenshotCount = response.tvEpisodeScreenshotCount
    }

    if (!error.value) {
        successfullySaved.value = true
    }
}

async function loadSettings() {
    const response = await getSettings()
    if (response) {
        formState.mediaPaths = response.mediaPaths
        formState.tmdbApiKey = response.tmdbApiKey
        formState.imageHostProviders = response.imageHostProviders
        formState.trackers = response.trackers
        formState.ffmpegPath = response.ffmpegPath
        formState.ffprobePath = response.ffprobePath
        formState.movieScreenshotCount = response.movieScreenshotCount
        formState.tvEpisodeScreenshotCount = response.tvEpisodeScreenshotCount
    }
}

onMounted(() => {
    loadSettings()
})

function buildSaveSettingsRequest(settings: SettingsFormState): AppSettings {
    return {
        mediaPaths: settings.mediaPaths,
        tmdbApiKey: settings.tmdbApiKey,
        imageHostProviders: settings.imageHostProviders.map((provider) => ({
            selected: provider.selected,
            code: provider.code,
            name: provider.name,
            ...(provider.selected && provider.apiKey ? { apiKey: provider.apiKey } : {}),
        })),
        trackers: settings.trackers.map((tracker) => ({
            selected: tracker.selected,
            code: tracker.code,
            name: tracker.name,
            ...(tracker.selected && tracker.apiKey ? { apiKey: tracker.apiKey } : {}),
            ...(tracker.selected && tracker.passKey ? { passKey: tracker.passKey } : {}),
        })),
        ffmpegPath: settings.ffmpegPath,
        ffprobePath: settings.ffprobePath,
        movieScreenshotCount: settings.movieScreenshotCount,
        tvEpisodeScreenshotCount: settings.tvEpisodeScreenshotCount,
    }
}
</script>

<template>
    <PageContainer>
        <PageHeader title="Settings" description="Configure settings for the application." />

        <UAlert v-if="error" color="error" variant="soft" title="Failed to load settings. Please try again." />
        <UAlert v-if="successfullySaved" color="success" variant="soft" title="Settings successfully saved." />

        <div v-if="loading" class="space-y-2">
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-20 w-full" />
        </div>

        <UForm v-else :schema="schema" :state="formState" @submit="onSubmit" @error="onError">
            <UCard title="Media paths" description="Root directory paths to access media" variant="subtle">
                <div class="space-y-3">
                    <UFormField label="Media paths" name="mediaPaths" required>
                        <UInputTags v-model="formState.mediaPaths" data-media-paths-input size="xl" class="w-full" placeholder="/path/to/media/folder" :add-on-blur="true" />
                    </UFormField>
                </div>
            </UCard>

            <UCard title="TMDB" description="API key used for metadata lookup" variant="subtle" class="mt-4">
                <UFormField label="TMDB API Key" name="tmdbApiKey" required>
                    <UInput v-model="formState.tmdbApiKey" size="xl" class="w-full" placeholder="Enter TMDB API key" />
                </UFormField>
            </UCard>

            <UCard title="Private trackers" description="Select trackers and provide the required credentials" variant="subtle" class="mt-4">
                <div class="space-y-4">
                    <div class="text-sm font-medium text-highlighted">Trackers</div>
                    <div class="space-y-4">
                        <template v-for="(tracker, index) in formState.trackers" :key="tracker.code">
                            <div class="space-y-4">
                                <UCheckbox
                                    :model-value="isTrackerSelected(tracker.code)"
                                    :label="`${tracker.name} (${tracker.code})`"
                                    :aria-label="`${tracker.name} (${tracker.code})`"
                                    @update:model-value="(checked) => toggleTracker(tracker.code, checked)"
                                />

                                <div v-if="isTrackerSelected(tracker.code)" class="space-y-4 pl-6">
                                    <UFormField label="API Key" :name="`trackers.${index}.apiKey`" required>
                                        <UInput
                                            :model-value="tracker.apiKey ?? ''"
                                            size="xl"
                                            class="w-full"
                                            :placeholder="`Enter ${tracker.code} API key`"
                                            @update:model-value="(value) => (tracker.apiKey = value)"
                                        />
                                    </UFormField>

                                    <UFormField label="Pass Key" :name="`trackers.${index}.passKey`" required>
                                        <UInput
                                            :model-value="tracker.passKey ?? ''"
                                            size="xl"
                                            class="w-full"
                                            :placeholder="`Enter ${tracker.code} pass key`"
                                            @update:model-value="(value) => (tracker.passKey = value)"
                                        />
                                    </UFormField>
                                </div>

                                <USeparator v-if="index < formState.trackers.length - 1 && isTrackerSelected(tracker.code)" />
                            </div>
                        </template>
                    </div>
                </div>
            </UCard>

            <UCard title="Screenshots" description="Configure screenshot generation and upload settings" variant="subtle" class="mt-4">
                <div class="space-y-4">
                    <div class="text-sm font-medium text-highlighted">Image Host Providers</div>
                    <template v-for="(provider, index) in formState.imageHostProviders" :key="provider.code">
                        <UCheckbox
                            :model-value="isImageHostSelected(provider.code)"
                            :label="provider.name"
                            :aria-label="provider.name"
                            @update:model-value="(checked) => toggleImageHostProvider(provider.code, checked)"
                        />

                        <UFormField v-if="isImageHostSelected(provider.code)" :label="`${provider.name} API Key`" :name="`imageHostProviders.${index}.apiKey`" required>
                            <UInput
                                :model-value="provider.apiKey ?? ''"
                                size="xl"
                                class="w-full"
                                :placeholder="`Enter ${provider.name} API key`"
                                @update:model-value="(value) => (provider.apiKey = value)"
                            />
                        </UFormField>

                        <USeparator v-if="isImageHostSelected(provider.code)" />
                    </template>

                    <UFormField label="FFmpeg Path" name="ffmpegPath" required>
                        <UInput v-model="formState.ffmpegPath" size="xl" class="w-full" placeholder="ffmpeg" />
                    </UFormField>

                    <UFormField label="FFprobe Path" name="ffprobePath" required>
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
                </div>
            </UCard>

            <div class="flex justify-end pt-4">
                <UButton size="xl" type="submit" :loading="loading" :disabled="loading"> Save </UButton>
            </div>
        </UForm>
    </PageContainer>
</template>
