import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'

let capturedQuery: { value: Record<string, unknown> } | undefined

mockNuxtImport('useFetch', () => {
    return (_url: unknown, options: { query: { value: Record<string, unknown> } }) => {
        capturedQuery = options.query
        return { pending: ref(false), data: ref(null), error: ref(null), refresh: vi.fn() }
    }
})

describe('useGetTrackerRequests', () => {
    it('passes undefined for all query params when no options are given', () => {
        useGetTrackerRequests()

        expect(capturedQuery?.value).toEqual({ page: undefined, size: undefined, withGroupCount: undefined })
    })

    it('forwards page, size and the group-count flag when provided', () => {
        useGetTrackerRequests({ page: ref(3), size: ref(15), withGroupCount: true })

        expect(capturedQuery?.value).toEqual({ page: 3, size: 15, withGroupCount: 'true' })
    })
})
