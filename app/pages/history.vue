<script setup lang="ts">
const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100]

const page = ref(1)
const pageSize = ref(15)

const { pending, data, error } = useGetTrackerRequests({ page, size: pageSize, withGroupCount: true })
const { formatStatus, getRequestLabel, getStatusColor, getStatusIcon, getTrackerUploadStatusColor } = useTrackerRequestStatus()

const list = computed(() => data.value ?? { items: [] as TrackerRequestResponse[], total: 0 })
const requests = computed(() => list.value.items)
const total = computed(() => list.value.total)

function hasOtherUploads(request: TrackerRequestResponse) {
    return (request.groupCount ?? 0) > 1
}

const expandedId = ref<string | null>(null)
const expandedUploads = ref<TrackerRequestResponse[] | null>(null)
const { data: groupData, execute: fetchGroup } = useGetTrackerRequestGroup()

watch([page, pageSize], () => {
    expandedId.value = null
    expandedUploads.value = null
})

watch(pageSize, () => {
    page.value = 1
})

async function toggleExpand(request: TrackerRequestResponse) {
    if (expandedId.value === request.id) {
        expandedId.value = null
        return
    }

    expandedId.value = request.id
    expandedUploads.value = null

    await fetchGroup(request.groupId)
    expandedUploads.value = groupData.value?.items ?? null
}

function isExpanded(requestId: string) {
    return expandedId.value === requestId
}

function formatDate(value?: Date) {
    return value ? new Date(value).toLocaleString() : '—'
}
</script>

<template>
    <PageContainer>
        <PageHeader title="History" description="Every upload request, newest first. Expand a row to see other uploads for the same source." />

        <UCard variant="subtle">
            <UAlert v-if="error" color="error" variant="soft" title="Unable to load upload history." description="Please try again in a moment." />

            <div v-else-if="pending && !data" class="space-y-2">
                <USkeleton class="h-12 w-full" />
                <USkeleton class="h-12 w-full" />
                <USkeleton class="h-12 w-full" />
            </div>

            <div v-else-if="!requests.length" class="text-sm text-muted">No upload requests yet.</div>

            <template v-else>
                <div class="mb-3 flex items-center justify-end gap-2 text-sm text-muted">
                    <span>Rows per page</span>
                    <USelect v-model="pageSize" :items="PAGE_SIZE_OPTIONS" size="sm" class="w-20" />
                </div>

                <div class="overflow-x-auto rounded-lg ring ring-default bg-default">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-default text-left text-xs font-medium uppercase tracking-wide text-muted">
                                <th class="w-10 py-3 pl-4" />
                                <th class="px-3 py-3">Title</th>
                                <th class="px-3 py-3">Trackers</th>
                                <th class="px-3 py-3">Status</th>
                                <th class="px-3 py-3 pr-4">Date</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-default">
                            <template v-for="request in requests" :key="request.id">
                                <tr
                                    class="align-middle transition-colors hover:bg-elevated/40"
                                    :class="{ 'bg-elevated/30': isExpanded(request.id), 'cursor-pointer': hasOtherUploads(request) }"
                                    @click="hasOtherUploads(request) && toggleExpand(request)"
                                >
                                    <td class="py-3 pl-4">
                                        <UIcon
                                            v-if="hasOtherUploads(request)"
                                            :name="isExpanded(request.id) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
                                            class="size-4 text-muted"
                                        />
                                    </td>
                                    <td class="px-3 py-3">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <span class="wrap-break-word font-medium text-highlighted">{{ getRequestLabel(request.filepath) }}</span>
                                            <UBadge v-if="hasOtherUploads(request)" color="neutral" variant="soft" size="sm"> {{ request.groupCount }} uploads </UBadge>
                                        </div>
                                    </td>
                                    <td class="px-3 py-3">
                                        <div class="flex flex-wrap gap-1">
                                            <UBadge
                                                v-for="tracker in request.trackers"
                                                :key="tracker.code"
                                                :color="getTrackerUploadStatusColor(tracker.uploadStatus)"
                                                variant="soft"
                                                size="sm"
                                            >
                                                {{ tracker.code }}
                                            </UBadge>
                                        </div>
                                    </td>
                                    <td class="px-3 py-3">
                                        <UBadge :color="getStatusColor(request.status)" variant="soft" size="sm" class="gap-1.5">
                                            <UIcon :name="getStatusIcon(request.status)" />
                                            {{ formatStatus(request.status) }}
                                        </UBadge>
                                    </td>
                                    <td class="px-3 py-3 pr-4 whitespace-nowrap text-muted">{{ formatDate(request.createdAt) }}</td>
                                </tr>
                                <tr v-if="isExpanded(request.id)" class="bg-elevated/30">
                                    <td />
                                    <td colspan="4" class="px-3 py-3 pr-4">
                                        <div class="rounded-lg bg-default ring ring-default overflow-hidden">
                                            <div v-if="expandedUploads === null" class="space-y-2 p-4">
                                                <USkeleton class="h-5 w-2/3" />
                                                <USkeleton class="h-5 w-1/2" />
                                            </div>
                                            <div v-else-if="expandedUploads.length <= 1" class="p-4 text-sm text-muted">No other uploads for this source.</div>
                                            <table v-else class="w-full text-sm">
                                                <thead>
                                                    <tr class="border-b border-default text-left text-xs font-medium uppercase tracking-wide text-muted">
                                                        <th class="px-4 py-2.5">Status</th>
                                                        <th class="px-3 py-2.5">Trackers</th>
                                                        <th class="px-3 py-2.5 pr-4">Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody class="divide-y divide-default">
                                                    <tr v-for="attempt in expandedUploads" :key="attempt.id" :class="{ 'bg-elevated/40': attempt.id === request.id }">
                                                        <td class="px-4 py-2.5">
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <UBadge :color="getStatusColor(attempt.status)" variant="soft" size="sm" class="gap-1.5">
                                                                    <UIcon :name="getStatusIcon(attempt.status)" />
                                                                    {{ formatStatus(attempt.status) }}
                                                                </UBadge>
                                                                <UBadge v-if="attempt.id === request.id" color="primary" variant="soft" size="sm">Current</UBadge>
                                                            </div>
                                                        </td>
                                                        <td class="px-3 py-2.5">
                                                            <div class="flex flex-wrap gap-1">
                                                                <UBadge
                                                                    v-for="tracker in attempt.trackers"
                                                                    :key="tracker.code"
                                                                    :color="getTrackerUploadStatusColor(tracker.uploadStatus)"
                                                                    variant="soft"
                                                                    size="sm"
                                                                >
                                                                    {{ tracker.code }}
                                                                </UBadge>
                                                            </div>
                                                        </td>
                                                        <td class="px-3 py-2.5 pr-4 whitespace-nowrap text-muted">{{ formatDate(attempt.createdAt) }}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>

                <div v-if="total > pageSize" class="mt-4 flex justify-end">
                    <UPagination v-model:page="page" :total="total" :items-per-page="pageSize" />
                </div>
            </template>
        </UCard>
    </PageContainer>
</template>
