<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'
import type { Path } from '~/components/upload/upload.types'

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
        title: 'Description',
        icon: 'i-lucide-file-text',
        slot: 'description',
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
]

const stepper = useTemplateRef('stepper')
const currentStep = ref(0)
const selectedPath = ref<Path>()
const selectedTrackers = ref<string[]>([])
const reviewedMetadata = ref<Metadata>()
const description = ref('')

watch(
    () => selectedPath.value?.value?.trim() ?? '',
    (path, previousPath) => {
        if (!path || !previousPath || path === previousPath) {
            return
        }
        reviewedMetadata.value = undefined
    }
)

function goToNextStep() {
    stepper.value?.next()
}

function goToPrevStep() {
    stepper.value?.prev()
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
                <UploadStepMetadata v-model="reviewedMetadata" :selected-path="selectedPath" @back="goToPrevStep" @next="goToNextStep" />
            </template>
            <template #description>
                <UploadStepDescription
                    v-model="description"
                    :selected-path="selectedPath"
                    :is-hdr="Boolean(reviewedMetadata?.hdr?.length)"
                    :is-tv="reviewedMetadata?.mediaType === 'tv'"
                    @back="goToPrevStep"
                    @next="goToNextStep"
                />
            </template>
            <template #select-trackers>
                <UploadStepSelectTrackers v-model="selectedTrackers" @back="goToPrevStep" @next="goToNextStep" />
            </template>
            <template #review>
                <UploadStepReview
                    :selected-trackers="selectedTrackers"
                    :metadata="reviewedMetadata"
                    :source-path="selectedPath?.value"
                    :description="description"
                    @back="goToPrevStep"
                />
            </template>
        </UStepper>
    </PageContainer>
</template>
