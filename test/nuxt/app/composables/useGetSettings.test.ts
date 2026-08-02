import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useFetchMock = vi.fn()
const pendingRef = ref(false)
const dataRef = ref<AppSettings | undefined>()
const errorRef = ref<Error | undefined>()
const refreshMock = vi.fn()

mockNuxtImport('useFetch', () => (url: string) => {
    useFetchMock(url)
    return { pending: pendingRef, data: dataRef, error: errorRef, refresh: refreshMock }
})

beforeEach(() => {
    vi.clearAllMocks()
    pendingRef.value = false
    dataRef.value = undefined
    errorRef.value = undefined
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
        expect(useFetchMock).toHaveBeenCalledWith('/api/settings')
    })

    it('populates data after mount', async () => {
        const response: AppSettings = {
            mediaPaths: ['/media/a'],
            tmdbApiKey: 'key',
            trackers: [],
            imageHostProviders: [],
            torrentClients: [],
            mediainfoPath: '',
            ffmpegPath: '',
            ffprobePath: '',
            movieScreenshotCount: 0,
            episodePackScreenshotCount: 0,
            logLevel: 0,
        }

        dataRef.value = response
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().data.value).toEqual(response)
    })

    it('sets error when fetch throws', async () => {
        errorRef.value = new Error('network error')
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().error.value).toBeDefined()
    })

    it('pending is false after mount', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().pending.value).toBe(false)
    })
})
