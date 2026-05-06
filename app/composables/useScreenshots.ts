export type ScreenshotResponse = {
    screenshots: Array<{
        order: number
        url: string
        thumbnailUrl?: string
    }>
}

interface ScreenshotErrorData {
    message?: string
    data?: {
        missingFields?: string[]
    }
}

export function useScreenshots() {
    const loading = ref(false)
    const error = ref(false)
    const errorMessage = ref('')

    function clearError() {
        error.value = false
        errorMessage.value = ''
    }

    async function createScreenshots(path: string, hdr: boolean, tv: boolean): Promise<ScreenshotResponse | undefined> {
        loading.value = true
        clearError()

        try {
            return await $fetch<ScreenshotResponse>('/api/screenshots', {
                method: 'POST',
                body: {
                    path,
                    hdr,
                    tv,
                },
            })
        } catch (caughtError) {
            error.value = true
            errorMessage.value = getScreenshotErrorMessage(caughtError)
        } finally {
            loading.value = false
        }
    }

    return {
        createScreenshots,
        loading,
        error,
        errorMessage,
        clearError,
    }
}

function getScreenshotErrorMessage(caughtError: unknown) {
    const error = caughtError as { data?: ScreenshotErrorData }
    const missingFields = error.data?.data?.missingFields

    if (error.data?.message === 'missing_screenshot_settings' && missingFields && missingFields.length > 0) {
        return `Set ${missingFields.join(', ')} in Settings before generating screenshots.`
    }

    return 'Failed to generate screenshots.'
}
