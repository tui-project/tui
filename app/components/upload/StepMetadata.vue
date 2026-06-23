<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import StepNavigationButtons from './StepNavigationButtons.vue'
import { useGetMetadata } from '~/composables/useGetMetadata'

const props = defineProps<{ selectedPath?: Path }>()
const metadata = defineModel<{ filename: string; metadata: Metadata } | undefined>()
const prefetched = defineModel<{ filename: string; metadata: PartialMetadata } | undefined>('prefetched')
const emit = defineEmits<{
    back: []
    next: []
}>()

const filename = ref('')
const state = reactive<PartialMetadata>({
    repack: 0,
    proper: 0,
    rerip: 0,
    hybrid: false,
    hi10p: false,
    hasEnglishSubs: false,
    language: [],
    hdr: [],
    originalLanguage: '',
    imdbId: '',
})

const showMultiEpisode = ref(false)
const isTV = computed(() => state?.mediaType === MEDIA_TYPES.TV)
const isSpecial = computed(() => isTV.value && (state.season === 0 || state.episode === 0))
const isMultiEpisode = computed(() => showMultiEpisode.value)
const isWebSource = computed(() => state?.source === SOURCES.WEB)
const selectedPathLabel = computed(() => (props.selectedPath?.folder ? 'Folder' : 'File'))
const selectedPathValue = computed(() => props.selectedPath?.value)

const { pending, data, error, execute } = useGetMetadata()

onMounted(async () => {
    if (metadata.value) {
        filename.value = metadata.value.filename
        Object.assign(state, metadata.value.metadata)
        showMultiEpisode.value = state.episodeEnd !== undefined
    } else if (prefetched.value) {
        filename.value = prefetched.value.filename
        Object.assign(state, prefetched.value.metadata)
        showMultiEpisode.value = state.episodeEnd !== undefined
    } else if (selectedPathValue.value) {
        await execute(selectedPathValue.value)

        if (data.value) {
            Object.assign(state, data.value.metadata)
            filename.value = data.value.filename
            prefetched.value = data.value
            showMultiEpisode.value = state.episodeEnd !== undefined
        }
    }
})

watch(selectedPathValue, () => {
    metadata.value = undefined
    prefetched.value = undefined
})

function onToggleMultiEpisode(value: boolean) {
    showMultiEpisode.value = value
}

