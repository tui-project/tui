export function usePostTrackerTitle() {
    const trackerCodeRef = ref<string>()
    const metadataRef = ref<Metadata>()

    const { pending, data, error, execute } = useFetch<{ title: string }>(() => `/api/tracker/${trackerCodeRef.value}/title`, {
        method: 'POST',
        body: { metadata: metadataRef },
        immediate: false,
        watch: false,
    })

    function generateTitle(trackerCode: string, metadata: Metadata) {
        trackerCodeRef.value = trackerCode
        metadataRef.value = metadata

        return execute()
    }

    return { pending, error, data, generateTitle }
}
