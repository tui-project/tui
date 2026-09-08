import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderSuspended, mountSuspended, mockComponent, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { screen, fireEvent } from '@testing-library/vue'
import { nextTick, ref } from 'vue'
import HistoryPage from '../../../app/pages/history.vue'

const listData = ref<{ items: Partial<TrackerRequestResponse>[]; total: number } | null>(null)
const listError = ref<Error | null>(null)
const listPending = ref(false)
const executeRetryMock = vi.fn()

mockComponent('UTooltip', {
    props: ['text'],
    template: '<span :title="text"><slot /></span>',
})

mockNuxtImport('useApiFetch', () => {
    return () => ({ data: listData, error: listError, pending: listPending, refresh: vi.fn(), execute: vi.fn() })
})

const groupData = ref<{ items: Partial<TrackerRequestResponse>[]; total: number } | null>(null)
const groupExecute = vi.fn()

mockNuxtImport('useGetTrackerRequestGroup', () => {
    return () => ({ data: groupData, pending: ref(false), error: ref(null), execute: groupExecute })
})

mockNuxtImport('usePatchTrackerRequest', () => {
    return () => ({ execute: executeRetryMock, pending: ref(false), error: ref(null), data: ref(null) })
})

function buildTracker(overrides: Partial<TrackerItem> = {}): TrackerItem {
    return { code: 'ULCX', title: 'T', titleModified: false, anonymous: false, modQueueOptIn: false, ...overrides }
}

function buildItem(overrides: Partial<TrackerRequestResponse> = {}): Partial<TrackerRequestResponse> {
    return {
        id: 'r1',
        filepath: '/media/Movie.2024.mkv',
        groupId: 'g1',
        groupCount: 1,
        status: 'success',
        description: '',
        metadata: { title: 'Movie', mediaType: 'movie', year: 2024 } as TrackerRequestResponse['metadata'],
        trackers: [buildTracker()],
        createdAt: new Date('2026-06-20T10:00:00.000Z'),
        ...overrides,
    }
}

