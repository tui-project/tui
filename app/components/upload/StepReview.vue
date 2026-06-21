<script setup lang="ts">
import StepNavigationButtons from './StepNavigationButtons.vue'
import { useGetSettings } from '~/composables/useGetSettings'
import { usePostTrackerTitle } from '~/composables/usePostTrackerTitle'
import { usePostTrackerRules, type RuleViolation } from '~/composables/usePostTrackerRules'
import { usePostTrackerDuplicates, type DuplicateEntry } from '~/composables/usePostTrackerDuplicates'

const props = defineProps<{
    selectedTrackers: string[]
    metadata?: Metadata
    sourcePath?: string
    description?: string
}>()

const emit = defineEmits<{
    back: []
}>()

const trackerNames = ref<Record<string, string>>({})
const trackerItems = ref<Record<string, TrackerItem>>({})
const trackerViolations = ref<Record<string, RuleViolation[]>>({})
const acceptedViolations = ref<Record<string, boolean>>({})
const trackerDuplicates = ref<Record<string, DuplicateEntry[]>>({})
const acceptedDuplicates = ref<Record<string, boolean>>({})
const trackerCode = ref('')

const toast = useToast()
const { pending: settingsLoading, data: settings } = useGetSettings()
const { pending: titleLoading, data: title, error: titleError, execute: generateTitle } = usePostTrackerTitle(trackerCode, props.metadata!)
const { pending: rulesLoading, data: ruleViolations, error: rulesError, execute: checkViolations } = usePostTrackerRules(trackerCode, props.metadata!)
const { pending: duplicatesLoading, data: duplicatesData, error: duplicatesError, execute: checkDuplicates } = usePostTrackerDuplicates(trackerCode, props.metadata!)

const trackerLoadErrors = ref<Record<string, string[]>>({})

watch(
    settings,
    (settings) => {
        if (settings) {
            trackerNames.value = Object.fromEntries(settings.trackers.map((t) => [t.code, `${t.name} (${t.code})`]))
        }
    },
    { immediate: true }
)

onMounted(async () => {
    await loadTrackerItems()
})

async function loadTrackerItems() {
    if (!props.metadata || props.selectedTrackers.length === 0) return

    for (const code of props.selectedTrackers) {
        trackerCode.value = code

        await Promise.all([generateTitle(), checkViolations(), checkDuplicates()])

        const errors: string[] = []

        trackerItems.value[code] = { code, title: '', titleModified: false, anonymous: false, modQueueOptIn: false }
        trackerViolations.value[code] = []
        trackerDuplicates.value[code] = []

        if (titleError.value) {
            errors.push('Failed to generate title')
        } else {
            trackerItems.value[code].title = title.value!.title
        }

        if (rulesError.value) {
            errors.push('Failed to check rule violations')
        } else {
            const violations = ruleViolations.value!.violations
            trackerViolations.value[code] = violations

            if (violations.length > 0) {
                acceptedViolations.value[code] = false
            }
        }

        if (duplicatesError.value) {
            errors.push('Failed to check duplicates')
        } else {
            const duplicates = duplicatesData.value!.duplicates
            trackerDuplicates.value[code] = duplicates

            if (duplicates.filter((d) => !d.trumpable).length > 0) {
                acceptedDuplicates.value[code] = false
            }
        }

        if (errors.length > 0) {
            trackerLoadErrors.value[code] = errors
        }
    }
}

const uploadableTrackers = computed(() =>
    Object.values(trackerItems.value).filter((item) => {
        if (trackerLoadErrors.value[item.code]?.length) return false
        if (!item.title.trim()) return false

        const violations = trackerViolations.value[item.code]!
        if (violations.length > 0 && !acceptedViolations.value[item.code]) return false

        const duplicates = trackerDuplicates.value[item.code]!
        const nonTrumpable = duplicates.filter((d) => !d.trumpable)
        if (nonTrumpable.length > 0 && !acceptedDuplicates.value[item.code]) return false

        return true
    })
)

const canSubmit = computed(() => {
    if (props.selectedTrackers.length === 0 || !props.sourcePath?.trim() || !props.metadata) return false
    return uploadableTrackers.value.length > 0
})

const {
    pending: uploadPending,
    error: uploadError,
    execute: executeUpload,
} = useFetch('/api/tracker/requests', {
    immediate: false,
    method: 'POST',
    body: computed(() => ({
        filepath: props.sourcePath,
        metadata: props.metadata,
        description: props.description,
        trackers: uploadableTrackers.value,
    })),
    watch: false,
})

async function onSubmit() {
    await executeUpload()
    if (!uploadError.value) {
        toast.add({
            title: 'Upload request submitted.',
            description: 'Your torrent is queued and available from the dashboard.',
            color: 'success',
        })
        await navigateTo('/')
    }
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

        <div v-if="settingsLoading || titleLoading || rulesLoading || duplicatesLoading" class="space-y-4">
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-20 w-full" />
        </div>

        <div v-else-if="selectedTrackers.length === 0" class="text-sm text-muted">No trackers selected. Go back and select at least one tracker.</div>

        <UForm v-else :state="trackerItems" class="space-y-6" @submit="onSubmit">
            <div v-for="item in trackerItems" :key="item.code" class="rounded-xl border border-default/70 bg-elevated/30 p-4 shadow-xs space-y-4">
                <h3 class="text-sm font-semibold text-highlighted">{{ trackerNames[item.code] ?? item.code }}</h3>

                <div v-if="trackerLoadErrors[item.code]?.length" class="space-y-1">
                    <UAlert color="error" variant="soft" title="Failed to load tracker data — this tracker will be skipped">
                        <template #description>
                            <ul class="list-disc pl-4">
                                <li v-for="err in trackerLoadErrors[item.code]" :key="err">{{ err }}</li>
                            </ul>
                        </template>
                    </UAlert>
                </div>

                <template v-for="violations in [trackerViolations[item.code] as RuleViolation[]]" :key="violations.length">
                    <div v-if="violations.length" class="space-y-3">
                        <UAlert
                            :color="acceptedViolations[item.code] ? 'warning' : 'error'"
                            variant="soft"
                            :title="acceptedViolations[item.code] ? 'Rule violations detected' : 'Rule violations detected — this tracker will be skipped'"
                            :description="`This upload violates ${violations.length} rule${violations.length > 1 ? 's' : ''} for ${trackerNames[item.code] ?? item.code}.`"
                        />
                        <ul class="space-y-1 pl-1">
                            <li
                                v-for="violation in violations"
                                :key="violation.rule"
                                :class="['flex items-start gap-2 text-sm', acceptedViolations[item.code] ? 'text-warning' : 'text-error']"
                            >
                                <UIcon name="i-lucide-triangle-alert" class="mt-0.5 shrink-0 size-4" />
                                <span>{{ violation.message }}</span>
                            </li>
                        </ul>
                        <UCheckbox v-model="acceptedViolations[item.code]" color="warning" label="I understand and want to upload to this tracker anyway" />
                    </div>
                </template>

                <template v-for="dupes in [trackerDuplicates[item.code] as DuplicateEntry[]]" :key="dupes.length">
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
            :next="{ label: 'Submit Upload', disabled: !canSubmit || titleLoading || rulesLoading || duplicatesLoading || uploadPending, loading: uploadPending }"
            @back="emit('back')"
            @next="onSubmit"
        />
    </UCard>
</template>
