<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'
import type { Metadata, Path } from '~/components/upload/upload.types'

const stepItems: StepperItem[] = [
    {
        title: 'Select Media',
        icon: 'i-lucide-folder-search',
        slot: 'select-media',
    },
    {
        title: 'Review Metadata',
        icon: 'i-lucide-file-pen-line',
        slot: 'review-metadata',
    },
    {
        title: 'Description',
        icon: 'i-lucide-file-text',
        slot: 'description',
    },
    {
        title: 'Upload',
        icon: 'i-lucide-cloud-upload',
        slot: 'upload',
    },
]

const stepper = useTemplateRef('stepper')
const currentStep = ref(0)
const selectedPath = ref<Path>()
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
        <UStepper ref="stepper" v-model="currentStep" :items="stepItems" class="w-full" size="lg">
            <template #select-media>
                <UploadStepSelectMedia v-model="selectedPath" @next="goToNextStep" />
            </template>
            <template #review-metadata>
                <UploadStepReviewMetadata v-model="reviewedMetadata" :selected-path="selectedPath" @back="goToPrevStep" @next="goToNextStep" />
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

            <template #upload> </template>
        </UStepper>
    </PageContainer>
</template>
