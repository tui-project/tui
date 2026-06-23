export function useGetTrackerRequests(options?: { page?: Ref<number>; size?: Ref<number>; withGroupCount?: boolean }) {
    const query = computed(() => ({
        page: options?.page?.value,
        size: options?.size?.value,
        withGroupCount: options?.withGroupCount ? 'true' : undefined,
    }))

    const { pending, data, error, refresh } = useFetch<{ items: TrackerRequestResponse[]; total: number }>('/api/tracker/requests', {
        query,
    })

    return {
        pending,
        error,
        data,
        refresh,
    }
}
