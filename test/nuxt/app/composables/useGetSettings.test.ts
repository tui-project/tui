import { renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockResolvedValue({ mediaPaths: [], tmdbApiKey: '', trackers: [], imageHostProviders: [], torrentClients: [] })
})

function makeWrapper() {
    let composable: ReturnType<typeof useGetSettings>
    const Wrapper = defineComponent({
        setup() {
            composable = useGetSettings()
        },
        template: '<div />',
    })
    return { Wrapper, getComposable: () => composable }
}

describe('useGetSettings', () => {
    it('fetches settings on mount', async () => {
        const { Wrapper } = makeWrapper()
        await renderSuspended(Wrapper)
        expect(fetchMock).toHaveBeenCalledWith('/api/settings', expect.objectContaining({}))
    })

    it('populates data after mount', async () => {
        const response = { mediaPaths: ['/media/a'], tmdbApiKey: 'key', trackers: [], imageHostProviders: [], torrentClients: [] }

        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        fetchMock.mockResolvedValue(response)
        await getComposable().refresh()

        expect(getComposable().data.value).toEqual(response)
    })

    it('sets error when fetch throws', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        fetchMock.mockRejectedValue(new Error('network error'))
        await getComposable().refresh()

        expect(getComposable().error.value).toBeDefined()
    })

    it('pending is false after mount', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().pending.value).toBe(false)
    })
})
