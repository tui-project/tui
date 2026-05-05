<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Metadata, Path } from './upload.types'
import StepNavigationButtons from './StepNavigationButtons.vue'
import { useMetadata } from '~/composables/useMetadata'

type SelectOption = {
    label: string
    value: string
}

type Schema = z.output<typeof schema>

const props = defineProps<{ selectedPath?: Path }>()
const metadata = defineModel<Metadata | undefined>()
const emit = defineEmits<{
    back: []
    next: []
}>()

const mediaTypeOptions: SelectOption[] = [
    { label: 'Movie', value: 'movie' },
    { label: 'TV', value: 'tv' },
]

const sourceOptions: SelectOption[] = [
    { label: 'Web', value: 'Web' },
    { label: 'BluRay', value: 'BluRay' },
    { label: 'DVD', value: 'DVD' },
]

const sourceTypeOptions: SelectOption[] = [
    { label: 'Remux', value: 'REMUX' },
    { label: 'Encode', value: 'ENCODE' },
    { label: 'Web-DL', value: 'WEB-DL' },
    { label: 'WebRip', value: 'WEBRIP' },
    { label: 'HDTV', value: 'HDTV' },
]

const serviceOptions: SelectOption[] = [
    { label: 'NF', value: 'NF' },
    { label: 'AMZN', value: 'AMZN' },
    { label: 'DSNP', value: 'DSNP' },
    { label: 'HMAX', value: 'HMAX' },
    { label: 'HULU', value: 'HULU' },
    { label: 'ATVP', value: 'ATVP' },
    { label: 'PMTP', value: 'PMTP' },
    { label: 'MY5', value: 'MY5' },
    { label: 'iT', value: 'iT' },
]

const resolutionOptions: SelectOption[] = [
    { label: '480i', value: '480i' },
    { label: '480p', value: '480p' },
    { label: '576i', value: '576i' },
    { label: '576p', value: '576p' },
    { label: '720p', value: '720p' },
    { label: '1080i', value: '1080i' },
    { label: '1080p', value: '1080p' },
    { label: '2160p', value: '2160p' },
]

const hdrOptions: SelectOption[] = [
    { label: 'DV', value: 'DV' },
    { label: 'HDR10+', value: 'HDR10+' },
    { label: 'HDR', value: 'HDR' },
    { label: 'HLG', value: 'HLG' },
]

const cutOptions: SelectOption[] = [
    { label: `Director's Cut`, value: `Director's Cut` },
    { label: 'Extended', value: 'Extended' },
    { label: 'Special Edition', value: 'Special Edition' },
    { label: 'Unrated', value: 'Unrated' },
    { label: '3D', value: '3D' },
    { label: 'Super Duper Cut', value: 'Super Duper Cut' },
]

const videoCodecOptions: SelectOption[] = [
    { label: 'MPEG-2', value: 'MPEG-2' },
    { label: 'VC-1', value: 'VC-1' },
    { label: 'AVC', value: 'AVC' },
    { label: 'H.264', value: 'H.264' },
    { label: 'HEVC', value: 'HEVC' },
    { label: 'x264', value: 'x264' },
    { label: 'x265', value: 'x265' },
]

const audioCodecOptions: SelectOption[] = [
    { label: 'AAC', value: 'AAC' },
    { label: 'Opus', value: 'Opus' },
    { label: 'DD', value: 'DD' },
    { label: 'DD+', value: 'DD+' },
    { label: 'TrueHD', value: 'TrueHD' },
    { label: 'DTS', value: 'DTS' },
    { label: 'DTS-HD MA', value: 'DTS-HD MA' },
    { label: 'DTS:X', value: 'DTS:X' },
    { label: 'FLAC', value: 'FLAC' },
]

const audioChannelOptions: SelectOption[] = [
    { label: '1.0', value: '1.0' },
    { label: '2.0', value: '2.0' },
    { label: '2.1', value: '2.1' },
    { label: '3.0', value: '3.0' },
    { label: '3.1', value: '3.1' },
    { label: '4.0', value: '4.0' },
    { label: '4.1', value: '4.1' },
    { label: '5.0', value: '5.0' },
    { label: '5.1', value: '5.1' },
    { label: '6.1', value: '6.1' },
    { label: '7.1', value: '7.1' },
]

const audioMetadataOptions: SelectOption[] = [
    { label: 'Atmos', value: 'Atmos' },
    { label: 'Auro3D', value: 'Auro3D' },
]

