<script setup lang="ts">
import StepNavigationButtons from './StepNavigationButtons.vue'
import type { Metadata } from './upload.types'
import { useSettings } from '~/composables/useSettings'

const selectedTrackers = defineModel<string[]>({ default: [] })
const props = defineProps<{
    sourcePath?: string
    metadata?: Metadata
    description?: string
}>()

const emit = defineEmits<{
    back: []
}>()

const { getSettings, loading, error } = useSettings()
const trackers = ref<Array<{ name: string; code: string }>>([])
const hasRequiredData = computed(() => Boolean(props.sourcePath?.trim()) && Boolean(props.metadata))
const canUpload = computed(() => trackers.value.length > 0 && selectedTrackers.value.length > 0 && hasRequiredData.value)

onMounted(async () => {
    await loadTrackers()
})

async function loadTrackers() {
    const settings = await getSettings()
    if (!settings) {
        trackers.value = []
        selectedTrackers.value = []
        return
    }

    trackers.value = settings.trackers
        .filter((tracker) => tracker.selected)
        .map((tracker) => ({
            code: tracker.code,
            name: `${tracker.name} (${tracker.code})`,
        }))

    const availableTrackerCodes = new Set(trackers.value.map((tracker) => tracker.code))
    selectedTrackers.value = selectedTrackers.value.filter((code) => availableTrackerCodes.has(code))
}

function toggleTracker(code: string) {
    if (selectedTrackers.value.includes(code)) {
        selectedTrackers.value = selectedTrackers.value.filter((value) => value !== code)
        return
    }

    selectedTrackers.value = [...selectedTrackers.value, code]
}

async function submitUpload() {}
</script>

<template>
    <UCard>
        <template #header>
            <div class="space-y-2">
                <h2 class="text-lg font-medium">Upload</h2>
                <p class="text-sm text-muted">Select the trackers you want to upload this torrent to.</p>
            </div>
        </template>
        <UAlert v-if="error" color="error" variant="soft" title="Failed to load trackers from settings. Please try again." class="mb-4" />

        <div v-if="loading" class="space-y-2">
            <USkeleton class="h-8 w-full" />
            <USkeleton class="h-8 w-full" />
            <USkeleton class="h-8 w-full" />
        </div>

        <UAlert
            v-else-if="trackers.length === 0"
            color="neutral"
            variant="soft"
            title="No trackers configured."
            description="Select at least one tracker in Settings to continue."
            class="mb-4"
        />

        <div v-else class="space-y-2">
            <label class="text-sm font-medium text-highlighted"> Tracker targets </label>
            <div class="rounded-xl border border-default/70 bg-elevated/30 p-4 shadow-xs">
                <div class="space-y-3">
                    <UCheckbox
                        v-for="tracker in trackers"
                        :key="tracker.code"
                        :model-value="selectedTrackers.includes(tracker.code)"
                        :label="tracker.name"
                        color="neutral"
                        :aria-label="tracker.name"
                        @update:model-value="toggleTracker(tracker.code)"
                    />
                </div>
            </div>
            <p class="text-xs text-muted">Selected trackers: {{ selectedTrackers.length }}</p>
        </div>

        <StepNavigationButtons class="mt-5" :next="{ label: 'Upload', disabled: !canUpload || loading, loading: loading }" @back="emit('back')" @next="submitUpload" />
    </UCard>
</template>
