import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderSuspended, mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { screen, fireEvent } from '@testing-library/vue'
import { nextTick, ref } from 'vue'
import HistoryPage from '../../../app/pages/history.vue'

const listData = ref<{ items: Partial<TrackerRequestResponse>[]; total: number } | null>(null)
const listError = ref<Error | null>(null)
const listPending = ref(false)

mockNuxtImport('useFetch', () => {
    return () => ({ data: listData, error: listError, pending: listPending, refresh: vi.fn(), execute: vi.fn() })
})

const groupData = ref<{ items: Partial<TrackerRequestResponse>[]; total: number } | null>(null)
const groupExecute = vi.fn()

mockNuxtImport('useGetTrackerRequestGroup', () => {
    return () => ({ data: groupData, pending: ref(false), error: ref(null), execute: groupExecute })
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
