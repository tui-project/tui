import { renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockResolvedValue({ screenshots: [] })
})

function makeWrapper(path = '/media/movie.mkv', hdr = false, tv = false) {
    const body = ref({ path, hdr, tv })
    let composable: ReturnType<typeof usePostScreenshots>
    const Wrapper = defineComponent({
        setup() {
            composable = usePostScreenshots(body)
        },
        template: '<div />',
    })
    return { Wrapper, getComposable: () => composable }
}

describe('usePostScreenshots', () => {
    it('does not fetch on mount', async () => {
        const { Wrapper } = makeWrapper()
        await renderSuspended(Wrapper)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('posts to /api/screenshots with the configured ref values when execute is called', async () => {
        const { Wrapper, getComposable } = makeWrapper('/media/show.mkv', true, true)
        await renderSuspended(Wrapper)

        await getComposable().execute()

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/screenshots',
            expect.objectContaining({
                method: 'POST',
                body: { path: '/media/show.mkv', hdr: true, tv: true },
            })
        )
    })

    it('populates data after execute resolves', async () => {
        const response = { screenshots: [{ order: 1, url: 'https://img', thumbnailUrl: 'https://thumb' }] }
        fetchMock.mockResolvedValue(response)

        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute()

        expect(getComposable().data.value).toEqual(response)
    })

    it('sorts screenshots by order ascending', async () => {
        fetchMock.mockResolvedValue({
            screenshots: [
                { order: 3, url: 'https://three', thumbnailUrl: 'https://thumb-three' },
                { order: 1, url: 'https://one', thumbnailUrl: 'https://thumb-one' },
                { order: 2, url: 'https://two', thumbnailUrl: 'https://thumb-two' },
            ],
        })

        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute()

        expect(getComposable().data.value?.screenshots.map((s) => s.order)).toEqual([1, 2, 3])
    })

    it('sets errorMessage when fetch throws', async () => {
        fetchMock.mockRejectedValue(new Error('network error'))

        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute()

        expect(getComposable().errorMessage.value).toBe('Failed to generate screenshots.')
    })

    describe('errorMessage', () => {
        it('is empty after a successful execute', async () => {
            const { Wrapper, getComposable } = makeWrapper()
            await renderSuspended(Wrapper)
            await getComposable().execute()

            expect(getComposable().errorMessage.value).toBe('')
        })

        it('formats missing settings fields from the error response', async () => {
            fetchMock.mockRejectedValue({
                data: { message: 'missing_screenshot_settings', data: { missingFields: ['FFmpeg Path', 'ImgBB API Key'] } },
            })

            const { Wrapper, getComposable } = makeWrapper()
            await renderSuspended(Wrapper)
            await getComposable().execute()

            expect(getComposable().errorMessage.value).toBe('Set FFmpeg Path, ImgBB API Key in Settings before generating screenshots.')
        })

        it('falls back to a generic message for unrecognised errors', async () => {
            fetchMock.mockRejectedValue(new Error('boom'))

            const { Wrapper, getComposable } = makeWrapper()
            await renderSuspended(Wrapper)
            await getComposable().execute()

            expect(getComposable().errorMessage.value).toBe('Failed to generate screenshots.')
        })
    })

    it('pending is false before and after execute', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().pending.value).toBe(false)
        await getComposable().execute()
        expect(getComposable().pending.value).toBe(false)
    })
})
