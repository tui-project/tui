export function useGetTrackerRequestGroup() {
    const groupIdRef = ref<string>()

    const {
        pending,
        data,
        error,
        execute: _execute,
    } = useFetch<{ items: TrackerRequestResponse[]; total: number }>('/api/tracker/requests', {
        query: { groupId: groupIdRef },
        immediate: false,
        watch: false,
    })

    function execute(groupId: string) {
        groupIdRef.value = groupId

        return _execute()
    }

    return { pending, error, data, execute }
}
