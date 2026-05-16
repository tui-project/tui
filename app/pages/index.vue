<script setup lang="ts">
import type { TrackerRequest } from '~/composables/useTrackerRequests'

const LIMIT = 6
const REFRESH_INTERVAL_MS = 2_000

const { getRequests, retryRequest, error } = useTrackerRequests()
const requests = ref<TrackerRequest[] | null>(null)

let refreshTimer: ReturnType<typeof globalThis.setInterval> | undefined

onMounted(async () => {
    requests.value = await getRequests(LIMIT)
    refreshTimer = globalThis.setInterval(async () => {
        const result = await getRequests(LIMIT)
        if (result !== null) {
            requests.value = result
        }
    }, REFRESH_INTERVAL_MS)
})

onBeforeUnmount(() => {
    clearInterval(refreshTimer)
})

const trackerUploadStatuses = {
    pending: 'pending',
    torrentCreation: 'torrent_creation',
    uploading: 'uploading',
    success: 'success',
    partialSuccess: 'partial_success',
    fail: 'fail',
} as const

const finalStatuses = new Set<string>([trackerUploadStatuses.success, trackerUploadStatuses.partialSuccess, trackerUploadStatuses.fail])

function formatStatus(status: string) {
    return status
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function getRequestLabel(filepath: string) {
    return filepath.split('/').filter(Boolean).at(-1)
}

function shouldShowProgress(status: string) {
    return status === trackerUploadStatuses.torrentCreation
}

function hasFinalStatus(status: string) {
    return finalStatuses.has(status)
}

function getStatusColor(status: string) {
    if (status === trackerUploadStatuses.fail) return 'error'
    if (status === trackerUploadStatuses.success) return 'success'
    if (status === trackerUploadStatuses.partialSuccess) return 'warning'
    return 'neutral'
}

function getStatusIcon(status: string) {
    const icons: Record<string, string> = {
        success: 'i-heroicons-check-circle',
        fail: 'i-heroicons-x-circle',
        partial_success: 'i-heroicons-exclamation-triangle',
        pending: 'i-heroicons-clock',
        torrent_creation: 'i-heroicons-cog-6-tooth',
        uploading: 'i-heroicons-arrow-up-tray',
    }
    return icons[status]
}

function shouldAnimateIcon(status: string) {
    return status === trackerUploadStatuses.torrentCreation
}

function isRetryable(status: string) {
    return status === trackerUploadStatuses.fail || status === trackerUploadStatuses.partialSuccess
}

async function handleRetry(request: TrackerRequest) {
    await retryRequest(request.id)
    const result = await getRequests(LIMIT)
    if (result !== null) {
        requests.value = result
    }
}
</script>

<template>
    <PageContainer>
        <PageHeader title="Dashboard" />
        <UCard title="Recent Uploads" description="The latest upload requests and their current status." variant="subtle">
            <UAlert v-if="error" color="error" variant="soft" title="Unable to load recent upload requests." description="Please try again in a moment." />

            <div v-else-if="!requests" class="space-y-2">
                <USkeleton class="h-20 w-full" />
                <USkeleton class="h-20 w-full" />
                <USkeleton class="h-20 w-full" />
            </div>

            <div v-else-if="!requests.length" class="text-sm text-muted">No upload requests yet.</div>

            <div v-else class="grid gap-3 sm:grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 h-full">
                <UCard v-for="request in requests" :key="request.id" variant="outline">
                    <div class="space-y-3">
                        <div class="flex justify-end mt-auto">
                            <UBadge :color="getStatusColor(request.status)" variant="soft" size="md" class="gap-1.5">
                                <UIcon :name="getStatusIcon(request.status)" :class="{ 'animate-spin': shouldAnimateIcon(request.status) }" />
                                {{ formatStatus(request.status) }}
                            </UBadge>
                        </div>
                        <div class="wrap-break-word text-sm font-medium text-highlighted">
                            {{ getRequestLabel(request.filepath) }}
                        </div>
                        <div class="flex flex-wrap gap-1">
                            <UBadge v-for="tracker in request.trackers" :key="tracker.code" color="neutral" variant="soft" size="lg">
                                {{ tracker.code }}
                            </UBadge>
                        </div>

                        <div v-if="shouldShowProgress(request.status)" class="space-y-1">
                            <div class="flex items-center justify-between text-sm text-muted">
                                <span>Creating torrent</span>
                                <span>{{ request.torrentCreationProgress ?? 0 }}%</span>
                            </div>
                            <UProgress :model-value="request.torrentCreationProgress ?? 0" size="md" />
                        </div>

                        <div v-else-if="hasFinalStatus(request.status) && request.failedTrackerCodes?.length" class="text-xs text-muted">
                            Failed trackers: {{ request.failedTrackerCodes.join(', ') }}
                        </div>

                        <div v-if="isRetryable(request.status)" class="flex justify-end">
                            <UButton size="sm" variant="soft" color="neutral" icon="i-heroicons-arrow-path" @click="handleRetry(request)">
                                Retry
                            </UButton>
                        </div>
                    </div>
                </UCard>
            </div>
        </UCard>
    </PageContainer>
</template>
