import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrackerRequestBody } from '../../../../app/composables/usePostTrackerRequests'

const executeMock = vi.fn()
const pendingRef = ref(false)
const errorRef = ref<unknown>(null)
let capturedBodyRef: Ref<TrackerRequestBody | undefined> | undefined

mockNuxtImport('useFetch', () => (_url: string, options?: { body?: Ref<TrackerRequestBody | undefined> }) => {
    capturedBodyRef = options?.body
    return { pending: pendingRef, error: errorRef, execute: executeMock }
})

const defaultBody: TrackerRequestBody = {
    filepath: '/media/movie.mkv',
    metadata: {} as Metadata,
    description: 'A great film.',
    trackers: [{ code: 'TRK', title: 'Movie', titleModified: false, anonymous: false, modQueueOptIn: false }],
}

function makeWrapper() {
    let composable: ReturnType<typeof usePostTrackerRequests>
    const Wrapper = defineComponent({
        setup() {
            composable = usePostTrackerRequests()
        },
        template: '<div />',
    })
    return { Wrapper, getComposable: () => composable }
}

describe('usePostTrackerRequests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capturedBodyRef = undefined
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

        await getComposable().execute(defaultBody)

        expect(capturedBodyRef?.value).toEqual(defaultBody)
        expect(executeMock).toHaveBeenCalled()
    })

    it('exposes error from useFetch', async () => {
        executeMock.mockImplementation(async () => {
            errorRef.value = new Error('network error')
        })
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute(defaultBody)

        expect(getComposable().error.value).toBeTruthy()
    })

    it('error is falsy after a successful execute', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute(defaultBody)

        expect(getComposable().error.value).toBeFalsy()
    })

    it('exposes pending from useFetch', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().pending.value).toBe(false)
    })
})
