import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StepReview from '~/components/upload/StepReview.vue'
import type { Metadata } from '~/components/upload/upload.types'

const { toastAddMock, navigateToMock } = vi.hoisted(() => ({
    toastAddMock: vi.fn(),
    navigateToMock: vi.fn(),
}))

const getSettingsMock = vi.fn()
const uploadTorrentMock = vi.fn()
const fetchTitleMock = vi.fn()
const settingsLoading = ref(false)
const uploadLoading = ref(false)
const uploadError = ref(false)

vi.mock('~/composables/useSettings', () => ({
    useSettings: () => ({
        getSettings: getSettingsMock,
        loading: settingsLoading,
        error: ref(false),
    }),
}))

vi.mock('~/composables/useTrackerRequests', () => ({
    useTrackerRequests: () => ({
        uploadTorrent: uploadTorrentMock,
        loading: uploadLoading,
        error: uploadError,
    }),
}))

vi.mock('~/composables/useTrackerTitle', () => ({
    useTrackerTitle: () => ({
        getTitle: fetchTitleMock,
        loading: ref(false),
        error: ref(false),
    }),
}))

mockNuxtImport('useToast', () => () => ({ add: toastAddMock }))
mockNuxtImport('navigateTo', () => navigateToMock)

const metadata: Metadata = {
    fileName: 'Movie.2024.1080p.mkv',
    releaseGroup: 'GROUP',
    mediaType: 'movie',
    title: 'Movie',
    originalTitle: 'Movie',
    year: 2024,
    season: null,
    episode: null,
    language: ['English'],
    originalLanguage: 'English',
    sourceType: 'ENCODE',
    source: 'BluRay',
    service: '',
    repack: 0,
    proper: 0,
    rerip: false,
    threeD: false,
    cut: '',
    ratio: '',
    hybrid: false,
    hi10p: false,
    resolution: '1080p',
    hdr: [],
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    audioMetadata: '',
    tmdbId: 1,
    imdbId: 'tt1234567',
    tvdbId: null,
}

const DEFAULT_TITLE = 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP'

describe('StepReview', () => {
    beforeEach(() => {
        getSettingsMock.mockReset()
        uploadTorrentMock.mockReset()
        fetchTitleMock.mockReset()
        toastAddMock.mockReset()
        navigateToMock.mockReset()
        settingsLoading.value = false
        uploadLoading.value = false
        uploadError.value = false
        getSettingsMock.mockResolvedValue({
            trackers: [
                { code: 'ULCX', name: 'Upload.cx' },
                { code: 'ATH', name: 'Aither' },
            ],
        })
        fetchTitleMock.mockResolvedValue(DEFAULT_TITLE)
    })

    it('renders a card per selected tracker with a server-generated title and anonymous checkbox', async () => {
        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByText('Upload.cx (ULCX)')).toBeTruthy())
        expect(fetchTitleMock).toHaveBeenCalledWith('ULCX', expect.objectContaining({ title: 'Movie' }))
        await waitFor(() => expect(screen.getByPlaceholderText('Title for ULCX')).toHaveProperty('value', DEFAULT_TITLE))
        expect(screen.getByRole('checkbox', { name: 'Upload anonymously' })).toBeTruthy()
    })

    it('fetches titles for each selected tracker independently', async () => {
        fetchTitleMock.mockImplementation((code: string) => Promise.resolve(`Generated title for ${code}`))

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX', 'ATH'], metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByPlaceholderText('Title for ULCX')).toHaveProperty('value', 'Generated title for ULCX'))
        expect(screen.getByPlaceholderText('Title for ATH')).toHaveProperty('value', 'Generated title for ATH')
    })

    it('marks title as modified when user changes it from the fetched default', async () => {
        const user = userEvent.setup()
        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByPlaceholderText('Title for ULCX')).toHaveProperty('value', DEFAULT_TITLE))
        const input = screen.getByPlaceholderText('Title for ULCX')
        await user.clear(input)
        await user.type(input, 'Custom Title')

        await waitFor(() => expect(screen.getByText('Title modified from default')).toBeTruthy())
    })

    it('submits with overrides and navigates to dashboard on success', async () => {
        const user = userEvent.setup()
        uploadTorrentMock.mockResolvedValue(undefined)

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv', description: 'Release description' },
        })

        await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Upload' })).toBeTruthy())
        await user.click(screen.getByRole('button', { name: 'Submit Upload' }))

        await waitFor(() => {
            expect(uploadTorrentMock).toHaveBeenCalledWith('/media/movie.mkv', metadata, 'Release description', [
                expect.objectContaining({ code: 'ULCX', title: DEFAULT_TITLE, titleModified: false, anonymous: false }),
            ])
        })

        expect(toastAddMock).toHaveBeenCalledWith({
            title: 'Upload request submitted.',
            description: 'Your torrent is queued and available from the dashboard.',
            color: 'success',
        })
        expect(navigateToMock).toHaveBeenCalledWith('/')
    })

    it('shows an error alert and stays on the page when submission fails', async () => {
        const user = userEvent.setup()
        uploadTorrentMock.mockImplementation(async () => {
            uploadError.value = true
        })

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Upload' })).toBeTruthy())
        await user.click(screen.getByRole('button', { name: 'Submit Upload' }))

        await waitFor(() => expect(screen.getByText('Failed to submit upload request. Please try again.')).toBeTruthy())
        expect(toastAddMock).not.toHaveBeenCalled()
        expect(navigateToMock).not.toHaveBeenCalled()
    })

    it('Submit Upload button is disabled when no trackers are selected', async () => {
        await renderSuspended(StepReview, {
            props: { selectedTrackers: [], metadata, sourcePath: '/media/movie.mkv' },
        })

        const button = await screen.findByRole('button', { name: 'Submit Upload' })
        expect(button).toHaveProperty('disabled', true)
    })

    it('shows the no-trackers-selected message when selectedTrackers is empty', async () => {
        await renderSuspended(StepReview, {
            props: { selectedTrackers: [], metadata, sourcePath: '/media/movie.mkv' },
        })

        expect(await screen.findByText('No trackers selected. Go back and select at least one tracker.')).toBeTruthy()
    })

    it('re-fetches titles when selectedTrackers prop changes', async () => {
        fetchTitleMock.mockResolvedValue(DEFAULT_TITLE)
        const { rerender } = await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(fetchTitleMock).toHaveBeenCalledWith('ULCX', expect.any(Object)))

        fetchTitleMock.mockResolvedValue('ATH Title')
        await rerender({ selectedTrackers: ['ULCX', 'ATH'], metadata, sourcePath: '/media/movie.mkv' })

        await waitFor(() => expect(fetchTitleMock).toHaveBeenCalledWith('ATH', expect.any(Object)))
    })

    it('shows loading skeletons while settings or titles are loading', async () => {
        settingsLoading.value = true

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
        })

        expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    })
})
