export type ScreenshotBody = { path: string; hdr: boolean; tv: boolean }
export type ScreenshotResponse = {
    screenshots: Array<{
        order: number
        url: string
        thumbnailUrl?: string
    }>
}

export function usePostScreenshots() {
    const bodyRef = ref<ScreenshotBody>()

    const {
        pending,
        data,
        error,
        execute: _execute,
    } = useFetch<ScreenshotResponse>('/api/screenshots', {
        method: 'POST',
        body: bodyRef,
        immediate: false,
        watch: false,
        transform: (res: ScreenshotResponse): ScreenshotResponse => ({
            ...res,
            screenshots: [...res.screenshots].sort((a, b) => a.order - b.order),
        }),
    })

    const errorMessage = computed(() => {
        const err = error.value as { data?: { message?: string; data?: { missingFields?: string[] } } } | undefined
        const missingFields = err?.data?.data?.missingFields

        if (err?.data?.message === 'missing_screenshot_settings' && missingFields && missingFields.length > 0) {
            return `Set ${missingFields.join(', ')} in Settings before generating screenshots.`
        }

        return err ? 'Failed to generate screenshots.' : ''
    })

    function execute(body: ScreenshotBody) {
        bodyRef.value = body

        return _execute()
    }

    return { pending, errorMessage, data, execute }
}
