import { renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockResolvedValue(null)
})

const defaultBody = {
    filepath: '/media/movie.mkv',
    metadata: {} as Metadata,
    description: 'A great film.',
    trackers: [{ code: 'TRK', title: 'Movie', titleModified: false, anonymous: false, modQueueOptIn: false }],
}

function makeWrapper(body = defaultBody) {
    const bodyRef = ref(body)
    let composable: ReturnType<typeof usePostTrackerRequests>
    const Wrapper = defineComponent({
        setup() {
            composable = usePostTrackerRequests(bodyRef)
        },
        template: '<div />',
    })
    return { Wrapper, getComposable: () => composable }
}

describe('usePostTrackerRequests', () => {
    it('does not fetch on mount', async () => {
        const { Wrapper } = makeWrapper()
        await renderSuspended(Wrapper)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('posts to /api/tracker/requests with the body ref when execute is called', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().execute()

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/tracker/requests',
            expect.objectContaining({
                method: 'POST',
                body: defaultBody,
            })
        )
    })

    it('error is null after a successful execute', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute()

        expect(getComposable().error.value).toBeFalsy()
    })

    it('sets error when fetch throws', async () => {
        fetchMock.mockRejectedValue(new Error('network error'))

        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute()

        expect(getComposable().error.value).toBeTruthy()
    })

    it('pending is false before and after execute', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().pending.value).toBe(false)
        await getComposable().execute()
        expect(getComposable().pending.value).toBe(false)
    })
})
