import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const executeMock = vi.fn()
const pendingRef = ref(false)
const dataRef = ref<{ title: string } | null>(null)
const errorRef = ref<unknown>(null)
let capturedUrlGetter: (() => string) | undefined

mockNuxtImport('useFetch', () => (url: (() => string) | string) => {
    capturedUrlGetter = typeof url === 'function' ? url : () => String(url)
    return { pending: pendingRef, data: dataRef, error: errorRef, execute: executeMock }
})

const metadata: Metadata = {
    title: 'Movie',
    originalTitle: 'Movie',
    releaseGroup: 'GROUP',
    mediaType: 'movie',
    year: 2024,
    season: undefined,
    episode: undefined,
    language: ['English'],
    originalLanguage: 'English',
    sourceType: 'ENCODE',
    source: 'BluRay',
    service: '',
    repack: 0,
    proper: 0,
    rerip: 0,
    cut: '',
    hybrid: false,
    hi10p: false,
    hasEnglishSubs: false,
    resolution: '1080p',
    hdr: [],
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    audioMetadata: '',
    tmdbId: 1,
    imdbId: 'tt1234567',
    tvdbId: undefined,
}

function makeWrapper() {
    let composable: ReturnType<typeof usePostTrackerTitle>
    const Wrapper = defineComponent({
        setup() {
            composable = usePostTrackerTitle()
        },
        template: '<div />',
    })
    return { Wrapper, getComposable: () => composable }
}

describe('usePostTrackerTitle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capturedUrlGetter = undefined
        dataRef.value = null
        errorRef.value = null
        pendingRef.value = false
        executeMock.mockResolvedValue(undefined)
    })

    it('does not call execute on mount', async () => {
        const { Wrapper } = makeWrapper()
        await renderSuspended(Wrapper)
        expect(executeMock).not.toHaveBeenCalled()
    })

    it('builds the correct URL for the tracker code when generateTitle is called', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().generateTitle('ATH', metadata)

        expect(capturedUrlGetter?.()).toBe('/api/tracker/ATH/title')
        expect(executeMock).toHaveBeenCalled()
    })

    it('uses the tracker code passed to generateTitle in subsequent calls', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().generateTitle('ULCX', metadata)
        expect(capturedUrlGetter?.()).toBe('/api/tracker/ULCX/title')

        await getComposable().generateTitle('ATH', metadata)
        expect(capturedUrlGetter?.()).toBe('/api/tracker/ATH/title')
    })

    it('exposes data from useFetch', async () => {
        executeMock.mockImplementation(async () => {
            dataRef.value = { title: 'Movie 2024 1080p BluRay H.264-GROUP' }
        })
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().generateTitle('ULCX', metadata)

        expect(getComposable().data.value).toEqual({ title: 'Movie 2024 1080p BluRay H.264-GROUP' })
    })

    it('exposes error from useFetch', async () => {
        executeMock.mockImplementation(async () => {
            errorRef.value = new Error('network error')
        })
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().generateTitle('ULCX', metadata)

        expect(getComposable().error.value).toBeDefined()
    })

    it('exposes pending from useFetch', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().pending.value).toBe(false)
    })
})
