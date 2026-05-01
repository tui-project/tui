import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '../../../app/composables/useSettings'

describe('useSettings composable', () => {
    beforeEach(() => {
        vi.unstubAllGlobals()
    })

    it('loads settings successfully', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ mediaPaths: ['/media/a'] })
        vi.stubGlobal('$fetch', fetchMock)

        const { getSettings, loading, error } = useSettings()
        const result = await getSettings()

        expect(fetchMock).toHaveBeenCalledWith('/api/settings')
        expect(result).toEqual({ mediaPaths: ['/media/a'] })
        expect(loading.value).toBe(false)
        expect(error.value).toBe(false)
    })

    it('returns null and sets error when loading settings fails', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
        vi.stubGlobal('$fetch', fetchMock)

        const { getSettings, loading, error } = useSettings()
        const result = await getSettings()

        expect(result).toBeNull()
        expect(loading.value).toBe(false)
        expect(error.value).toBe(true)
    })

    it('saves settings successfully', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ mediaPaths: ['/media/a', '/media/b'] })
        vi.stubGlobal('$fetch', fetchMock)

        const { saveSettings, loading, error } = useSettings()
        const result = await saveSettings({ mediaPaths: ['/media/a', '/media/b'] })

        expect(fetchMock).toHaveBeenCalledWith('/api/settings', {
            method: 'POST',
            body: { mediaPaths: ['/media/a', '/media/b'] },
        })
        expect(result).toEqual({ mediaPaths: ['/media/a', '/media/b'] })
        expect(loading.value).toBe(false)
        expect(error.value).toBe(false)
    })

    it('returns null and sets error when saving settings fails', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
        vi.stubGlobal('$fetch', fetchMock)

        const { saveSettings, loading, error } = useSettings()
        const result = await saveSettings({ mediaPaths: ['/media/a'] })

        expect(result).toBeNull()
        expect(loading.value).toBe(false)
        expect(error.value).toBe(true)
    })

    it('does not call fetch when already loading', async () => {
        let resolveFetch: ((value: { mediaPaths: string[] }) => void) | undefined
        const fetchMock = vi.fn().mockImplementation(
            () =>
                new Promise<{ mediaPaths: string[] }>((resolve) => {
                    resolveFetch = resolve
                })
        )
        vi.stubGlobal('$fetch', fetchMock)

        const { getSettings, loading } = useSettings()
        const pending = getSettings()

        expect(loading.value).toBe(true)
        await expect(getSettings()).resolves.toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(1)

        resolveFetch?.({ mediaPaths: [] })
        await pending
        expect(loading.value).toBe(false)
    })

    it('does not call save fetch when already loading', async () => {
        let resolveFetch: ((value: { mediaPaths: string[] }) => void) | undefined
        const fetchMock = vi.fn().mockImplementation(
            () =>
                new Promise<{ mediaPaths: string[] }>((resolve) => {
                    resolveFetch = resolve
                })
        )
        vi.stubGlobal('$fetch', fetchMock)

        const { saveSettings, loading } = useSettings()
        const pending = saveSettings({ mediaPaths: ['/media/a'] })

        expect(loading.value).toBe(true)
        await expect(saveSettings({ mediaPaths: ['/media/b'] })).resolves.toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(1)

        resolveFetch?.({ mediaPaths: ['/media/a'] })
        await pending
        expect(loading.value).toBe(false)
    })
})
