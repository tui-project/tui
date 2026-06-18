import { renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockResolvedValue({ filename: 'movie.mkv', metadata: {} })
})

function makeWrapper(path?: string) {
    const pathRef = ref<string | undefined>(path)
    let composable: ReturnType<typeof useGetMetadata>
    const Wrapper = defineComponent({
        setup() {
            composable = useGetMetadata(pathRef)
        },
        template: '<div />',
    })
    return { Wrapper, getComposable: () => composable }
}

describe('useGetMetadata', () => {
    it('does not fetch on mount', async () => {
        const { Wrapper } = makeWrapper('/some/path')
        await renderSuspended(Wrapper)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('calls $fetch with the configured path when execute is called', async () => {
        const { Wrapper, getComposable } = makeWrapper('/some/path')
        await renderSuspended(Wrapper)

        await getComposable().execute()

        expect(fetchMock).toHaveBeenCalledWith('/api/metadata', expect.objectContaining({ query: { path: '/some/path' } }))
    })

    it('populates data after execute resolves', async () => {
        const response = { filename: 'movie.mkv', metadata: { title: 'My Movie' } }
        fetchMock.mockResolvedValue(response)

        const { Wrapper, getComposable } = makeWrapper('/some/path')
        await renderSuspended(Wrapper)

        await getComposable().execute()

        expect(getComposable().data.value).toEqual(response)
    })

    it('sets error when fetch throws', async () => {
        fetchMock.mockRejectedValue(new Error('network error'))

        const { Wrapper, getComposable } = makeWrapper('/some/path')
        await renderSuspended(Wrapper)

        await getComposable().execute()

        expect(getComposable().error.value).toBeDefined()
    })

    it('pending is false before and after execute', async () => {
        const { Wrapper, getComposable } = makeWrapper('/some/path')
        await renderSuspended(Wrapper)

        expect(getComposable().pending.value).toBe(false)
        await getComposable().execute()
        expect(getComposable().pending.value).toBe(false)
    })
})
