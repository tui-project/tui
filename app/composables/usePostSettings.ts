import type { AppSettings } from './useGetSettings'

export function usePostSettings() {
    const bodyRef = ref<AppSettings>()

    const {
        pending,
        data,
        error,
        execute: _execute,
    } = useFetch<AppSettings>('/api/settings', {
        method: 'POST',
        body: bodyRef,
        immediate: false,
        watch: false,
    })

    const errorMessage = computed(() => {
        const err = error.value as { data?: { message?: string } } | undefined
        return err?.data?.message ?? (err ? 'An unexpected error occurred.' : '')
    })

    function execute(body: AppSettings) {
        bodyRef.value = body

        return _execute()
    }

    return { pending, data, errorMessage, execute }
}
