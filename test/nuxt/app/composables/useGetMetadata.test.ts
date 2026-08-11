import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const executeMock = vi.fn()
const pendingRef = ref(false)
const dataRef = ref<{ filename: string; metadata: PartialMetadata } | null>(null)
const errorRef = ref<unknown>(null)
let capturedQuery: { path: Ref<string | undefined> } | undefined

mockNuxtImport('useApiFetch', () => (_url: string, options?: { query?: { path: Ref<string | undefined> } }) => {
    capturedQuery = options?.query
    return { pending: pendingRef, data: dataRef, error: errorRef, execute: executeMock }
})

function makeWrapper() {
    let composable: ReturnType<typeof useGetMetadata>
    const Wrapper = defineComponent({
        setup() {
            composable = useGetMetadata()
        },
        template: '<div />',
    })
    return { Wrapper, getComposable: () => composable }
}

describe('useGetMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capturedQuery = undefined
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

    it('sets the path query param and calls execute when execute is called', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().execute('/some/path')

        expect(capturedQuery?.path.value).toBe('/some/path')
        expect(executeMock).toHaveBeenCalled()
    })

    it('updates the path for each execute call', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().execute('/first/path')
        expect(capturedQuery?.path.value).toBe('/first/path')

        await getComposable().execute('/second/path')
        expect(capturedQuery?.path.value).toBe('/second/path')
    })

    it('exposes data from useApiFetch', async () => {
        const response = { filename: 'movie.mkv', metadata: { title: 'My Movie' } as PartialMetadata }
        executeMock.mockImplementation(async () => {
            dataRef.value = response
        })
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute('/some/path')

        expect(getComposable().data.value).toEqual(response)
    })

    it('exposes error from useApiFetch', async () => {
        executeMock.mockImplementation(async () => {
            errorRef.value = new Error('network error')
        })
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute('/some/path')

        expect(getComposable().error.value).toBeDefined()
    })

    it('exposes pending from useApiFetch', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().pending.value).toBe(false)
    })
})
