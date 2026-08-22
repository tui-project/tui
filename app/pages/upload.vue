<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'

const { withFooter } = useDescriptionFooter()

const stepItems: StepperItem[] = [
    {
        title: 'Select Media',
        icon: 'i-lucide-folder-search',
        slot: 'select-media',
    },
    {
        title: 'Metadata',
        icon: 'i-lucide-file-pen-line',
        slot: 'metadata',
    },
    {
        title: 'Select Trackers',
        icon: 'i-lucide-server',
        slot: 'select-trackers',
    },
    {
        title: 'Review',
        icon: 'i-lucide-eye',
        slot: 'review',
    },
    {
        title: 'Description',
        icon: 'i-lucide-file-text',
        slot: 'description',
    },
]

const stepper = useTemplateRef('stepper')
const currentStep = ref(0)
const selectedPath = ref<Path>()
const selectedTrackers = ref<string[]>([])
const reviewedMetadata = ref<{ filename: string; metadata: Metadata }>()
const prefetchedMetadata = ref<{ filename: string; metadata: PartialMetadata }>()
const description = ref('')
const fullDescription = computed(() => withFooter(description.value))
const reviewedTrackers = ref<TrackerItem[]>([])
const { pending: uploadPending, error: uploadError, execute: executeUpload } = usePostTrackerRequests()
const toast = useToast()

watch(
    () => selectedPath.value?.value?.trim() ?? '',
    (path, previousPath) => {
        if (!path || !previousPath || path === previousPath) {
            return
        }
        reviewedMetadata.value = undefined
        prefetchedMetadata.value = undefined
    }
)

function goToNextStep() {
    stepper.value?.next()
}

function goToPrevStep() {
    stepper.value?.prev()
}

function finishReview(trackers: TrackerItem[]) {
    reviewedTrackers.value = trackers
    goToNextStep()
}

async function submitUpload() {
    await executeUpload({ filepath: selectedPath.value!.value, metadata: reviewedMetadata.value!.metadata, description: fullDescription.value, trackers: reviewedTrackers.value })

    if (!uploadError.value) {
        toast.add({ title: 'Upload request submitted.', description: 'Your torrent is queued and available from the dashboard.', color: 'success' })
        await navigateTo('/')
    }
}
</script>

<template>
    <PageContainer>
        <PageHeader title="Upload" description="Create torrents and upload to private trackers." />
        <UStepper ref="stepper" v-model="currentStep" :items="stepItems" class="w-full" size="lg" disabled>
            <template #select-media>
                <UploadStepSelectMedia v-model="selectedPath" @next="goToNextStep" />
            </template>
            <template #metadata>
                <UploadStepMetadata v-model="reviewedMetadata" v-model:prefetched="prefetchedMetadata" :selected-path="selectedPath" @back="goToPrevStep" @next="goToNextStep" />
            </template>
            <template #select-trackers>
                <UploadStepSelectTrackers v-model="selectedTrackers" @back="goToPrevStep" @next="goToNextStep" />
            </template>
            <template #review>
                <UploadStepReview :selected-trackers="selectedTrackers" :metadata="reviewedMetadata?.metadata" @back="goToPrevStep" @next="finishReview" />
            </template>
            <template #description>
                <UploadStepDescription
                    v-model="description"
                    :selected-path="selectedPath"
                    :is-hdr="Boolean(reviewedMetadata?.metadata.hdr.length)"
                    :is-tv="reviewedMetadata?.metadata.mediaType === 'tv'"
                    :submitting="uploadPending"
                    :submit-error="Boolean(uploadError)"
                    final-step
                    @back="goToPrevStep"
                    @next="submitUpload"
                />
            </template>
        </UStepper>
    </PageContainer>
</template>