describe('history page', () => {
    beforeEach(() => {
        listData.value = null
        listError.value = null
        listPending.value = false
        groupData.value = null
        groupExecute.mockReset()
        groupExecute.mockResolvedValue(undefined)
        executeRetryMock.mockReset()
    })

    it('only links individual grouped uploads to the upload flow', async () => {
        listData.value = { items: [buildItem({ groupCount: 2 })], total: 1 }
        groupData.value = { items: [buildItem(), buildItem({ id: 'r0' })], total: 2 }
        await renderSuspended(HistoryPage)
        expect(screen.queryByRole('link', { name: 'Clone' })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()

        await fireEvent.click(screen.getByText('Movie.2024.mkv'))
        await nextTick()
        const cloneLinks = screen.getAllByRole('link', { name: 'Clone' })
        expect(cloneLinks.map((link) => link.getAttribute('href'))).toEqual(['/upload?source=r1', '/upload?source=r0'])

        await fireEvent.click(cloneLinks[0]!)
        expect(screen.getByText('Current')).toBeTruthy()
    })

    it('shows final-stage actions together and retries retryable requests', async () => {
        listData.value = {
            items: [
                buildItem({ id: 'success', status: 'success' }),
                buildItem({ id: 'failed', status: 'fail' }),
                buildItem({ id: 'pending', status: 'pending' }),
            ],
            total: 3,
        }
        executeRetryMock.mockResolvedValue(undefined)

        await renderSuspended(HistoryPage)

        const cloneLinks = screen.getAllByRole('link', { name: 'Clone' })
        const retryButton = screen.getByRole('button', { name: 'Retry' })
        expect(cloneLinks.map((link) => link.getAttribute('href'))).toEqual(['/upload?source=success', '/upload?source=failed'])
        expect(cloneLinks[0]!.parentElement?.getAttribute('title')).toBe('Clone')
        expect(retryButton.parentElement?.getAttribute('title')).toBe('Retry')
        expect(cloneLinks[1]!.closest('.flex')).toBe(retryButton.closest('.flex'))

        await fireEvent.click(cloneLinks[0]!)
        await fireEvent.click(retryButton)
        expect(executeRetryMock).toHaveBeenCalledWith('failed')
        expect(groupExecute).not.toHaveBeenCalled()
    })

    it.each([undefined, 'https://tracker.example/torrents/123'])('links trackers in rows and expanded uploads: %s', async (torrentUrl) => {
        listData.value = { items: [buildItem({ groupCount: 2, trackers: [buildTracker({ torrentUrl })] })], total: 1 }
        groupData.value = { items: [buildItem(), buildItem({ id: 'r0', trackers: [buildTracker({ code: 'ATH', torrentUrl })] })], total: 2 }
        await renderSuspended(HistoryPage)
        if (torrentUrl) {
            const link = screen.getByRole('link', { name: 'ULCX' })
            expect(link.getAttribute('href')).toBe(torrentUrl)
            expect(link.getAttribute('target')).toBe('_blank')
            expect(link.getAttribute('rel')).toBe('noopener noreferrer')
            await fireEvent.click(link)
            expect(groupExecute).not.toHaveBeenCalled()
        } else {
            expect(screen.queryByRole('link', { name: 'ULCX' })).toBeNull()
        }
        await fireEvent.click(screen.getByText('Movie.2024.mkv'))
        if (torrentUrl) {
            const link = screen.getByRole('link', { name: 'ATH' })
            expect(link.getAttribute('href')).toBe(torrentUrl)
            expect(link.getAttribute('target')).toBe('_blank')
            expect(link.getAttribute('rel')).toBe('noopener noreferrer')
            await fireEvent.click(link)
            expect(screen.getByText('Current')).toBeTruthy()
        } else {
            expect(screen.getByText('ATH')).toBeTruthy()
            expect(screen.queryByRole('link', { name: 'ATH' })).toBeNull()
        }
    })

    it('renders rows with a linked-uploads badge', async () => {
        listData.value = {
            items: [buildItem({ id: 'r1', groupCount: 2 }), buildItem({ id: 'r2', groupId: 'g2', filepath: '/media/Show.S01.mkv', status: 'fail' })],
            total: 2,
        }

        await renderSuspended(HistoryPage)

        expect(screen.getByRole('heading', { name: 'History', level: 1 })).toBeDefined()
        expect(screen.getByText('Movie.2024.mkv')).toBeTruthy()
        expect(screen.getByText('Show.S01.mkv')).toBeTruthy()
        expect(screen.getAllByText('ULCX').length).toBe(2)
        expect(screen.getByText('Success')).toBeTruthy()
        expect(screen.getByText('Fail')).toBeTruthy()
        expect(screen.getByText('2 uploads')).toBeTruthy()
    })

    it('renders an error alert when history fails to load', async () => {
        listError.value = new Error('network error')

        await renderSuspended(HistoryPage)

        expect(screen.getByText('Unable to load upload history.')).toBeTruthy()
    })

    it('renders skeleton loaders while the initial fetch is in progress', async () => {
        listPending.value = true

        await renderSuspended(HistoryPage)

        expect(screen.queryByText('No upload requests yet.')).toBeNull()
        expect(screen.queryByText('Unable to load upload history.')).toBeNull()
    })

    it('renders an empty state when there are no requests', async () => {
        listData.value = { items: [], total: 0 }

        await renderSuspended(HistoryPage)

        expect(screen.getByText('No upload requests yet.')).toBeTruthy()
    })

    it('renders an empty state before any data has loaded', async () => {
        listData.value = null

        await renderSuspended(HistoryPage)

        expect(screen.getByText('No upload requests yet.')).toBeTruthy()
    })

    it('renders an em dash when a request has no created date', async () => {
        listData.value = { items: [buildItem({ createdAt: undefined })], total: 1 }

        await renderSuspended(HistoryPage)

        expect(screen.getByText('—')).toBeTruthy()
    })

    it('lazily fetches and shows the lineage when a row is expanded', async () => {
        listData.value = { items: [buildItem({ id: 'r1', groupId: 'g1', groupCount: 2 })], total: 1 }
        groupData.value = {
            items: [
                buildItem({ id: 'r1', status: 'success', trackers: [buildTracker({ code: 'ULCX', uploadStatus: 'success' })] }),
                buildItem({ id: 'r0', status: 'fail', trackers: [buildTracker({ code: 'ATH', uploadStatus: 'failed' })], createdAt: new Date('2026-06-19T10:00:00.000Z') }),
            ],
            total: 2,
        }

        await renderSuspended(HistoryPage)
        await fireEvent.click(screen.getByText('Movie.2024.mkv'))

        expect(groupExecute).toHaveBeenCalled()
        expect(screen.getByText('Current')).toBeTruthy()
        expect(screen.getByText('Fail')).toBeTruthy()
        expect(screen.getByText('ATH')).toBeTruthy()

        await fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        expect(executeRetryMock).toHaveBeenCalledWith('r0')
    })

    it('does not expand when a single-upload row body is clicked', async () => {
        listData.value = { items: [buildItem({ id: 'r1', groupId: 'g1', groupCount: 1 })], total: 1 }

        await renderSuspended(HistoryPage)
        await fireEvent.click(screen.getByText('Movie.2024.mkv'))

        expect(groupExecute).not.toHaveBeenCalled()
        expect(screen.queryByText('No other uploads for this source.')).toBeNull()
    })

    it('treats a row with no group count as having no other uploads', async () => {
        listData.value = { items: [buildItem({ id: 'r1', groupId: 'g1', groupCount: undefined })], total: 1 }

        await renderSuspended(HistoryPage)
        await fireEvent.click(screen.getByText('Movie.2024.mkv'))

        expect(groupExecute).not.toHaveBeenCalled()
        expect(screen.queryByText('No other uploads for this source.')).toBeNull()
    })

    it('shows a message when an expanded source has no other uploads', async () => {
        listData.value = { items: [buildItem({ id: 'r1', groupId: 'g1', groupCount: 2 })], total: 1 }
        groupData.value = { items: [buildItem({ id: 'r1' })], total: 1 }

        await renderSuspended(HistoryPage)
        await fireEvent.click(screen.getByText('Movie.2024.mkv'))

        expect(screen.getByText('No other uploads for this source.')).toBeTruthy()
    })

    it('shows a loading skeleton while the group lineage is being fetched', async () => {
        listData.value = { items: [buildItem({ id: 'r1', groupId: 'g1', groupCount: 2 })], total: 1 }
        let resolveFetch: (() => void) | undefined
        groupExecute.mockReturnValue(new Promise<void>((resolve) => (resolveFetch = resolve)))

        const wrapper = await mountSuspended(HistoryPage)
        await wrapper.find('tbody tr').trigger('click')
        await nextTick()

        expect(wrapper.findAllComponents({ name: 'USkeleton' }).length).toBeGreaterThan(0)
        expect(wrapper.text()).not.toContain('No other uploads for this source.')
        expect(wrapper.text()).not.toContain('Current')

        resolveFetch?.()
    })

    it('collapses an expanded row when it is clicked again', async () => {
        listData.value = { items: [buildItem({ id: 'r1', groupId: 'g1', groupCount: 2 })], total: 1 }
        groupData.value = { items: [buildItem({ id: 'r1' })], total: 1 }

        await renderSuspended(HistoryPage)
        await fireEvent.click(screen.getByText('Movie.2024.mkv'))
        expect(screen.getByText('No other uploads for this source.')).toBeTruthy()

        await fireEvent.click(screen.getByText('Movie.2024.mkv'))
        expect(screen.queryByText('No other uploads for this source.')).toBeNull()
    })

    it('changes the page size and clears the expanded row when a new size is selected', async () => {
        listData.value = { items: [buildItem({ id: 'r1', groupId: 'g1', groupCount: 2 })], total: 30 }
        groupData.value = { items: [buildItem({ id: 'r1' })], total: 1 }

        const wrapper = await mountSuspended(HistoryPage)

        await wrapper.find('tbody tr').trigger('click')
        await new Promise((resolve) => setTimeout(resolve, 0))
        await nextTick()
        expect(wrapper.text()).toContain('No other uploads for this source.')

        await wrapper.findComponent({ name: 'USelect' }).vm.$emit('update:model-value', 50)
        await nextTick()

        expect(wrapper.text()).not.toContain('No other uploads for this source.')
    })

    it('renders pagination and clears the expanded row when the page changes', async () => {
        listData.value = { items: [buildItem({ id: 'r1', groupId: 'g1', groupCount: 2 })], total: 30 }
        groupData.value = { items: [buildItem({ id: 'r1' })], total: 1 }

        await renderSuspended(HistoryPage)
        await fireEvent.click(screen.getByText('Movie.2024.mkv'))
        expect(screen.getByText('No other uploads for this source.')).toBeTruthy()

        const pageTwo = screen.getAllByRole('button').find((button) => button.textContent?.trim() === '2')!
        await fireEvent.click(pageTwo)

        expect(screen.queryByText('No other uploads for this source.')).toBeNull()
    })
})