const languageOptions: SelectOption[] = [
    { value: 'ar', label: 'Arabic' },
    { value: 'da', label: 'Danish' },
    { value: 'de', label: 'German' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fi', label: 'Finnish' },
    { value: 'fr', label: 'French' },
    { value: 'hi', label: 'Hindi' },
    { value: 'it', label: 'Italian' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'nl', label: 'Dutch' },
    { value: 'no', label: 'Norwegian' },
    { value: 'pl', label: 'Polish' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ru', label: 'Russian' },
    { value: 'sv', label: 'Swedish' },
    { value: 'ta', label: 'Tamil' },
    { value: 'th', label: 'Thai' },
    { value: 'tr', label: 'Turkish' },
    { value: 'zh', label: 'Chinese' },
]

const requiredString = (message: string) => z.string().trim().min(1, message)
const requiredNumber = (message: string) => z.number().nullable().refine((value) => value !== null, message)

const schema = z
    .object({
        mediaType: z
            .string()
            .trim()
            .refine((value) => value === 'movie' || value === 'tv', {
                message: 'Media type is required',
            }),
        title: requiredString('Title is required'),
        year: requiredNumber('Year is required'),
        source: requiredString('Source is required'),
        sourceType: requiredString('Type is required'),
        resolution: requiredString('Resolution is required'),
        language: z.array(z.string().trim().min(1)).min(1, 'Language is required'),
        originalLanguage: requiredString('Original language is required'),
        videoCodec: requiredString('Video codec is required'),
        audioCodec: requiredString('Audio codec is required'),
        audioChannels: requiredString('Audio channels are required'),
        tmdbId: requiredNumber('TMDb ID is required'),
        imdbId: requiredString('IMDb ID is required'),
        season: z.number().nullable(),
        tvdbId: z.number().nullable(),
    })
    .superRefine((value, ctx) => {
        if (value.mediaType === 'tv') {
            if (value.season === null) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['season'],
                    message: 'Season is required',
                })
            }
            if (value.tvdbId === null) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['tvdbId'],
                    message: 'TVDB ID is required',
                })
            }
        }
    })

const state = reactive<Metadata>({
    fileName: '',
    releaseGroup: '',
    mediaType: '',
    title: '',
    originalTitle: '',
    year: null,
    season: null,
    episode: null,
    language: [],
    originalLanguage: '',
    sourceType: '',
    source: '',
    service: '',
    repack: false,
    proper: false,
    cut: '',
    hybrid: false,
    resolution: '',
    hdr: [],
    videoCodec: '',
    audioCodec: '',
    audioChannels: '',
    audioMetadata: '',
    tmdbId: null,
    imdbId: '',
    tvdbId: null,
})

const { getMetadata, loading, error } = useMetadata()
const isTV = computed(() => state?.mediaType === 'tv')
const isWebSource = computed(() => state?.source === 'Web')
const selectedPathLabel = computed(() => (props.selectedPath?.folder ? 'Folder' : 'File'))
const selectedPathValue = computed(() => props.selectedPath?.value)

onMounted(async () => {
    const path = selectedPathValue.value

    if (!path) {
        return
    }

    if (metadata.value?.fileName) {
        Object.assign(state, metadata.value)
        return
    }

    const data = await getMetadata(path)
    Object.assign(state, data)
    metadata.value = state
})

watch(
    () => selectedPathValue.value,
    () => {
        metadata.value = undefined
    }
)

function onSubmit(_: FormSubmitEvent<Schema>) {
    metadata.value = state
    emit('next')
}
</script>

