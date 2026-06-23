import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '../../../../app/composables/useGetSettings'

const executeMock = vi.fn()
const pendingRef = ref(false)
const dataRef = ref<AppSettings | null>(null)
const errorRef = ref<unknown>(null)
let capturedBodyRef: Ref<AppSettings | undefined> | undefined

mockNuxtImport('useFetch', () => (_url: string, options?: { body?: Ref<AppSettings | undefined> }) => {
    capturedBodyRef = options?.body
    return { pending: pendingRef, data: dataRef, error: errorRef, execute: executeMock }
})

function buildSettings(overrides: Partial<AppSettings> = {}): AppSettings {
    return {
        mediaPaths: ['/media/a'],
        tmdbApiKey: '',
        imageHostProviders: [],
        trackers: [],
        torrentClients: [],
        mediainfoPath: 'mediainfo',
        ffmpegPath: 'ffmpeg',
        ffprobePath: 'ffprobe',
        movieScreenshotCount: 6,
        episodePackScreenshotCount: 3,
        logLevel: 3,
        ...overrides,
    }
}

function makeWrapper() {
    let composable: ReturnType<typeof usePostSettings>
    const Wrapper = defineComponent({
        setup() {
            composable = usePostSettings()
        },
        template: '<div />',
    })
    return { Wrapper, getComposable: () => composable }
}

describe('usePostSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capturedBodyRef = undefined
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

    it('sets the body ref and calls execute when execute is called', async () => {
        const settings = buildSettings({ tmdbApiKey: 'abc' })
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().execute(settings)

        expect(capturedBodyRef?.value).toEqual(settings)
        expect(executeMock).toHaveBeenCalled()
    })

    it('exposes data from useFetch', async () => {
        const response = buildSettings({ tmdbApiKey: 'saved' })
        executeMock.mockImplementation(async () => {
            dataRef.value = response
        })
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute(buildSettings())

        expect(getComposable().data.value).toEqual(response)
    })

    it('exposes pending from useFetch', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().pending.value).toBe(false)
    })

    describe('errorMessage', () => {
        it('is empty after a successful execute', async () => {
            const { Wrapper, getComposable } = makeWrapper()
            await renderSuspended(Wrapper)
            await getComposable().execute(buildSettings())

            expect(getComposable().errorMessage.value).toBe('')
        })

        it('uses the API message when error has a message field', async () => {
            executeMock.mockImplementation(async () => {
                errorRef.value = { data: { message: 'Media path does not exist: /missing' } }
            })
            const { Wrapper, getComposable } = makeWrapper()
            await renderSuspended(Wrapper)
            await getComposable().execute(buildSettings())

            expect(getComposable().errorMessage.value).toBe('Media path does not exist: /missing')
        })

        it('falls back to generic message when error has no message', async () => {
            executeMock.mockImplementation(async () => {
                errorRef.value = new Error('network')
            })
            const { Wrapper, getComposable } = makeWrapper()
            await renderSuspended(Wrapper)
            await getComposable().execute(buildSettings())

            expect(getComposable().errorMessage.value).toBe('An unexpected error occurred.')
        })
    })
})
