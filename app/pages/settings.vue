<script setup lang="ts">
import * as z from 'zod'
import type { FormErrorEvent, FormSubmitEvent } from '@nuxt/ui'
import type { AppSettings } from '../composables/useSettings'

type SettingsFormState = z.output<typeof schema>

const { getSettings, saveSettings, loading, error } = useSettings()
const toast = useToast()

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
        mediainfoPath: z.string().trim().min(1, 'Mediainfo Path is required.'),
        ffmpegPath: z.string().trim().min(1, 'FFmpeg Path is required.'),
        ffprobePath: z.string().trim().min(1, 'FFprobe Path is required.'),
        movieScreenshotCount: z.number('Movie Screenshot Count is required.').int().min(1, 'Movie screenshot count must be at least 1.'),
        tvEpisodeScreenshotCount: z.number('TV Episode Screenshot Count is required.').int().min(1, 'TV episode screenshot count must be at least 1.'),
        logLevel: z.number().int().min(0).max(5),
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

const LOG_LEVEL_OPTIONS = [
    { label: 'Fatal', value: 0 },
    { label: 'Error', value: 1 },
    { label: 'Warn', value: 2 },
    { label: 'Info', value: 3 },
    { label: 'Debug', value: 4 },
    { label: 'Trace', value: 5 },
]

const formState = reactive<AppSettings>({
    mediaPaths: [] as string[],
    tmdbApiKey: '',
    imageHostProviders: [] as AppSettings['imageHostProviders'],
    trackers: [] as AppSettings['trackers'],
    mediainfoPath: 'mediainfo',
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
    movieScreenshotCount: 6,
    tvEpisodeScreenshotCount: 3,
    logLevel: 3,
})

async function onError(event: FormErrorEvent) {
    const firstError = event.errors[0]
    if (!firstError) {
        return
    }

        const element = document.getElementById(firstError.id!)
        element?.focus()
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function onSubmit(event: FormSubmitEvent<SettingsFormState>) {
    const response = await saveSettings(buildSaveSettingsRequest(event.data))

    if (error.value) {
        return
    }

    Object.assign(formState, response)

    toast.add({
        title: 'Settings successfully saved.',
        color: 'success',
    })
}

onMounted(async () => {
    const response = await getSettings()
    Object.assign(formState, response)
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
        mediainfoPath: settings.mediainfoPath,
        ffmpegPath: settings.ffmpegPath,
        ffprobePath: settings.ffprobePath,
        movieScreenshotCount: settings.movieScreenshotCount,
        tvEpisodeScreenshotCount: settings.tvEpisodeScreenshotCount,
        logLevel: settings.logLevel,
    }
}
</script>

<template>
    <PageContainer>
        <PageHeader title="Settings" description="Configure settings for the application." />
        <div v-if="loading" class="space-y-2">
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-20 w-full" />
        </div>

        <UAlert v-else-if="error" color="error" variant="soft" title="Failed to load settings. Please try again." />

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
                                <UCheckbox v-model="tracker.selected" :label="`${tracker.name} (${tracker.code})`" :aria-label="`${tracker.name} (${tracker.code})`" />

                                <div v-if="tracker.selected" class="space-y-4 pl-6">
                                    <UFormField label="API Key" :name="`trackers.${index}.apiKey`" required>
                                        <UInput v-model="tracker.apiKey" size="xl" class="w-full" :placeholder="`Enter ${tracker.code} API key`" />
                                    </UFormField>

                                    <UFormField label="Pass Key" :name="`trackers.${index}.passKey`" required>
                                        <UInput v-model="tracker.passKey" size="xl" class="w-full" :placeholder="`Enter ${tracker.code} pass key`" />
                                    </UFormField>
                                </div>

                                <USeparator v-if="index < formState.trackers.length - 1 && tracker.selected" />
                            </div>
                        </template>
                    </div>
                </div>
            </UCard>

            <UCard title="External tools" description="Paths to required system binaries" variant="subtle" class="mt-4">
                <div class="space-y-4">
                    <UFormField label="Mediainfo Path" name="mediainfoPath" required>
                        <UInput v-model="formState.mediainfoPath" size="xl" class="w-full" placeholder="mediainfo" />
                    </UFormField>

                    <UFormField label="FFmpeg Path" name="ffmpegPath" required>
                        <UInput v-model="formState.ffmpegPath" size="xl" class="w-full" placeholder="ffmpeg" />
                    </UFormField>

                    <UFormField label="FFprobe Path" name="ffprobePath" required>
                        <UInput v-model="formState.ffprobePath" size="xl" class="w-full" placeholder="ffprobe" />
                    </UFormField>
                </div>
            </UCard>

            <UCard title="Logging" description="Configure server log verbosity" variant="subtle" class="mt-4">
                <UFormField label="Log Level" name="logLevel" required>
                    <USelect
                        v-model="formState.logLevel"
                        :items="LOG_LEVEL_OPTIONS"
                        value-key="value"
                        label-key="label"
                        size="xl"
                        class="w-48"
                    />
                </UFormField>
            </UCard>

            <UCard title="Screenshots" description="Configure screenshot generation and upload settings" variant="subtle" class="mt-4">
                <div class="space-y-4">
                    <div class="text-sm font-medium text-highlighted">Image Host Providers</div>
                    <template v-for="provider in formState.imageHostProviders" :key="provider.code">
                        <UCheckbox v-model="provider.selected" :label="provider.name" :aria-label="provider.name" />

                        <UFormField
                            v-if="provider.selected"
                            :label="`${provider.name} API Key`"
                            :name="`imageHostProviders.${formState.imageHostProviders.indexOf(provider)}.apiKey`"
                            required
                        >
                            <UInput v-model="provider.apiKey" size="xl" class="w-full" :placeholder="`Enter ${provider.name} API key`" />
                        </UFormField>

                        <USeparator v-if="provider.selected" />
                    </template>

                    <div class="grid gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        <UFormField label="Movie Screenshot Count" name="movieScreenshotCount" required>
                            <UInputNumber
                                v-model="formState.movieScreenshotCount"
                                size="xl"
                                placeholder="Movie screenshot count"
                                :min="1"
                                :increment="false"
                                :decrement="false"
                                :format-options="{ useGrouping: false }"
                            />
                        </UFormField>
                        <UFormField label="Tv Episode Screenshot Count" name="tvEpisodeScreenshotCount" required>
                            <UInputNumber
                                v-model="formState.tvEpisodeScreenshotCount"
                                size="xl"
                                placeholder="Tv episode screenshot count"
                                :min="1"
                                :increment="false"
                                :decrement="false"
                                :format-options="{ useGrouping: false }"
                            />
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
