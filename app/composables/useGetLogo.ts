export type LogoQuery = {
    tmdbId: number
    mediaType: MediaType
    originalLanguage: string
}

export function useGetLogo() {
    const query = ref<LogoQuery>()
    const {
        pending,
        error,
        data,
        execute: executeFetch,
    } = useApiFetch<string | null>('/api/logo', {
        query,
        immediate: false,
        watch: false,
    })

    function execute(params: LogoQuery) {
        query.value = params
        return executeFetch()
    }

    return { pending, error, data, execute }
}