<template>
    <UCard>
        <template #header>
            <div class="space-y-2">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h2 class="text-lg font-semibold tracking-tight">Review Metadata</h2>
                        <p class="text-sm text-muted">Detected metadata is editable. Update anything before continuing.</p>
                    </div>
                </div>
                <p v-if="selectedPathValue && !loading && !error" class="text-xs text-muted" aria-label="selected-file-or-folder">
                    {{ selectedPathLabel }}: <span class="font-medium">{{ state?.fileName || 'Unknown file' }}</span>
                </p>
            </div>
        </template>

        <div class="space-y-5">
            <UAlert v-if="!selectedPathValue" color="neutral" variant="soft" title="Select a source path first" description="Go back to Step 1 and choose a file or folder." />

            <UAlert
                v-else-if="error"
                color="error"
                variant="soft"
                title="Failed to detect media information."
                description="Please check the selected path or fill metadata manually."
            />

            <div v-else-if="loading" class="space-y-2">
                <USkeleton class="h-20 w-full" />
                <USkeleton class="h-20 w-full" />
                <USkeleton class="h-20 w-full" />
            </div>

            <UForm v-else :schema="schema" :state="state" class="space-y-5 metadata-form" @submit="onSubmit">
                <section class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">Basic Details</h3>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <UFormField label="Media Type" name="mediaType" required>
                            <USelect v-model="state.mediaType" size="xl" class="w-full" placeholder="Select media type" :items="mediaTypeOptions" />
                        </UFormField>

                        <UFormField label="Title" name="title" required>
                            <UInput v-model="state.title" size="xl" class="w-full" placeholder="Enter title" />
                        </UFormField>

                        <UFormField label="Original Title">
                            <UInput v-model="state.originalTitle" size="xl" class="w-full" placeholder="Enter original title" />
                        </UFormField>

                        <UFormField label="Year" name="year" required>
                            <UInputNumber
                                v-model="state.year"
                                size="xl"
                                class="w-full"
                                placeholder="Enter year"
                                :increment="false"
                                :decrement="false"
                                :format-options="{ useGrouping: false }"
                            />
                        </UFormField>

                        <UFormField v-if="isTV" label="Season" name="season" required>
                            <UInputNumber
                                v-model="state.season"
                                size="xl"
                                class="w-full"
                                placeholder="Enter season"
                                :increment="false"
                                :decrement="false"
                                :format-options="{ useGrouping: false }"
                            />
                        </UFormField>

                        <UFormField v-if="isTV" label="Episode">
                            <UInputNumber
                                v-model="state.episode"
                                size="xl"
                                class="w-full"
                                placeholder="Enter episode"
                                :increment="false"
                                :decrement="false"
                                :format-options="{ useGrouping: false }"
                            />
                        </UFormField>
                    </div>
                </section>

                <section class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">Source And Release</h3>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <UFormField label="Source" name="source" required>
                            <USelect v-model="state.source" size="xl" class="w-full" placeholder="Select source" :items="sourceOptions" />
                        </UFormField>

                        <UFormField label="Type" name="sourceType" required>
                            <USelect v-model="state.sourceType" size="xl" class="w-full" placeholder="Select type" :items="sourceTypeOptions" />
                        </UFormField>

                        <UFormField v-if="isWebSource" label="Service" required>
                            <USelect v-model="state.service" size="xl" class="w-full" placeholder="Select service" :items="serviceOptions" />
                        </UFormField>

                        <UFormField label="Release Group">
                            <UInput v-model="state.releaseGroup" size="xl" class="w-full" placeholder="Enter release group" />
                        </UFormField>

                        <UFormField label="Resolution" name="resolution" required>
                            <USelect v-model="state.resolution" size="xl" class="w-full" placeholder="Select resolution" :items="resolutionOptions" />
                        </UFormField>

                        <UFormField label="HDR">
                            <USelect v-model="state.hdr" size="xl" class="w-full" placeholder="Select HDR" :items="hdrOptions" multiple />
                        </UFormField>

                        <UFormField label="Language" name="language" required>
                            <USelect v-model="state.language" size="xl" class="w-full" placeholder="Select language" :items="languageOptions" multiple />
                        </UFormField>

                        <UFormField label="Original Language" name="originalLanguage">
                            <USelect v-model="state.originalLanguage" size="xl" class="w-full" :items="languageOptions" placeholder="Select original language" />
                        </UFormField>

                        <UFormField label="Cut">
                            <USelect v-model="state.cut" size="xl" class="w-full" placeholder="Select cut" :items="cutOptions" />
                        </UFormField>

                        <UFormField label="Flags" class="md:col-span-2">
                            <div class="flex flex-wrap items-center gap-4 py-2">
                                <UCheckbox v-model="state.repack" size="xl" label="Repack" color="neutral" aria-label="Repack" />
                                <UCheckbox v-model="state.proper" size="xl" label="Proper" color="neutral" aria-label="Proper" />
                                <UCheckbox v-model="state.hybrid" size="xl" label="Hybrid" color="neutral" aria-label="Hybrid" />
                            </div>
                        </UFormField>
                    </div>
                </section>

                <section class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">Technical</h3>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <UFormField label="Video Codec" name="videoCodec" required>
                            <USelect v-model="state.videoCodec" size="xl" class="w-full" placeholder="Select video codec" :items="videoCodecOptions" />
                        </UFormField>

                        <UFormField label="Audio Codec" name="audioCodec" required>
                            <USelect v-model="state.audioCodec" size="xl" class="w-full" placeholder="Select audio codec" :items="audioCodecOptions" />
                        </UFormField>

                        <UFormField label="Audio Channels" name="audioChannels" required>
                            <USelect v-model="state.audioChannels" size="xl" class="w-full" placeholder="Select audio channels" :items="audioChannelOptions" />
                        </UFormField>

                        <UFormField label="Audio Metadata">
                            <USelect v-model="state.audioMetadata" size="xl" class="w-full" placeholder="Select audio metadata" :items="audioMetadataOptions" />
                        </UFormField>
                    </div>
                </section>

                <section class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">External IDs</h3>
                    <div class="grid gap-4 md:grid-cols-3">
                        <UFormField label="TMDb ID" name="tmdbId" required>
                            <UInputNumber
                                v-model="state.tmdbId"
                                size="xl"
                                class="w-full"
                                placeholder="Enter TMDb ID"
                                :increment="false"
                                :decrement="false"
                                :format-options="{ useGrouping: false }"
                            />
                        </UFormField>

                        <UFormField label="IMDb ID" name="imdbId" required>
                            <UInput v-model="state.imdbId" size="xl" class="w-full" placeholder="Enter IMDb ID" />
                        </UFormField>

                        <UFormField v-if="isTV" label="TVDB ID" name="tvdbId" required>
                            <UInputNumber
                                v-model="state.tvdbId"
                                size="xl"
                                class="w-full"
                                placeholder="Enter TVDb ID"
                                :increment="false"
                                :decrement="false"
                                :format-options="{ useGrouping: false }"
                            />
                        </UFormField>
                    </div>
                </section>
                <StepNavigationButtons :next="{ type: 'submit' }" @back="emit('back')" />
            </UForm>
        </div>
    </UCard>
</template>
