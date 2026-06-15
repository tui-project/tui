<script setup lang="ts">
import type { TrackerRequest } from '#shared/types/tracker-request'
import { STATUS, type Status, type UploadStatus } from '~~/shared/types/tracker-request'

const REFRESH_INTERVAL_MS = 2_000
const FINAL_STATUSES = new Set<string>([STATUS.success, STATUS.partialSuccess, STATUS.fail])

const { pending, data: requests, error, refresh } = useFetch('/api/tracker/requests')

const retryId = ref<string | null>(null)
const { execute: executeRetry } = useFetch(() => `/api/tracker/requests/${retryId.value}`, {
    immediate: false,
    method: 'PATCH',
    body: { action: 'retry' },
    watch: false,
})

const refreshTimer = globalThis.setInterval(refresh, REFRESH_INTERVAL_MS)
onBeforeUnmount(() => clearInterval(refreshTimer))

function formatStatus(status: Status) {
    return status
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function getRequestLabel(filepath: string) {
    return filepath.split('/').filter(Boolean).at(-1)
}

function shouldShowProgress(status: Status) {
    return status === STATUS.torrentCreation
}

function hasFinalStatus(status: Status) {
    return FINAL_STATUSES.has(status)
}

function getStatusColor(status: Status) {
    switch (status) {
        case STATUS.fail:
            return 'error'
        case STATUS.success:
            return 'success'
        case STATUS.partialSuccess:
            return 'warning'
        default:
            return 'neutral'
    }
}

function getStatusIcon(status: Status) {
    switch (status) {
        case STATUS.success:
            return 'i-heroicons-check-circle'
        case STATUS.fail:
            return 'i-heroicons-x-circle'
        case STATUS.partialSuccess:
            return 'i-heroicons-exclamation-triangle'
        case STATUS.pending:
            return 'i-heroicons-clock'
        case STATUS.torrentCreation:
            return 'i-heroicons-cog-6-tooth'
        case STATUS.uploading:
            return 'i-heroicons-arrow-up-tray'
    }
}

function shouldAnimateIcon(status: Status) {
    return status === STATUS.torrentCreation
}

function isRetryable(status: Status) {
    return status === STATUS.fail || status === STATUS.partialSuccess
}

function getTrackerUploadStatusColor(uploadStatus?: UploadStatus) {
    switch (uploadStatus) {
        case 'success':
            return 'success'
        case 'failed':
            return 'error'
        default:
            return 'neutral'
    }
}

function getInjectionBadgeProps(torrentClientInjected?: boolean): { color: 'warning'; label: string } | null {
    switch (torrentClientInjected) {
        case false:
            return { color: 'warning', label: 'Injection failed' }
        default:
            return null
    }
}

function hasInjectionFailure(request: TrackerRequest) {
    return request.trackers.some((t) => t.torrentClientInjected === false)
}

async function handleRetry(request: TrackerRequest) {
    retryId.value = request.id
    await executeRetry()
    await refresh()
}
</script>

<template>
    <PageContainer>
        <PageHeader title="Dashboard" />
        <UCard title="Recent Uploads" description="The latest upload requests and their current status." variant="subtle">
            <UAlert v-if="error" color="error" variant="soft" title="Unable to load recent upload requests." description="Please try again in a moment." />

            <div v-else-if="pending && !requests" class="space-y-2">
                <USkeleton class="h-20 w-full" />
                <USkeleton class="h-20 w-full" />
                <USkeleton class="h-20 w-full" />
            </div>

            <div v-else-if="!requests?.length" class="text-sm text-muted">No upload requests yet.</div>

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
                            <template v-for="tracker in request.trackers" :key="tracker.code">
                                <UBadge :color="getTrackerUploadStatusColor(tracker.uploadStatus)" variant="soft" size="lg">
                                    {{ tracker.code }}
                                </UBadge>
                                <UBadge
                                    v-if="getInjectionBadgeProps(tracker.torrentClientInjected)"
                                    v-bind="getInjectionBadgeProps(tracker.torrentClientInjected)!"
                                    variant="soft"
                                    size="lg"
                                >
                                    {{ getInjectionBadgeProps(tracker.torrentClientInjected)!.label }}
                                </UBadge>
                            </template>
                        </div>

                        <div v-if="shouldShowProgress(request.status)" class="space-y-1">
                            <div class="flex items-center justify-between text-sm text-muted">
                                <span>Creating torrent</span>
                                <span>{{ request.torrentCreationProgress ?? 0 }}%</span>
                            </div>
                            <UProgress :model-value="request.torrentCreationProgress ?? 0" size="md" />
                        </div>

                        <template v-else-if="hasFinalStatus(request.status)">
                            <div v-if="request.failedTrackerCodes?.length" class="text-xs text-muted">Failed trackers: {{ request.failedTrackerCodes.join(', ') }}</div>
                            <div v-if="hasInjectionFailure(request)" class="text-xs text-warning">Torrent client injection failed for one or more trackers.</div>
                        </template>

                        <div v-if="isRetryable(request.status)" class="flex justify-end">
                            <UButton size="sm" variant="soft" color="neutral" icon="i-heroicons-arrow-path" @click="handleRetry(request)"> Retry </UButton>
                        </div>
                    </div>
                </UCard>
            </div>
        </UCard>
    </PageContainer>
</template>
