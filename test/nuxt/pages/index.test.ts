import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { screen } from '@testing-library/vue'
import { computed, nextTick, ref } from 'vue'
import IndexPage from '../../../app/pages/index.vue'

const useFetchData = ref<Partial<TrackerRequestResponse>[] | null>(null)
const useFetchListData = computed({
    get: () => (useFetchData.value === null ? null : { items: useFetchData.value, total: useFetchData.value.length }),
    set: (value) => {
        useFetchData.value = value?.items ?? null
    },
})
const useFetchError = ref<Error | null>(null)
const useFetchPending = ref(false)
const refreshMock = vi.fn()
const executeRetryMock = vi.fn()
let capturedRetryUrlGetter: (() => string) | null = null
let streamRequestHandler: ((request: TrackerRequestResponse) => void) | null = null
let streamReconnectHandler: (() => void | Promise<void>) | null = null

mockNuxtImport('useStreamTrackerRequests', () => {
    return (onRequest: (request: TrackerRequestResponse) => void, onReconnect: () => void | Promise<void>) => {
        streamRequestHandler = onRequest
        streamReconnectHandler = onReconnect
    }
})

mockNuxtImport('useApiFetch', () => {
    return (url: unknown) => {
        if (typeof url === 'function') {
            capturedRetryUrlGetter = url as () => string
            return { execute: executeRetryMock, status: ref('idle'), error: ref(null) }
        }
        return {
            data: useFetchListData,
            error: useFetchError,
            pending: useFetchPending,
            refresh: refreshMock,
        }
    }
})

const BASE_REQUEST = {
    groupId: 'group-1',
    metadata: { title: 'Movie', mediaType: 'movie' as const, year: 2024 } as TrackerRequestResponse['metadata'],
    description: '',
}

