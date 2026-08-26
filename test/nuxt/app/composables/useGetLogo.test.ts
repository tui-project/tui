import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGetLogo } from '~/composables/useGetLogo'

const queryRef = ref()
const executeFetch = vi.fn()

mockNuxtImport('useApiFetch', () =>
    vi.fn((_url, options) => {
        queryRef.value = options.query
        return { pending: ref(false), error: ref(), data: ref(null), execute: executeFetch }
    })
)

describe('useGetLogo', () => {
    beforeEach(() => executeFetch.mockReset())

    it('executes the deferred request with the supplied query', async () => {
        executeFetch.mockResolvedValue(undefined)
        const composable = useGetLogo()

        await composable.execute({ tmdbId: 42, mediaType: 'tv', originalLanguage: 'ja' })

        expect(queryRef.value.value).toEqual({ tmdbId: 42, mediaType: 'tv', originalLanguage: 'ja' })
        expect(executeFetch).toHaveBeenCalledOnce()
    })
})
