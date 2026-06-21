export interface RuleViolation {
    rule: string
    message: string
}

export function usePostTrackerRules(trackerCode: Ref<string>, metadata: Metadata) {
    const { pending, data, error, execute } = useFetch<{ violations: RuleViolation[] }>(() => `/api/tracker/${trackerCode.value}/rules`, {
        method: 'POST',
        body: { metadata },
        immediate: false,
        watch: false,
    })

    return { pending, data, error, execute }
}
