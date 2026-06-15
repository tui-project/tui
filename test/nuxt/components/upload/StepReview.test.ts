import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StepReview from '~/components/upload/StepReview.vue'

const { toastAddMock, navigateToMock } = vi.hoisted(() => ({
    toastAddMock: vi.fn(),
    navigateToMock: vi.fn(),
}))

const getSettingsMock = vi.fn()
const uploadTorrentMock = vi.fn()
const fetchTitleMock = vi.fn()
const getViolationsMock = vi.fn()
const getDuplicatesMock = vi.fn()
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

vi.mock('~/composables/useTrackerRules', () => ({
    useTrackerRules: () => ({
        getViolations: getViolationsMock,
        loading: ref(false),
        error: ref(false),
    }),
}))

vi.mock('~/composables/useTrackerDuplicates', () => ({
    useTrackerDuplicates: () => ({
        getDuplicates: getDuplicatesMock,
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
    language: ['English'],
    originalLanguage: 'English',
    sourceType: 'ENCODE',
    source: 'BluRay',
    repack: 0,
    proper: 0,
    rerip: 0,
    hybrid: false,
    hi10p: false,
    hasEnglishSubs: false,
    resolution: '1080p',
    hdr: [],
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    tmdbId: 1,
    imdbId: 'tt1234567',
}

const DEFAULT_TITLE = 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP'

describe('StepReview', () => {
    beforeEach(() => {
        getSettingsMock.mockReset()
        uploadTorrentMock.mockReset()
        fetchTitleMock.mockReset()
        getViolationsMock.mockReset()
        getDuplicatesMock.mockReset()
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
        getViolationsMock.mockResolvedValue([])
        getDuplicatesMock.mockResolvedValue([])
    })

    it('renders a card per selected tracker with a server-generated title and anonymous checkbox', async () => {
        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByText('Upload.cx (ULCX)')).toBeTruthy())
        expect(fetchTitleMock).toHaveBeenCalledWith('ULCX', expect.objectContaining({ title: 'Movie' }))
        await waitFor(() => expect(screen.getByPlaceholderText('Title for ULCX')).toHaveProperty('value', DEFAULT_TITLE))
        expect(screen.getByRole('checkbox', { name: 'Upload anonymously' })).toBeTruthy()
        expect(screen.getByRole('checkbox', { name: 'Opt in to mod queue' })).toBeTruthy()
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
                expect.objectContaining({ code: 'ULCX', title: DEFAULT_TITLE, titleModified: false, anonymous: false, modQueueOptIn: false }),
            ])
        })

        expect(toastAddMock).toHaveBeenCalledWith({
            title: 'Upload request submitted.',
            description: 'Your torrent is queued and available from the dashboard.',
            color: 'success',
        })
        expect(navigateToMock).toHaveBeenCalledWith('/')
    })

    it('Submit Upload button is disabled and does not call upload when metadata is absent', async () => {
        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], sourcePath: '/media/movie.mkv' },
        })

        const button = await screen.findByRole('button', { name: 'Submit Upload' })
        expect(button).toHaveProperty('disabled', true)
        expect(uploadTorrentMock).not.toHaveBeenCalled()
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

    it('shows Title is required and disables submit when title is cleared', async () => {
        const user = userEvent.setup()
        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByPlaceholderText('Title for ULCX')).toHaveProperty('value', DEFAULT_TITLE))
        await user.clear(screen.getByPlaceholderText('Title for ULCX'))

        await waitFor(() => expect(screen.getByText('Title is required')).toBeTruthy())
        expect(screen.getByRole('button', { name: 'Submit Upload' })).toHaveProperty('disabled', true)
    })

    it('renders anonymous and mod-queue checkboxes for each tracker', async () => {
        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Upload anonymously' })).toBeTruthy())
        expect(screen.getByRole('checkbox', { name: 'Opt in to mod queue' })).toBeTruthy()
    })

    it('toggles anonymous and modQueueOptIn checkboxes', async () => {
        const user = userEvent.setup()
        uploadTorrentMock.mockResolvedValue(undefined)

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Upload anonymously' })).toBeTruthy())
        await user.click(screen.getByRole('checkbox', { name: 'Upload anonymously' }))
        await user.click(screen.getByRole('checkbox', { name: 'Opt in to mod queue' }))
        await user.click(screen.getByRole('button', { name: 'Submit Upload' }))

        await waitFor(() =>
            expect(uploadTorrentMock).toHaveBeenCalledWith('/media/movie.mkv', metadata, undefined, [
                expect.objectContaining({ code: 'ULCX', anonymous: true, modQueueOptIn: true }),
            ])
        )
    })

    it('emits back when the Back button is clicked', async () => {
        const user = userEvent.setup()
        const { emitted } = await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy())
        await user.click(screen.getByRole('button', { name: 'Back' }))
        expect(emitted()).toHaveProperty('back')
    })

    it('shows loading skeletons while settings or titles are loading', async () => {
        settingsLoading.value = true

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
        })

        expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    })

    it('falls back to tracker code when tracker name is not in settings', async () => {
        getSettingsMock.mockResolvedValue({ trackers: [] })

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByText('ULCX')).toBeTruthy())
    })

    describe('duplicates', () => {
        it('shows all-trumpable alert and list when every duplicate is trumpable', async () => {
            getDuplicatesMock.mockResolvedValue([{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: true }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Existing releases will be trumped')).toBeTruthy())
            expect(screen.queryByText('Duplicates found on this tracker')).toBeNull()
        })

        it('pluralises the trumpable description when more than one release is trumpable', async () => {
            getDuplicatesMock.mockResolvedValue([
                { name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: true },
                { name: 'Movie.2024.1080p.WEB-DL.x265-GROUP', url: 'https://tracker.example.com/torrents/2', trumpable: true },
            ])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText(/2 existing releases on/)).toBeTruthy())
        })

        it('uses tracker code as fallback in trumpable description when tracker name is absent from settings', async () => {
            getSettingsMock.mockResolvedValue({ trackers: [] })
            getDuplicatesMock.mockResolvedValue([{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: true }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText(/will be trumped by this upload\./)).toBeTruthy())
            expect(screen.getByText(/on ULCX will be/)).toBeTruthy()
        })

        it('pluralises the non-trumpable description when more than one release is non-trumpable', async () => {
            getDuplicatesMock.mockResolvedValue([
                { name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false },
                { name: 'Movie.2024.1080p.WEB-DL.x265-GROUP', url: 'https://tracker.example.com/torrents/2', trumpable: false },
            ])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText(/2 existing releases found on/)).toBeTruthy())
        })

        it('uses tracker code as fallback in non-trumpable description when tracker name is absent from settings', async () => {
            getSettingsMock.mockResolvedValue({ trackers: [] })
            getDuplicatesMock.mockResolvedValue([{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText(/found on ULCX\./)).toBeTruthy())
        })

        it('shows the trumpable release name linked when url is present', async () => {
            getDuplicatesMock.mockResolvedValue([{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: true }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => {
                const link = screen.getByRole('link', { name: 'Movie.2024.1080p.WEB-DL.x264-GROUP' })
                expect(link).toHaveProperty('href', 'https://tracker.example.com/torrents/1')
            })
        })

        it('shows duplicate name as plain text when url is absent', async () => {
            getDuplicatesMock.mockResolvedValue([{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', trumpable: true }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Movie.2024.1080p.WEB-DL.x264-GROUP')).toBeTruthy())
            expect(screen.queryByRole('link', { name: 'Movie.2024.1080p.WEB-DL.x264-GROUP' })).toBeNull()
        })

        it('shows non-trumpable duplicates warning and skipped notice', async () => {
            getDuplicatesMock.mockResolvedValue([{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Duplicates found on this tracker — it will be skipped')).toBeTruthy())
            expect(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' })).toBeTruthy()
        })

        it('hides the skipped notice when user accepts duplicates', async () => {
            const user = userEvent.setup()
            getDuplicatesMock.mockResolvedValue([{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Duplicates found on this tracker — it will be skipped')).toBeTruthy())
            await user.click(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' }))
            await waitFor(() => expect(screen.queryByText('Duplicates found on this tracker — it will be skipped')).toBeNull())
        })

        it('disables Submit Upload when all trackers have non-trumpable duplicates', async () => {
            getDuplicatesMock.mockResolvedValue([{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Duplicates found on this tracker — it will be skipped')).toBeTruthy())
            expect(screen.getByRole('button', { name: 'Submit Upload' })).toHaveProperty('disabled', true)
        })

        it('shows mixed duplicates list with (trumpable) label for trumpable entries', async () => {
            getDuplicatesMock.mockResolvedValue([
                { name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: true },
                { name: 'Movie.2024.1080p.WEB-DL.x265-GROUP', url: 'https://tracker.example.com/torrents/2', trumpable: false },
            ])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Duplicates found on this tracker — it will be skipped')).toBeTruthy())
            expect(screen.getByText('(trumpable)')).toBeTruthy()
        })

        it('submits only trackers without unaccepted non-trumpable duplicates', async () => {
            const user = userEvent.setup()
            uploadTorrentMock.mockResolvedValue(undefined)
            getDuplicatesMock.mockImplementation((code: string) =>
                code === 'ULCX'
                    ? Promise.resolve([{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }])
                    : Promise.resolve([])
            )
            fetchTitleMock.mockImplementation((code: string) => Promise.resolve(`Title for ${code}`))

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX', 'ATH'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Upload' })).toBeTruthy())
            await user.click(screen.getByRole('button', { name: 'Submit Upload' }))

            await waitFor(() => expect(uploadTorrentMock).toHaveBeenCalledWith('/media/movie.mkv', metadata, undefined, [expect.objectContaining({ code: 'ATH' })]))
            expect(uploadTorrentMock).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.arrayContaining([expect.objectContaining({ code: 'ULCX' })])
            )
        })
    })

    describe('rule violations', () => {
        it('pluralises the violation description when more than one rule is violated', async () => {
            getViolationsMock.mockResolvedValue([
                { rule: 'banned_release_group', message: 'Release group "YIFY" is banned.' },
                { rule: 'missing_mediainfo', message: 'Mediainfo is required.' },
            ])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText(/This upload violates 2 rules/)).toBeTruthy())
        })

        it('uses tracker code as fallback in violation description when tracker name is absent from settings', async () => {
            getSettingsMock.mockResolvedValue({ trackers: [] })
            getViolationsMock.mockResolvedValue([{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned.' }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText(/for ULCX\./)).toBeTruthy())
        })

        it('shows violation message and skipped notice when tracker has an unaccepted violation', async () => {
            getViolationsMock.mockResolvedValue([{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Release group "YIFY" is banned on ULCX.')).toBeTruthy())
            expect(screen.getByText('Rule violations detected — this tracker will be skipped')).toBeTruthy()
            expect(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' })).toBeTruthy()
        })

        it('hides the skipped notice after user accepts the violation', async () => {
            const user = userEvent.setup()
            getViolationsMock.mockResolvedValue([{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Rule violations detected — this tracker will be skipped')).toBeTruthy())
            await user.click(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' }))
            await waitFor(() => expect(screen.queryByText('Rule violations detected — this tracker will be skipped')).toBeNull())
        })

        it('submits only trackers without unaccepted violations', async () => {
            const user = userEvent.setup()
            uploadTorrentMock.mockResolvedValue(undefined)
            getViolationsMock.mockImplementation((code: string) =>
                code === 'ULCX' ? Promise.resolve([{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }]) : Promise.resolve([])
            )
            fetchTitleMock.mockImplementation((code: string) => Promise.resolve(`Title for ${code}`))

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX', 'ATH'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Upload' })).toBeTruthy())
            await user.click(screen.getByRole('button', { name: 'Submit Upload' }))

            await waitFor(() => expect(uploadTorrentMock).toHaveBeenCalledWith('/media/movie.mkv', metadata, undefined, [expect.objectContaining({ code: 'ATH' })]))
            expect(uploadTorrentMock).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.arrayContaining([expect.objectContaining({ code: 'ULCX' })])
            )
        })

        it('includes a tracker with violations once the user accepts', async () => {
            const user = userEvent.setup()
            uploadTorrentMock.mockResolvedValue(undefined)
            getViolationsMock.mockResolvedValue([{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' })).toBeTruthy())
            await user.click(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' }))
            await user.click(screen.getByRole('button', { name: 'Submit Upload' }))

            await waitFor(() => expect(uploadTorrentMock).toHaveBeenCalledWith('/media/movie.mkv', metadata, undefined, [expect.objectContaining({ code: 'ULCX' })]))
        })

        it('disables Submit Upload when all trackers have unaccepted violations', async () => {
            getViolationsMock.mockResolvedValue([{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Rule violations detected — this tracker will be skipped')).toBeTruthy())
            expect(screen.getByRole('button', { name: 'Submit Upload' })).toHaveProperty('disabled', true)
        })

        it('preserves accepted violation state when metadata changes and violation remains', async () => {
            const user = userEvent.setup()
            getViolationsMock.mockResolvedValue([{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }])

            const { rerender } = await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' })).toBeTruthy())
            await user.click(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' }))
            await waitFor(() => expect(screen.getByText('Rule violations detected')).toBeTruthy())

            await rerender({ selectedTrackers: ['ULCX'], metadata: { ...metadata, year: 2023 }, sourcePath: '/media/movie.mkv' })

            await waitFor(() => expect(screen.getByText('Rule violations detected')).toBeTruthy())
            expect(screen.queryByText('Rule violations detected — this tracker will be skipped')).toBeNull()
        })
    })

    describe('duplicate acceptance state preservation', () => {
        it('preserves accepted duplicate state when metadata changes and duplicate remains', async () => {
            const user = userEvent.setup()
            getDuplicatesMock.mockResolvedValue([{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }])

            const { rerender } = await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Duplicates found on this tracker — it will be skipped')).toBeTruthy())
            await user.click(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' }))
            await waitFor(() => expect(screen.getByText('Duplicates found on this tracker')).toBeTruthy())

            await rerender({ selectedTrackers: ['ULCX'], metadata: { ...metadata, year: 2023 }, sourcePath: '/media/movie.mkv' })

            await waitFor(() => expect(screen.getByText('Duplicates found on this tracker')).toBeTruthy())
            expect(screen.queryByText('Duplicates found on this tracker — it will be skipped')).toBeNull()
        })

        it('shows non-trumpable duplicate name as plain text when url is absent', async () => {
            getDuplicatesMock.mockResolvedValue([{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', trumpable: false }])

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Movie.2024.1080p.WEB-DL.x264-GROUP')).toBeTruthy())
            expect(screen.queryByRole('link', { name: 'Movie.2024.1080p.WEB-DL.x264-GROUP' })).toBeNull()
        })
    })
})
