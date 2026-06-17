import { renderSuspended } from '@nuxt/test-utils/runtime'
import { waitFor } from '@testing-library/vue'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockResolvedValue([])
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
            vi.clearAllMocks()

            parent.value = '/media'

            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalledWith('/api/paths', expect.objectContaining({ query: { parent: '/media' } }))
            })
        })

        it('fetches with no query when parent is cleared', async () => {
            const { Wrapper, parent } = makeWrapper()
            await renderSuspended(Wrapper)

            parent.value = '/media'
            await waitFor(() => expect(fetchMock).toHaveBeenCalled())
            vi.clearAllMocks()

            parent.value = ''

            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalledWith('/api/paths', expect.objectContaining({ query: undefined }))
            })
        })
    })

    describe('transform', () => {
        it('maps folder paths to folder icon and file paths to file icon', async () => {
            fetchMock.mockImplementation((_url: string, options?: { query?: { parent?: string } }) => {
                if (options?.query?.parent === '/media') {
                    return Promise.resolve([
                        { path: '/media/shows', folder: true },
                        { path: '/media/movie.mkv', folder: false },
                    ])
                }
                return Promise.resolve([])
            })

            const { Wrapper, parent, getComposable } = makeWrapper()
            await renderSuspended(Wrapper)

            parent.value = '/media'

            await waitFor(() => {
                expect(getComposable().data.value).toEqual([
                    { label: '/media/shows', value: '/media/shows', icon: 'i-lucide-folder', folder: true },
                    { label: '/media/movie.mkv', value: '/media/movie.mkv', icon: 'i-lucide-file', folder: false },
                ])
            })
        })
    })
})
