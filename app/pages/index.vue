<script setup lang="ts">
const REFRESH_INTERVAL_MS = 2_000
const FINAL_STATUSES = new Set<string>([STATUS.SUCCESS, STATUS.PARTIAL_SUCCESS, STATUS.FAIL])

const { pending, data, error, refresh } = useGetTrackerRequests()
const { formatStatus, getRequestLabel, getStatusColor, getStatusIcon, getTrackerUploadStatusColor } = useTrackerRequestStatus()

const requests = computed(() => data.value?.items ?? [])

const { execute: executeRetry } = usePatchTrackerRequest()

const refreshTimer = globalThis.setInterval(refresh, REFRESH_INTERVAL_MS)
onBeforeUnmount(() => clearInterval(refreshTimer))

function shouldShowProgress(status: Status) {
    return status === STATUS.TORRENT_CREATION
}

function hasFinalStatus(status: Status) {
    return FINAL_STATUSES.has(status)
}

function shouldAnimateIcon(status: Status) {
    return status === STATUS.TORRENT_CREATION
}

function isRetryable(status: Status) {
    return status === STATUS.FAIL || status === STATUS.PARTIAL_SUCCESS
}

function getInjectionBadgeProps(torrentClientInjected?: boolean): { color: 'warning'; label: string } | null {
    switch (torrentClientInjected) {
        case false:
            return { color: 'warning', label: 'Injection failed' }
        default:
            return null
    }
}

function hasInjectionFailure(request: TrackerRequestResponse) {
    return request.trackers.some((t) => t.torrentClientInjected === false)
}

async function handleRetry(request: TrackerRequestResponse) {
    await executeRetry(request.id)
    await refresh()
}
</script>

<template>
    <PageContainer>
        <PageHeader title="Dashboard" />
        <UCard title="Recent Uploads" description="The latest upload requests and their current status." variant="subtle">
            <UAlert v-if="error" color="error" variant="soft" title="Unable to load recent upload requests." description="Please try again in a moment." />

            <div v-else-if="pending && !data" class="space-y-2">
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