function onSubmit(event: FormSubmitEvent<Metadata>) {
    if (!showMultiEpisode.value) {
        event.data.episodeEnd = undefined
    }

    metadata.value = { filename: filename.value, metadata: event.data }
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
                <p v-if="selectedPathValue && !pending && !error" class="text-xs text-muted" aria-label="selected-file-or-folder">
                    {{ selectedPathLabel }}: <span class="font-medium">{{ metadata?.filename ?? filename }}</span>
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

            <div v-else-if="pending" class="space-y-2">
                <USkeleton class="h-20 w-full" />
                <USkeleton class="h-20 w-full" />
                <USkeleton class="h-20 w-full" />
            </div>

            <UForm v-else :schema="MetadataSchema" :state="state" class="space-y-5 metadata-form" @submit="onSubmit">
                <section class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">Basic Details</h3>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <UFormField label="Media Type" name="mediaType" required>
                            <USelect v-model="state.mediaType" size="xl" class="w-full" placeholder="Select media type" :items="MEDIA_TYPE_OPTIONS" />
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
                    </div>
                </section>

                <section v-if="isTV" class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">TV Details</h3>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <UFormField label="Season" name="season" required>
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

                        <UFormField name="episode" label="Episode">
                            <template #hint>
                                <USwitch :model-value="isMultiEpisode" size="sm" label="Multi-episode" aria-label="Multi-episode" @update:model-value="onToggleMultiEpisode" />
                            </template>
                            <div class="flex items-center gap-2">
                                <UInputNumber
                                    v-model="state.episode"
                                    size="xl"
                                    class="w-full"
                                    :placeholder="isMultiEpisode ? 'First' : 'Enter episode'"
                                    :aria-label="isMultiEpisode ? 'First Episode' : 'Episode'"
                                    :increment="false"
                                    :decrement="false"
                                    :format-options="{ useGrouping: false }"
                                />
                                <template v-if="isMultiEpisode">
                                    <span class="text-muted shrink-0 text-sm font-medium">–</span>
                                    <UFormField name="episodeEnd" class="w-full">
                                        <UInputNumber
                                            v-model="state.episodeEnd"
                                            size="xl"
                                            class="w-full"
                                            placeholder="Last"
                                            aria-label="Last Episode"
                                            :increment="false"
                                            :decrement="false"
                                            :format-options="{ useGrouping: false }"
                                        />
                                    </UFormField>
                                </template>
                            </div>
                        </UFormField>

                        <UFormField v-if="isSpecial" label="Special Name">
                            <UInput v-model="state.specialName" size="xl" class="w-full" placeholder="Enter special name" />
                        </UFormField>
                    </div>
                </section>

                <section class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">Source And Release</h3>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <UFormField label="Source" name="source" required>
                            <USelect v-model="state.source" size="xl" class="w-full" placeholder="Select source" :items="SOURCE_OPTIONS" />
                        </UFormField>

                        <UFormField label="Type" name="sourceType" required>
                            <USelect v-model="state.sourceType" size="xl" class="w-full" placeholder="Select type" :items="SOURCE_TYPE_OPTIONS" />
                        </UFormField>

                        <UFormField v-if="isWebSource" label="Service" required>
                            <USelect v-model="state.service" size="xl" class="w-full" placeholder="Select service" :items="SERVICE_OPTIONS" />
                        </UFormField>

                        <UFormField label="Release Group">
                            <UInput v-model="state.releaseGroup" size="xl" class="w-full" placeholder="Enter release group" />
                        </UFormField>

                        <UFormField label="Resolution" name="resolution" required>
                            <USelect v-model="state.resolution" size="xl" class="w-full" placeholder="Select resolution" :items="RESOLUTION_OPTIONS" />
                        </UFormField>

                        <UFormField label="HDR">
                            <USelect v-model="state.hdr" size="xl" class="w-full" placeholder="Select HDR" :items="HDR_OPTIONS" multiple />
                        </UFormField>

                        <UFormField label="Language" name="language" required>
                            <USelect v-model="state.language" size="xl" class="w-full" placeholder="Select language" :items="LANGUAGE_OPTIONS" multiple />
                        </UFormField>

                        <UFormField label="Original Language" name="originalLanguage">
                            <USelect v-model="state.originalLanguage" size="xl" class="w-full" :items="LANGUAGE_OPTIONS" placeholder="Select original language" />
                        </UFormField>

                        <UFormField label="Cut">
                            <USelect v-model="state.cut" size="xl" class="w-full" placeholder="Select cut" :items="CUT_OPTIONS" />
                        </UFormField>

                        <UFormField label="Ratio">
                            <USelect v-model="state.ratio" size="xl" class="w-full" placeholder="Select ratio" :items="RATIO_OPTIONS" />
                        </UFormField>

                        <UFormField label="Locale">
                            <UInput v-model="state.locale" size="xl" class="w-full" placeholder="e.g. US, KR, GB" />
                        </UFormField>

                        <UFormField label="Flags" class="md:col-span-2">
                            <div class="flex flex-wrap items-center gap-4 py-2">
                                <div class="flex items-center gap-1.5">
                                    <UCheckbox
                                        :model-value="state.repack > 0"
                                        size="xl"
                                        label="Repack"
                                        color="neutral"
                                        aria-label="Repack"
                                        @update:model-value="(v) => (state.repack = v ? 1 : 0)"
                                    />
                                    <UInput v-if="state.repack > 0" v-model.number="state.repack" type="number" size="sm" :min="1" class="w-14" aria-label="Repack number" />
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <UCheckbox
                                        :model-value="state.proper > 0"
                                        size="xl"
                                        label="Proper"
                                        color="neutral"
                                        aria-label="Proper"
                                        @update:model-value="(v) => (state.proper = v ? 1 : 0)"
                                    />
                                    <UInput v-if="state.proper > 0" v-model.number="state.proper" type="number" size="sm" :min="1" class="w-14" aria-label="Proper number" />
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <UCheckbox
                                        :model-value="state.rerip > 0"
                                        size="xl"
                                        label="ReRip"
                                        color="neutral"
                                        aria-label="ReRip"
                                        @update:model-value="(v) => (state.rerip = v ? 1 : 0)"
                                    />
                                    <UInput v-if="state.rerip > 0" v-model.number="state.rerip" type="number" size="sm" :min="1" class="w-14" aria-label="ReRip number" />
                                </div>
                                <UCheckbox v-model="state.hybrid" size="xl" label="Hybrid" color="neutral" aria-label="Hybrid" />
                                <UCheckbox
                                    v-if="state.videoCodec === VIDEO_CODECS.AVC || state.videoCodec === VIDEO_CODECS.H264 || state.videoCodec === VIDEO_CODECS.X264"
                                    v-model="state.hi10p"
                                    size="xl"
                                    label="Hi10P"
                                    color="neutral"
                                    aria-label="Hi10P"
                                />
                            </div>
                        </UFormField>
                    </div>
                </section>

                <section class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">Technical</h3>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <UFormField label="Video Codec" name="videoCodec" required>
                            <USelect v-model="state.videoCodec" size="xl" class="w-full" placeholder="Select video codec" :items="VIDEO_CODEC_OPTIONS" />
                        </UFormField>

                        <UFormField label="Audio Codec" name="audioCodec" required>
                            <USelect v-model="state.audioCodec" size="xl" class="w-full" placeholder="Select audio codec" :items="AUDIO_CODEC_OPTIONS" />
                        </UFormField>

                        <UFormField label="Audio Channels" name="audioChannels" required>
                            <USelect v-model="state.audioChannels" size="xl" class="w-full" placeholder="Select audio channels" :items="AUDIO_CHANNEL_OPTIONS" />
                        </UFormField>

                        <UFormField label="Audio Metadata">
                            <USelect v-model="state.audioMetadata" size="xl" class="w-full" placeholder="Select audio metadata" :items="AUDIO_METADATA_OPTIONS" />
                        </UFormField>

                        <UFormField label="Flags" class="md:col-span-2 lg:col-span-3">
                            <div class="flex flex-wrap items-center gap-4 py-2">
                                <UCheckbox
                                    v-if="state.originalLanguage !== LANGUAGES.EN"
                                    v-model="state.hasEnglishSubs"
                                    size="xl"
                                    label="English Subs"
                                    color="neutral"
                                    aria-label="English Subs"
                                />
                                <UCheckbox
                                    v-if="state.audioCodec === AUDIO_CODECS.TRUEHD"
                                    :model-value="state.hasTrueHDCompatibilityTrack === true"
                                    size="xl"
                                    label="TrueHD Compatibility Track"
                                    color="neutral"
                                    aria-label="TrueHD Compatibility Track"
                                    @update:model-value="(v) => (state.hasTrueHDCompatibilityTrack = v === true)"
                                />
                            </div>
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
