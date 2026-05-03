import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

describe('usePath composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
        vi.stubGlobal('ref', ref)
    })

    it('fetches without parent query when parent is blank', async () => {
        const fetchMock = vi.fn().mockResolvedValue([{ path: '/media', folder: true }])
        vi.stubGlobal('$fetch', fetchMock)

        const { usePath } = await import('../../../../app/composables/usePath')
        const { getPaths } = usePath()
        await getPaths('')

        expect(fetchMock).toHaveBeenCalledWith('/api/paths', { query: undefined })
    })

    it('fetches with parent query when parent is provided', async () => {
        const fetchMock = vi.fn().mockResolvedValue([{ path: '/media/file.mkv', folder: false }])
        vi.stubGlobal('$fetch', fetchMock)

        const { usePath } = await import('../../../../app/composables/usePath')
        const { getPaths } = usePath()
        await getPaths('/media')

        expect(fetchMock).toHaveBeenCalledWith('/api/paths', { query: { parent: '/media' } })
    })

    it('sets error when fetch fails', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
        vi.stubGlobal('$fetch', fetchMock)

        const { usePath } = await import('../../../../app/composables/usePath')
        const { getPaths, error, loading } = usePath()
        const result = await getPaths('/media')

        expect(result).toEqual([])
        expect(error.value).toBe(true)
        expect(loading.value).toBe(false)
    })

    it('does not call fetch when already loading', async () => {
        let resolveFetch: ((value: { path: string; folder: boolean }[]) => void) | undefined
        const fetchMock = vi.fn().mockImplementation(
            () =>
                new Promise<{ path: string; folder: boolean }[]>((resolve) => {
                    resolveFetch = resolve
                })
        )
        vi.stubGlobal('$fetch', fetchMock)

        const { usePath } = await import('../../../../app/composables/usePath')
        const { getPaths, loading } = usePath()
        const pending = getPaths('/media')

        expect(loading.value).toBe(true)
        await expect(getPaths('/media')).resolves.toEqual([])
        expect(fetchMock).toHaveBeenCalledTimes(1)

        resolveFetch?.([{ path: '/media', folder: true }])
        await pending
        expect(loading.value).toBe(false)
    })
})
