<script setup lang="ts">
import StepNavigationButtons from './StepNavigationButtons.vue'
import type { Metadata } from './upload.types'
import { useSettings } from '~/composables/useSettings'
import { useTrackerRequests, type TrackerItem } from '~/composables/useTrackerRequests'
import { useTrackerTitle } from '~/composables/useTrackerTitle'

const props = defineProps<{
    selectedTrackers: string[]
    metadata?: Metadata
    sourcePath?: string
    description?: string
}>()

const emit = defineEmits<{
    back: []
}>()

const toast = useToast()
const { getSettings, loading: settingsLoading } = useSettings()
const { uploadTorrent, loading: uploadLoading, error: uploadError } = useTrackerRequests()
const { getTitle, loading: titlesLoading } = useTrackerTitle()

const trackerNames = ref<Record<string, string>>({})
const trackerItems = ref<TrackerItem[]>([])

const canSubmit = computed(() => props.selectedTrackers.length > 0 && Boolean(props.sourcePath?.trim()) && Boolean(props.metadata))

onMounted(async () => {
    const settings = await getSettings()
    if (settings) {
        trackerNames.value = Object.fromEntries(settings.trackers.map((t) => [t.code, `${t.name} (${t.code})`]))
    }
    await loadTrackerItems()
})

watch([() => props.selectedTrackers, () => props.metadata], loadTrackerItems, { deep: true })

async function loadTrackerItems() {
    if (!props.metadata || props.selectedTrackers.length === 0) return

    const existing = Object.fromEntries(trackerItems.value.map((t) => [t.code, t]))
    trackerItems.value = await Promise.all(
        props.selectedTrackers.map(
            async (code) => existing[code] ?? { code, title: (await getTitle(code, props.metadata!)) ?? '', titleModified: false, anonymous: false, modQueueOptIn: false }
        )
    )
}

async function onSubmit() {
    if (!props.sourcePath || !props.metadata || uploadLoading.value || !canSubmit.value) return

    await uploadTorrent(props.sourcePath, props.metadata, props.description, trackerItems.value)
    if (uploadError.value) return

    toast.add({
        title: 'Upload request submitted.',
        description: 'Your torrent is queued and available from the dashboard.',
        color: 'success',
    })
    await navigateTo('/')
}
</script>

<template>
    <UCard>
        <template #header>
            <div class="space-y-2">
                <h2 class="text-lg font-medium">Review Upload</h2>
                <p class="text-sm text-muted">Review and adjust tracker-specific settings before submitting.</p>
            </div>
        </template>

        <UAlert v-if="uploadError" color="error" variant="soft" title="Failed to submit upload request. Please try again." class="mb-4" />

        <div v-if="settingsLoading || titlesLoading" class="space-y-4">
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-20 w-full" />
        </div>

        <div v-else-if="selectedTrackers.length === 0" class="text-sm text-muted">No trackers selected. Go back and select at least one tracker.</div>

        <UForm v-else :state="trackerItems" class="space-y-6" @submit="onSubmit">
            <div v-for="item in trackerItems" :key="item.code" class="rounded-xl border border-default/70 bg-elevated/30 p-4 shadow-xs space-y-4">
                <h3 class="text-sm font-semibold text-highlighted">{{ trackerNames[item.code] ?? item.code }}</h3>

                <UFormField label="Title">
                    <UInput v-model="item.title" class="w-full" :placeholder="`Title for ${item.code}`" @update:model-value="item.titleModified = true" />
                    <template v-if="item.titleModified" #help>
                        <span class="text-xs text-warning">Title modified from default</span>
                    </template>
                </UFormField>

                <UCheckbox v-model="item.anonymous" label="Upload anonymously" color="neutral" />
                <UCheckbox v-model="item.modQueueOptIn" label="Opt in to mod queue" color="neutral" />
            </div>
        </UForm>

        <StepNavigationButtons
            class="mt-5"
            :next="{ label: 'Submit Upload', disabled: !canSubmit || titlesLoading, loading: uploadLoading }"
            @back="emit('back')"
            @next="onSubmit"
        />
    </UCard>
</template>
