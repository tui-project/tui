import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderSuspended, mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { screen } from '@testing-library/vue'
import { computed, ref } from 'vue'
import IndexPage from '../../../app/pages/index.vue'

const getRequestsMock = vi.fn()
const error = ref(false)

mockNuxtImport('useTrackerRequests', () => {
    return () => ({
        getRequests: getRequestsMock,
        error: computed(() => error.value),
        loading: ref(false),
    })
})

describe('index page', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        getRequestsMock.mockReset()
        error.value = false
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders recent upload requests and only shows progress for torrent_creation status', async () => {
        getRequestsMock.mockResolvedValue([
            {
                id: 'upload-2',
                filepath: '/media/Show.S01E01.mkv',
                status: 'torrent_creation',
                trackerCodes: ['FNP', 'ATH'],
                torrentCreationProgress: 42,
            },
            {
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'success',
                trackerCodes: ['BHD'],
                torrentCreationProgress: 100,
            },
        ])

        await renderSuspended(IndexPage)

        expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeDefined()
        expect(screen.getByText('Show.S01E01.mkv')).toBeTruthy()
        expect(screen.getByText('FNP')).toBeTruthy()
        expect(screen.getByText('ATH')).toBeTruthy()
        expect(screen.getByText('Torrent Creation')).toBeTruthy()
        expect(screen.getByText('42%')).toBeTruthy()
        expect(screen.getByText('Movie.2024.mkv')).toBeTruthy()
        expect(screen.getByText('Success')).toBeTruthy()
        expect(screen.queryByText('100%')).toBeNull()
    })

    it('renders an empty state when there are no upload requests', async () => {
        getRequestsMock.mockResolvedValue([])

        await renderSuspended(IndexPage)

        expect(screen.getByText('No upload requests yet.')).toBeTruthy()
    })

    it('renders an error alert when requests fail to load', async () => {
        getRequestsMock.mockResolvedValue(null)
        error.value = true

        await renderSuspended(IndexPage)

        expect(screen.getByText('Unable to load recent upload requests.')).toBeTruthy()
    })

    it('shows error badge and failed tracker codes for a failed request', async () => {
        getRequestsMock.mockResolvedValue([
            {
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'fail',
                trackerCodes: ['FNP', 'ATH'],
                failedTrackerCodes: ['FNP', 'ATH'],
            },
        ])

        await renderSuspended(IndexPage)

        expect(screen.getByText('Fail')).toBeTruthy()
        expect(screen.getByText('Failed trackers: FNP, ATH')).toBeTruthy()
    })

    it('shows warning badge and failed tracker codes for a partial_success request', async () => {
        getRequestsMock.mockResolvedValue([
            {
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'partial_success',
                trackerCodes: ['FNP', 'ATH'],
                failedTrackerCodes: ['ATH'],
            },
        ])

        await renderSuspended(IndexPage)

        expect(screen.getByText('Partial Success')).toBeTruthy()
        expect(screen.getByText('Failed trackers: ATH')).toBeTruthy()
    })

    it('renders skeleton loaders when no requests have loaded yet', async () => {
        getRequestsMock.mockResolvedValue(null)

        await renderSuspended(IndexPage)

        expect(screen.queryByText('No upload requests yet.')).toBeNull()
        expect(screen.queryByText('Unable to load recent upload requests.')).toBeNull()
    })

    it('shows 0% progress when torrent creation has not yet reported progress', async () => {
        getRequestsMock.mockResolvedValue([
            {
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'torrent_creation',
                trackerCodes: ['FNP'],
            },
        ])

        await renderSuspended(IndexPage)

        expect(screen.getByText('0%')).toBeTruthy()
    })

    it('polls for updated requests every 2 seconds', async () => {
        getRequestsMock.mockResolvedValue([])

        await renderSuspended(IndexPage)

        expect(getRequestsMock).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(2_000)

        expect(getRequestsMock).toHaveBeenCalledTimes(2)
    })

    it('clears the polling interval when the component is unmounted', async () => {
        getRequestsMock.mockResolvedValue([])
        const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

        const wrapper = await mountSuspended(IndexPage)
        await wrapper.unmount()

        expect(clearIntervalSpy).toHaveBeenCalled()
        clearIntervalSpy.mockRestore()
    })

    it('shows neutral badge for a pending request without progress or failed trackers', async () => {
        getRequestsMock.mockResolvedValue([
            {
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'pending',
                trackerCodes: ['FNP'],
            },
        ])

        await renderSuspended(IndexPage)

        expect(screen.getByText('Pending')).toBeTruthy()
        expect(screen.queryByText('Creating torrent')).toBeNull()
        expect(screen.queryByText(/Failed trackers/)).toBeNull()
    })

    it('shows neutral badge for an uploading request without progress or failed trackers', async () => {
        getRequestsMock.mockResolvedValue([
            {
                id: 'upload-1',
                filepath: '/media/Movie.2024.mkv',
                status: 'uploading',
                trackerCodes: ['FNP'],
            },
        ])

        await renderSuspended(IndexPage)

        expect(screen.getByText('Uploading')).toBeTruthy()
        expect(screen.queryByText('Creating torrent')).toBeNull()
        expect(screen.queryByText(/Failed trackers/)).toBeNull()
    })

    it('retains displayed requests when a poll returns null', async () => {
        getRequestsMock.mockResolvedValueOnce([{ id: 'req-1', filepath: '/media/Movie.mkv', status: 'success', trackerCodes: ['FNP'] }]).mockResolvedValueOnce(null)

        await renderSuspended(IndexPage)

        expect(screen.getByText('Movie.mkv')).toBeTruthy()

        await vi.advanceTimersByTimeAsync(2_000)

        expect(screen.getByText('Movie.mkv')).toBeTruthy()
    })
})
