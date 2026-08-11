import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useFetchMock = vi.fn()
const pendingRef = ref(false)
const dataRef = ref<Path[] | undefined>()
const errorRef = ref<Error | undefined>()
const refreshMock = vi.fn()
let capturedOptions: { query: Ref<{ parent: string } | undefined>; transform: (paths: Array<{ path: string; folder: boolean }>) => Path[] } | undefined

mockNuxtImport('useApiFetch', () => (url: string, options: typeof capturedOptions) => {
    useFetchMock(url, options)
    capturedOptions = options
    return { pending: pendingRef, data: dataRef, error: errorRef, refresh: refreshMock }
})

beforeEach(() => {
    vi.clearAllMocks()
    pendingRef.value = false
    dataRef.value = undefined
    errorRef.value = undefined
    capturedOptions = undefined
})

function makeWrapper() {
    const parent = ref('')
    let composable: ReturnType<typeof useGetPaths>
    const Wrapper = defineComponent({
        setup() {
            composable = useGetPaths(parent)
            return composable
        },
        template: '<div />',
    })
    return { Wrapper, parent, getComposable: () => composable }
}

describe('useGetPaths', () => {
    describe('query derivation', () => {
        it('fetches with parent query when parent ref is set', async () => {
            const { Wrapper, parent } = makeWrapper()
            await renderSuspended(Wrapper)

            parent.value = '/media'

            expect(useFetchMock).toHaveBeenCalledWith('/api/paths', expect.objectContaining({ query: expect.anything() }))
            expect(capturedOptions?.query.value).toEqual({ parent: '/media' })
        })

        it('fetches with no query when parent is cleared', async () => {
            const { Wrapper, parent } = makeWrapper()
            await renderSuspended(Wrapper)

            parent.value = '/media'
            expect(capturedOptions?.query.value).toEqual({ parent: '/media' })

            parent.value = ''

            expect(capturedOptions?.query.value).toBeUndefined()
        })
    })

    describe('transform', () => {
        it('maps folder paths to folder icon and file paths to file icon', async () => {
            const { Wrapper } = makeWrapper()
            await renderSuspended(Wrapper)

            expect(
                capturedOptions?.transform([
                    { path: '/media/shows', folder: true },
                    { path: '/media/movie.mkv', folder: false },
                ])
            ).toEqual([
                { label: '/media/shows', value: '/media/shows', icon: 'i-lucide-folder', folder: true },
                { label: '/media/movie.mkv', value: '/media/movie.mkv', icon: 'i-lucide-file', folder: false },
            ])
        })
    })
})
