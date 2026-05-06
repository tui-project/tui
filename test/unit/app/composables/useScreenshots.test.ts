import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

describe('useScreenshots composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
        vi.stubGlobal('ref', ref)
    })

    it('creates screenshots and clears loading state on success', async () => {
        const response = {
            screenshots: [{ order: 1, url: 'https://full', thumbnailUrl: 'https://thumb' }],
        }
        const fetchMock = vi.fn().mockResolvedValue(response)
        vi.stubGlobal('$fetch', fetchMock)

        const { useScreenshots } = await import('../../../../app/composables/useScreenshots')
        const { createScreenshots, loading, error, errorMessage } = useScreenshots()

        await expect(createScreenshots('/media/movie.mkv', true, false)).resolves.toEqual(response)
        expect(fetchMock).toHaveBeenCalledWith('/api/screenshots', {
            method: 'POST',
            body: {
                path: '/media/movie.mkv',
                hdr: true,
                tv: false,
            },
        })
        expect(loading.value).toBe(false)
        expect(error.value).toBe(false)
        expect(errorMessage.value).toBe('')
    })

    it('formats missing settings errors', async () => {
        const fetchMock = vi.fn().mockRejectedValue({
            data: {
                message: 'missing_screenshot_settings',
                data: {
                    missingFields: ['FFmpeg Path', 'ImgBB API Key'],
                },
            },
        })
        vi.stubGlobal('$fetch', fetchMock)

        const { useScreenshots } = await import('../../../../app/composables/useScreenshots')
        const { createScreenshots, loading, error, errorMessage } = useScreenshots()

        await expect(createScreenshots('/media/movie.mkv', false, true)).resolves.toBeUndefined()
        expect(loading.value).toBe(false)
        expect(error.value).toBe(true)
        expect(errorMessage.value).toBe('Set FFmpeg Path, ImgBB API Key in Settings before generating screenshots.')
    })

    it('falls back to a generic error message and clearError resets state', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('boom'))
        vi.stubGlobal('$fetch', fetchMock)

        const { useScreenshots } = await import('../../../../app/composables/useScreenshots')
        const { createScreenshots, error, errorMessage, clearError } = useScreenshots()

        await createScreenshots('/media/movie.mkv', false, false)

        expect(error.value).toBe(true)
        expect(errorMessage.value).toBe('Failed to generate screenshots.')

        clearError()

        expect(error.value).toBe(false)
        expect(errorMessage.value).toBe('')
    })
})
