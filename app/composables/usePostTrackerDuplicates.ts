export interface DuplicateEntry {
    name: string
    url?: string
    trumpable: boolean
}

export function usePostTrackerDuplicates() {
    const trackerCodeRef = ref<string>()
    const metadataRef = ref<Metadata>()

    const {
        pending,
        data,
        error,
        execute: _execute,
    } = useFetch<{ duplicates: DuplicateEntry[] }>(() => `/api/tracker/${trackerCodeRef.value}/duplicates`, {
        method: 'POST',
        body: { metadata: metadataRef },
        immediate: false,
        watch: false,
    })

    function execute(trackerCode: string, metadata: Metadata) {
        trackerCodeRef.value = trackerCode
        metadataRef.value = metadata

        return _execute()
    }

    return { pending, data, error, execute }
}
