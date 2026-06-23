import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const executeMock = vi.fn()
const pendingRef = ref(false)
const dataRef = ref<{ items: TrackerRequest[]; total: number } | null>(null)
const errorRef = ref<unknown>(null)
let capturedQuery: { groupId: Ref<string | undefined> } | undefined

mockNuxtImport('useFetch', () => (_url: string, options?: { query?: { groupId: Ref<string | undefined> } }) => {
    capturedQuery = options?.query
    return { pending: pendingRef, data: dataRef, error: errorRef, execute: executeMock }
})

function makeWrapper() {
    let composable: ReturnType<typeof useGetTrackerRequestGroup>
    const Wrapper = defineComponent({
        setup() {
            composable = useGetTrackerRequestGroup()
        },
        template: '<div />',
    })
    return { Wrapper, getComposable: () => composable }
}

describe('useGetTrackerRequestGroup', () => {
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

    it('sets the groupId query param and calls execute when execute is called', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().execute('group-abc')

        expect(capturedQuery?.groupId.value).toBe('group-abc')
        expect(executeMock).toHaveBeenCalled()
    })

    it('updates the groupId for each execute call', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        await getComposable().execute('group-1')
        expect(capturedQuery?.groupId.value).toBe('group-1')

        await getComposable().execute('group-2')
        expect(capturedQuery?.groupId.value).toBe('group-2')
    })

    it('exposes data from useFetch', async () => {
        const items: TrackerRequest[] = [{ id: '1', filepath: '/media/movie.mkv', metadata: {} as Metadata, description: '', status: 'pending', trackers: [] }]
        executeMock.mockImplementation(async () => {
            dataRef.value = { items, total: 1 }
        })
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute('group-abc')

        expect(getComposable().data.value).toEqual({ items, total: 1 })
    })

    it('exposes error from useFetch', async () => {
        executeMock.mockImplementation(async () => {
            errorRef.value = new Error('network error')
        })
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)
        await getComposable().execute('group-abc')

        expect(getComposable().error.value).toBeDefined()
    })

    it('exposes pending from useFetch', async () => {
        const { Wrapper, getComposable } = makeWrapper()
        await renderSuspended(Wrapper)

        expect(getComposable().pending.value).toBe(false)
    })
})
