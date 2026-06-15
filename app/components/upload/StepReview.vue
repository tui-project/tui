<script setup lang="ts">
import StepNavigationButtons from './StepNavigationButtons.vue'
import { useSettings } from '~/composables/useSettings'
import { useTrackerRequests } from '~/composables/useTrackerRequests'
import { useTrackerTitle } from '~/composables/useTrackerTitle'
import { useTrackerRules, type RuleViolation } from '~/composables/useTrackerRules'
import { useTrackerDuplicates, type DuplicateEntry } from '~/composables/useTrackerDuplicates'

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
const { getViolations, loading: rulesLoading } = useTrackerRules()
const { getDuplicates, loading: duplicatesLoading } = useTrackerDuplicates()

const trackerNames = ref<Record<string, string>>({})
const trackerItems = ref<TrackerItem[]>([])
const trackerViolations = ref<Record<string, RuleViolation[]>>({})
const acceptedViolations = ref<Record<string, boolean>>({})
const trackerDuplicates = ref<Record<string, DuplicateEntry[]>>({})
const acceptedDuplicates = ref<Record<string, boolean>>({})

const uploadableTrackers = computed(() =>
    trackerItems.value.filter((item) => {
        if (!item.title.trim()) return false

        const violations = trackerViolations.value[item.code] ?? []
        if (violations.length > 0 && !acceptedViolations.value[item.code]) return false

        const duplicates = trackerDuplicates.value[item.code] ?? []
        const nonTrumpable = duplicates.filter((d) => !d.trumpable)
        if (nonTrumpable.length > 0 && !acceptedDuplicates.value[item.code]) return false

        return true
    })
)

const canSubmit = computed(() => {
    if (props.selectedTrackers.length === 0 || !props.sourcePath?.trim() || !props.metadata) return false
    return uploadableTrackers.value.length > 0
})

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

    const [violations, duplicates] = await Promise.all([
        Promise.all(props.selectedTrackers.map(async (code) => ({ code, violations: await getViolations(code, props.metadata!) }))),
        Promise.all(props.selectedTrackers.map(async (code) => ({ code, duplicates: await getDuplicates(code, props.metadata!) }))),
    ])

    const newViolations: Record<string, RuleViolation[]> = {}
    const newAcceptedViolations: Record<string, boolean> = {}
    for (const { code, violations: v } of violations) {
        newViolations[code] = v
        if (v.length > 0 && !(code in acceptedViolations.value)) {
            newAcceptedViolations[code] = false
        }
    }
    trackerViolations.value = newViolations
    acceptedViolations.value = {
        ...newAcceptedViolations,
        ...Object.fromEntries(Object.entries(acceptedViolations.value).filter(([code]) => (newViolations[code]?.length ?? 0) > 0)),
    }

    const newDuplicates: Record<string, DuplicateEntry[]> = {}
    const newAcceptedDuplicates: Record<string, boolean> = {}
    for (const { code, duplicates: d } of duplicates) {
        newDuplicates[code] = d
        if (d.length > 0 && !(code in acceptedDuplicates.value)) {
            newAcceptedDuplicates[code] = false
        }
    }
    trackerDuplicates.value = newDuplicates
    acceptedDuplicates.value = {
        ...newAcceptedDuplicates,
        ...Object.fromEntries(Object.entries(acceptedDuplicates.value).filter(([code]) => (newDuplicates[code]?.length ?? 0) > 0)),
    }
}