describe('index page', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        useFetchData.value = null
        useFetchError.value = null
        useFetchPending.value = false
        capturedRetryUrlGetter = null
        streamRequestHandler = null
        streamReconnectHandler = null
        refreshMock.mockReset()
        executeRetryMock.mockReset()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders recent upload requests and only shows progress for torrent_creation status', async () => {
        useFetchData.value = [
            {
                ...BASE_REQUEST,
                id: 'upload-2',
                filepath: '/media/Show.S01E01.mkv',
                status: 'torrent_creation',
                trackers: [
                    { code: 'ULCX', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false },
                    { code: 'ATH', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false },
                ],
                torrentCreationProgress: 42,
            },
            {
                ...BASE_REQUEST,
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'success',
                trackers: [{ code: 'BHD', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false }],
                torrentCreationProgress: 100,
            },
        ]

        await renderSuspended(IndexPage)

        expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeDefined()
        expect(screen.getByText('Show.S01E01.mkv')).toBeTruthy()
        expect(screen.getByText('ULCX')).toBeTruthy()
        expect(screen.getByText('ATH')).toBeTruthy()
        expect(screen.getByText('Torrent Creation')).toBeTruthy()
        expect(screen.getByText('42%')).toBeTruthy()
        expect(screen.getByText('Movie.2024.mkv')).toBeTruthy()
        expect(screen.getByText('Success')).toBeTruthy()
        expect(screen.queryByText('100%')).toBeNull()
    })

    it('renders skeleton loaders while the initial fetch is in progress', async () => {
        useFetchPending.value = true

        await renderSuspended(IndexPage)

        expect(screen.queryByText('No upload requests yet.')).toBeNull()
        expect(screen.queryByText('Unable to load recent upload requests.')).toBeNull()
    })

    it('renders an empty state when there are no upload requests', async () => {
        useFetchData.value = []

        await renderSuspended(IndexPage)

        expect(screen.getByText('No upload requests yet.')).toBeTruthy()
    })

    it('renders an error alert when requests fail to load', async () => {
        useFetchError.value = new Error('network error')

        await renderSuspended(IndexPage)

        expect(screen.getByText('Unable to load recent upload requests.')).toBeTruthy()
    })

    it('shows error badge and failed tracker codes for a failed request', async () => {
        useFetchData.value = [
            {
                ...BASE_REQUEST,
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'fail',
                trackers: [
                    { code: 'ULCX', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false },
                    { code: 'ATH', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false },
                ],
                failedTrackerCodes: ['ULCX', 'ATH'],
            },
        ]

        await renderSuspended(IndexPage)

        expect(screen.getByText('Fail')).toBeTruthy()
        expect(screen.getByText('Failed trackers: ULCX, ATH')).toBeTruthy()
    })

    it('shows warning badge and failed tracker codes for a partial_success request', async () => {
        useFetchData.value = [
            {
                ...BASE_REQUEST,
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'partial_success',
                trackers: [
                    { code: 'ULCX', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false },
                    { code: 'ATH', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false },
                ],
                failedTrackerCodes: ['ATH'],
            },
        ]

        await renderSuspended(IndexPage)

        expect(screen.getByText('Partial Success')).toBeTruthy()
        expect(screen.getByText('Failed trackers: ATH')).toBeTruthy()
    })

    it('shows 0% progress when torrent creation has not yet reported progress', async () => {
        useFetchData.value = [
            {
                ...BASE_REQUEST,
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'torrent_creation',
                trackers: [{ code: 'ULCX', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false }],
            },
        ]

        await renderSuspended(IndexPage)

        expect(screen.getByText('0%')).toBeTruthy()
    })

    it('updates an existing request from the stream without polling', async () => {
        useFetchData.value = []
        const request = {
            ...BASE_REQUEST,
            id: 'upload-1',
            filepath: '/media/Movie.mkv',
            status: 'pending' as const,
            trackers: [],
        }
        const otherRequest = {
            ...BASE_REQUEST,
            id: 'upload-2',
            filepath: '/media/Other.mkv',
            status: 'success' as const,
            trackers: [],
        }
        useFetchData.value = [request, otherRequest]

        await renderSuspended(IndexPage)
        streamRequestHandler?.({ ...request, status: 'torrent_creation', torrentCreationProgress: 42 })
        await nextTick()

        expect(refreshMock).toHaveBeenCalledTimes(0)
        expect(screen.getByText('42%')).toBeTruthy()
        expect(useFetchData.value?.[1]).toEqual(otherRequest)
    })

    it('prepends a newly streamed request and refreshes after reconnecting', async () => {
        useFetchData.value = []
        refreshMock.mockResolvedValue(undefined)

        await renderSuspended(IndexPage)
        streamRequestHandler?.({
            ...BASE_REQUEST,
            id: 'upload-new',
            filepath: '/media/New.mkv',
            status: 'pending',
            trackers: [],
        })
        await streamReconnectHandler?.()
        await nextTick()

        expect(screen.getByText('New.mkv')).toBeTruthy()
        expect(useFetchData.value).toHaveLength(1)
        expect(refreshMock).toHaveBeenCalledOnce()
    })

    it('ignores streamed requests until the initial list has loaded', async () => {
        await renderSuspended(IndexPage)

        streamRequestHandler?.({
            ...BASE_REQUEST,
            id: 'upload-new',
            filepath: '/media/New.mkv',
            status: 'pending',
            trackers: [],
        })

        expect(useFetchData.value).toBeNull()
    })

    it('shows neutral badge for a pending request without progress or failed trackers', async () => {
        useFetchData.value = [
            {
                ...BASE_REQUEST,
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'pending',
                trackers: [{ code: 'ULCX', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false }],
            },
        ]

        await renderSuspended(IndexPage)

        expect(screen.getByText('Pending')).toBeTruthy()
        expect(screen.queryByText('Creating torrent')).toBeNull()
        expect(screen.queryByText(/Failed trackers/)).toBeNull()
    })

    it('shows neutral badge for an uploading request without progress or failed trackers', async () => {
        useFetchData.value = [
            {
                ...BASE_REQUEST,
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'uploading',
                trackers: [{ code: 'ULCX', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false }],
            },
        ]

        await renderSuspended(IndexPage)

        expect(screen.getByText('Uploading')).toBeTruthy()
        expect(screen.queryByText('Creating torrent')).toBeNull()
        expect(screen.queryByText(/Failed trackers/)).toBeNull()
    })

    it('applies success color to tracker badge when upload succeeded', async () => {
        useFetchData.value = [
            {
                ...BASE_REQUEST,
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'success',
                trackers: [{ code: 'ULCX', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false, uploadStatus: 'success' }],
            },
        ]

        await renderSuspended(IndexPage)

        const badge = screen.getByText('ULCX').closest('.rounded-full, [class*="badge"]') ?? screen.getByText('ULCX')
        expect(badge).toBeTruthy()
    })

    it('applies error color to tracker badge when upload failed', async () => {
        useFetchData.value = [
            {
                ...BASE_REQUEST,
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'fail',
                trackers: [{ code: 'ULCX', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false, uploadStatus: 'failed' }],
                failedTrackerCodes: ['ULCX'],
            },
        ]

        await renderSuspended(IndexPage)

        expect(screen.getByText('ULCX')).toBeTruthy()
    })

    it('shows injection failed badge when torrentClientInjected is false', async () => {
        useFetchData.value = [
            {
                ...BASE_REQUEST,
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'success',
                trackers: [{ code: 'ULCX', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false, torrentClientInjected: false }],
            },
        ]

        await renderSuspended(IndexPage)

        expect(screen.getByText('Injection failed')).toBeTruthy()
        expect(screen.getByText('Torrent client injection failed for one or more trackers.')).toBeTruthy()
    })

    it('retries the request and refreshes the list when the retry button is clicked', async () => {
        executeRetryMock.mockResolvedValue(undefined)
        refreshMock.mockResolvedValue(undefined)
        useFetchData.value = [
            {
                ...BASE_REQUEST,
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'fail',
                trackers: [{ code: 'ULCX', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false }],
                failedTrackerCodes: ['ULCX'],
            },
        ]

        const user = (await import('@testing-library/user-event')).default.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
        await renderSuspended(IndexPage)

        await user.click(screen.getByRole('button', { name: /retry/i }))

        expect(executeRetryMock).toHaveBeenCalledTimes(1)
        expect(refreshMock).toHaveBeenCalledTimes(1)
        expect(capturedRetryUrlGetter?.()).toBe('/api/tracker/requests/upload-1')
    })
})
