<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'
import type { Path } from '~/components/upload/StepSelectMedia.types'

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
const selectedPath = ref<Path>()
const currentStep = ref(0)

watch(
    () => selectedPath.value?.value?.trim() ?? '',
    (path, previousPath) => {
        if (!path || !previousPath || path === previousPath) {
            return
        }
    }
)

function goToNextStep() {
    stepper.value?.next()
}
</script>

<template>
    <PageContainer>
        <PageHeader title="Upload" description="Create torrents and upload to private trackers." />
        <UStepper ref="stepper" v-model="currentStep" :items="stepItems" class="w-full" size="lg">
            <template #select-media>
                <UploadStepSelectMedia v-model="selectedPath" @next="goToNextStep" />
            </template>

            <template #review-metadata> </template>

            <template #description> </template>

            <template #upload> </template>
        </UStepper>
    </PageContainer>
</template>
