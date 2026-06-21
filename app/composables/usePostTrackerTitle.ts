export function usePostTrackerTitle(trackerCode: Ref<string>, metadata: Metadata) {
    const { pending, data, error, execute } = useFetch<{ title: string }>(() => `/api/tracker/${trackerCode.value}/title`, {
        method: 'POST',
        body: { metadata },
        immediate: false,
        watch: false,
    })

    return { pending, error, data, execute }
}
