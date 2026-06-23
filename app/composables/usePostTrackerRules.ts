export interface RuleViolation {
    rule: string
    message: string
}

export function usePostTrackerRules() {
    const trackerCodeRef = ref<string>()
    const metadataRef = ref<Metadata>()

    const {
        pending,
        data,
        error,
        execute: _execute,
    } = useFetch<{ violations: RuleViolation[] }>(() => `/api/tracker/${trackerCodeRef.value}/rules`, {
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
