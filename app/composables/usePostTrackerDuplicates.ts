export interface DuplicateEntry {
    name: string
    url?: string
    trumpable: boolean
}

export function usePostTrackerDuplicates(trackerCode: Ref<string>, metadata: Metadata) {
    const { pending, data, error, execute } = useFetch<{ duplicates: DuplicateEntry[] }>(() => `/api/tracker/${trackerCode.value}/duplicates`, {
        method: 'POST',
        body: { metadata },
        immediate: false,
        watch: false,
    })

    return { pending, data, error, execute }
}
