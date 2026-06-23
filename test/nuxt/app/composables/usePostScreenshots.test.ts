import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScreenshotBody, ScreenshotResponse } from '../../../../app/composables/usePostScreenshots'

const executeMock = vi.fn()
const pendingRef = ref(false)
const dataRef = ref<ScreenshotResponse | null>(null)
const errorRef = ref<unknown>(null)
let capturedBodyRef: Ref<ScreenshotBody | undefined> | undefined
let capturedTransform: ((res: ScreenshotResponse) => ScreenshotResponse) | undefined

mockNuxtImport('useFetch', () => (_url: string, options?: { body?: Ref<ScreenshotBody | undefined>; transform?: (res: ScreenshotResponse) => ScreenshotResponse }) => {
    capturedBodyRef = options?.body
    capturedTransform = options?.transform
    return { pending: pendingRef, data: dataRef, error: errorRef, execute: executeMock }
})

function makeWrapper() {
    let composable: ReturnType<typeof usePostScreenshots>
    const Wrapper = defineComponent({
        setup() {
            composable = usePostScreenshots()
        },
        template: '<div />',
    })
    return { Wrapper, getComposable: () => composable }
}

describe('usePostScreenshots', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capturedBodyRef = undefined
        capturedTransform = undefined
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
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().execute({ path: '/media/show.mkv', hdr: true, tv: true })

        expect(capturedBodyRef?.value).toEqual({ path: '/media/show.mkv', hdr: true, tv: true })
        expect(executeMock).toHaveBeenCalled()
    })

    it('sorts screenshots by order ascending via transform', async () => {
        const { Wrapper } = makeWrapper()
        await renderSuspended(Wrapper)
        const unsorted: ScreenshotResponse = {
            screenshots: [
                { order: 3, url: 'https://three', thumbnailUrl: 'https://thumb-three' },
                { order: 1, url: 'https://one', thumbnailUrl: 'https://thumb-one' },
                { order: 2, url: 'https://two', thumbnailUrl: 'https://thumb-two' },
            ],
        }
        const result = capturedTransform!(unsorted)
        expect(result.screenshots.map((s) => s.order)).toEqual([1, 2, 3])
    })

    it('exposes data from useFetch', async () => {
        const response: ScreenshotResponse = { screenshots: [{ order: 1, url: 'https://img', thumbnailUrl: 'https://thumb' }] }
        executeMock.mockImplementation(async () => {
            dataRef.value = response
        })
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute({ path: '/media/movie.mkv', hdr: false, tv: false })

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
            await getComposable().execute({ path: '/media/movie.mkv', hdr: false, tv: false })

            expect(getComposable().errorMessage.value).toBe('')
        })

        it('is generic when error is set without a known message', async () => {
            executeMock.mockImplementation(async () => {
                errorRef.value = new Error('boom')
            })
            const { Wrapper, getComposable } = makeWrapper()
            await renderSuspended(Wrapper)
            await getComposable().execute({ path: '/media/movie.mkv', hdr: false, tv: false })

            expect(getComposable().errorMessage.value).toBe('Failed to generate screenshots.')
        })

        it('formats missing settings fields from the error response', async () => {
            executeMock.mockImplementation(async () => {
                errorRef.value = { data: { message: 'missing_screenshot_settings', data: { missingFields: ['FFmpeg Path', 'ImgBB API Key'] } } }
            })
            const { Wrapper, getComposable } = makeWrapper()
            await renderSuspended(Wrapper)
            await getComposable().execute({ path: '/media/movie.mkv', hdr: false, tv: false })

            expect(getComposable().errorMessage.value).toBe('Set FFmpeg Path, ImgBB API Key in Settings before generating screenshots.')
        })

        it('falls back to a generic message for unrecognised errors', async () => {
            executeMock.mockImplementation(async () => {
                errorRef.value = new Error('boom')
            })
            const { Wrapper, getComposable } = makeWrapper()
            await renderSuspended(Wrapper)
            await getComposable().execute({ path: '/media/movie.mkv', hdr: false, tv: false })

            expect(getComposable().errorMessage.value).toBe('Failed to generate screenshots.')
        })
    })
})
