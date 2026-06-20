import type { AppSettings } from './useGetSettings'

export function usePostSettings(body: Ref<AppSettings | undefined>) {
    const { pending, data, error, execute } = useFetch<AppSettings>('/api/settings', {
        method: 'POST',
        body,
        immediate: false,
        watch: false,
    })

    const errorMessage = computed(() => {
        const err = error.value as { data?: { message?: string } } | undefined
        return err?.data?.message ?? (err ? 'An unexpected error occurred.' : '')
    })

    return { pending, data, errorMessage, execute }
}