async function onSubmit() {
    if (!props.sourcePath || !props.metadata || uploadLoading.value || !canSubmit.value) return

    await uploadTorrent(props.sourcePath, props.metadata, props.description, uploadableTrackers.value)
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

        <div v-if="settingsLoading || titlesLoading || rulesLoading || duplicatesLoading" class="space-y-4">
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-20 w-full" />
        </div>

        <div v-else-if="selectedTrackers.length === 0" class="text-sm text-muted">No trackers selected. Go back and select at least one tracker.</div>

        <UForm v-else :state="trackerItems" class="space-y-6" @submit="onSubmit">
            <div v-for="item in trackerItems" :key="item.code" class="rounded-xl border border-default/70 bg-elevated/30 p-4 shadow-xs space-y-4">
                <h3 class="text-sm font-semibold text-highlighted">{{ trackerNames[item.code] ?? item.code }}</h3>

                <div v-if="trackerViolations[item.code]?.length" class="space-y-3">
                    <UAlert
                        :color="acceptedViolations[item.code] ? 'warning' : 'error'"
                        variant="soft"
                        :title="acceptedViolations[item.code] ? 'Rule violations detected' : 'Rule violations detected — this tracker will be skipped'"
                        :description="`This upload violates ${trackerViolations[item.code]?.length ?? 0} rule${(trackerViolations[item.code]?.length ?? 0) > 1 ? 's' : ''} for ${trackerNames[item.code] ?? item.code}.`"
                    />
                    <ul class="space-y-1 pl-1">
                        <li
                            v-for="violation in trackerViolations[item.code]"
                            :key="violation.rule"
                            :class="['flex items-start gap-2 text-sm', acceptedViolations[item.code] ? 'text-warning' : 'text-error']"
                        >
                            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 shrink-0 size-4" />
                            <span>{{ violation.message }}</span>
                        </li>
                    </ul>
                    <UCheckbox v-model="acceptedViolations[item.code]" color="warning" label="I understand and want to upload to this tracker anyway" />
                </div>

                <template v-for="dupes in [trackerDuplicates[item.code] ?? []]" :key="dupes.length">
                    <div v-if="dupes.length" class="space-y-3">
                        <template v-if="dupes.every((d) => d.trumpable)">
                            <UAlert
                                color="info"
                                variant="soft"
                                title="Existing releases will be trumped"
                                :description="`${dupes.length} existing release${dupes.length > 1 ? 's' : ''} on ${trackerNames[item.code] ?? item.code} will be trumped by this upload.`"
                            />
                            <ul class="space-y-1 pl-1">
                                <li v-for="dupe in dupes" :key="dupe.name" class="flex items-start gap-2 text-sm text-info">
                                    <UIcon name="i-lucide-arrow-up-circle" class="mt-0.5 shrink-0 size-4" />
                                    <a v-if="dupe.url" :href="dupe.url" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2">{{ dupe.name }}</a>
                                    <span v-else>{{ dupe.name }}</span>
                                </li>
                            </ul>
                        </template>
                        <template v-else>
                            <UAlert
                                :color="acceptedDuplicates[item.code] ? 'warning' : 'error'"
                                variant="soft"
                                :title="acceptedDuplicates[item.code] ? 'Duplicates found on this tracker' : 'Duplicates found on this tracker — it will be skipped'"
                                :description="`${dupes.filter((d) => !d.trumpable).length} existing release${dupes.filter((d) => !d.trumpable).length > 1 ? 's' : ''} found on ${trackerNames[item.code] ?? item.code}.`"
                            />
                            <ul class="space-y-1 pl-1">
                                <li
                                    v-for="dupe in dupes"
                                    :key="dupe.name"
                                    :class="['flex items-start gap-2 text-sm', dupe.trumpable ? 'text-info' : acceptedDuplicates[item.code] ? 'text-warning' : 'text-error']"
                                >
                                    <UIcon :name="dupe.trumpable ? 'i-lucide-arrow-up-circle' : 'i-lucide-copy'" class="mt-0.5 shrink-0 size-4" />
                                    <a v-if="dupe.url" :href="dupe.url" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2">{{ dupe.name }}</a>
                                    <span v-else>{{ dupe.name }}</span>
                                    <span v-if="dupe.trumpable" class="text-xs opacity-70">(trumpable)</span>
                                </li>
                            </ul>
                            <UCheckbox v-model="acceptedDuplicates[item.code]" color="warning" label="I understand and want to upload to this tracker anyway" />
                        </template>
                    </div>
                </template>

                <UFormField label="Title">
                    <UInput v-model="item.title" class="w-full" :placeholder="`Title for ${item.code}`" @update:model-value="item.titleModified = true" />
                    <template #help>
                        <span v-if="!item.title.trim()" class="text-xs text-error">Title is required</span>
                        <span v-else-if="item.titleModified" class="text-xs text-warning">Title modified from default</span>
                    </template>
                </UFormField>

                <UCheckbox v-model="item.anonymous" label="Upload anonymously" color="neutral" />
                <UCheckbox v-model="item.modQueueOptIn" label="Opt in to mod queue" color="neutral" />
            </div>
        </UForm>

        <StepNavigationButtons
            class="mt-5"
            :next="{ label: 'Submit Upload', disabled: !canSubmit || titlesLoading || rulesLoading || duplicatesLoading, loading: uploadLoading }"
            @back="emit('back')"
            @next="onSubmit"
        />
    </UCard>
</template>
