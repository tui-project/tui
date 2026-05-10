import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StepUpload from '~/components/upload/StepUpload.vue'
import type { Metadata } from '~/components/upload/upload.types'

const { toastAddMock, navigateToMock } = vi.hoisted(() => ({
    toastAddMock: vi.fn(),
    navigateToMock: vi.fn(),
}))

const getSettingsMock = vi.fn()
const uploadTorrentMock = vi.fn()
const loading = ref(false)
const error = ref(false)
const uploadLoading = ref(false)
const uploadError = ref(false)

vi.mock('~/composables/useSettings', () => ({
    useSettings: () => ({
        getSettings: getSettingsMock,
        loading,
        error,
    }),
}))

vi.mock('~/composables/useTrackerRequests', () => ({
    useTrackerRequests: () => ({
        uploadTorrent: uploadTorrentMock,
        loading: uploadLoading,
        error: uploadError,
    }),
}))

mockNuxtImport('useToast', () => {
    return () => ({
        add: toastAddMock,
    })
})

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
    sourceType: 'BluRay',
    source: 'Blu-ray',
    service: '',
    repack: false,
    proper: false,
    cut: '',
    hybrid: false,
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

describe('StepUpload', () => {
    beforeEach(() => {
        getSettingsMock.mockReset()
        uploadTorrentMock.mockReset()
        toastAddMock.mockReset()
        navigateToMock.mockReset()
        loading.value = false
        error.value = false
        uploadLoading.value = false
        uploadError.value = false
    })

    it('loads only selected trackers from settings and toggles upload targets', async () => {
        const user = userEvent.setup()
        getSettingsMock.mockResolvedValue({
            trackers: [
                { selected: true, code: 'FNP', name: 'FearNoPeer' },
                { selected: false, code: 'ATH', name: 'Aither' },
                { selected: true, code: 'BHD', name: 'BeyondHD' },
            ],
        })

        const { emitted } = await renderSuspended(StepUpload, {
            props: {
                sourcePath: '/media/movie.mkv',
                metadata,
                modelValue: ['OLD'],
            },
        })

        await waitFor(() => {
            expect(getSettingsMock).toHaveBeenCalledTimes(1)
        })

        expect(screen.getByRole('checkbox', { name: 'FearNoPeer (FNP)' })).toBeTruthy()
        expect(screen.getByRole('checkbox', { name: 'BeyondHD (BHD)' })).toBeTruthy()
        expect(screen.queryByRole('checkbox', { name: 'Aither (ATH)' })).toBeNull()
        expect(screen.getByText('Selected trackers: 0')).toBeTruthy()

        await user.click(screen.getByRole('checkbox', { name: 'FearNoPeer (FNP)' }))

        await waitFor(() => {
            expect(screen.getByText('Selected trackers: 1')).toBeTruthy()
        })

        await user.click(screen.getByRole('checkbox', { name: 'FearNoPeer (FNP)' }))

        await waitFor(() => {
            expect(screen.getByText('Selected trackers: 0')).toBeTruthy()
        })

        const updateModelValueEvents = emitted()['update:modelValue'] as string[][] | undefined
        expect(updateModelValueEvents?.at(-2)?.[0]).toEqual(['FNP'])
        expect(updateModelValueEvents?.at(-1)?.[0]).toEqual([])
    })

    it('shows an empty state when no trackers are enabled in settings', async () => {
        getSettingsMock.mockResolvedValue({
            trackers: [{ selected: false, code: 'FNP', name: 'FearNoPeer' }],
        })

        await renderSuspended(StepUpload, {
            props: {
                sourcePath: '/media/movie.mkv',
                metadata,
            },
        })

        expect(await screen.findByText('Select at least one tracker in Settings to continue.')).toBeTruthy()
    })

    it('shows an error alert when trackers fail to load', async () => {
        getSettingsMock.mockResolvedValue(null)
        error.value = true

        await renderSuspended(StepUpload, {
            props: {
                sourcePath: '/media/movie.mkv',
                metadata,
            },
        })

        expect(await screen.findByText('Failed to load trackers from settings. Please try again.')).toBeTruthy()
    })

    it('shows a success toast and redirects to the dashboard when the upload request is accepted', async () => {
        const user = userEvent.setup()
        getSettingsMock.mockResolvedValue({
            trackers: [{ selected: true, code: 'FNP', name: 'FearNoPeer' }],
        })
        uploadTorrentMock.mockResolvedValue(undefined)

        await renderSuspended(StepUpload, {
            props: {
                sourcePath: '/media/movie.mkv',
                metadata,
                description: 'Release description',
            },
        })

        await user.click(await screen.findByRole('checkbox', { name: 'FearNoPeer (FNP)' }))
        await user.click(screen.getByRole('button', { name: 'Upload' }))

        await waitFor(() => {
            expect(uploadTorrentMock).toHaveBeenCalledWith('/media/movie.mkv', metadata, 'Release description', ['FNP'])
        })

        expect(toastAddMock).toHaveBeenCalledWith({
            title: 'Upload request submitted.',
            description: 'Your torrent is queued and available from the dashboard.',
            color: 'success',
        })
        expect(navigateToMock).toHaveBeenCalledWith('/')
    })

    it('stays on the upload step when the upload request fails', async () => {
        const user = userEvent.setup()
        getSettingsMock.mockResolvedValue({
            trackers: [{ selected: true, code: 'FNP', name: 'FearNoPeer' }],
        })
        uploadTorrentMock.mockImplementation(async () => {
            uploadError.value = true
        })

        await renderSuspended(StepUpload, {
            props: {
                sourcePath: '/media/movie.mkv',
                metadata,
                description: 'Release description',
            },
        })

        await user.click(await screen.findByRole('checkbox', { name: 'FearNoPeer (FNP)' }))
        await user.click(screen.getByRole('button', { name: 'Upload' }))

        await waitFor(() => {
            expect(uploadTorrentMock).toHaveBeenCalledWith('/media/movie.mkv', metadata, 'Release description', ['FNP'])
        })

        expect(toastAddMock).not.toHaveBeenCalled()
        expect(navigateToMock).not.toHaveBeenCalled()
        expect(screen.getByText('Failed to submit upload request. Please try again.')).toBeTruthy()
    })

    it('does not submit when the required upload data is missing', async () => {
        getSettingsMock.mockResolvedValue({
            trackers: [{ selected: true, code: 'FNP', name: 'FearNoPeer' }],
        })

        await renderSuspended(StepUpload, {
            props: {
                sourcePath: '   ',
            },
        })

        const uploadButton = await screen.findByRole('button', { name: 'Upload' })
        expect(uploadButton).toHaveProperty('disabled', true)

        await userEvent.click(uploadButton)

        expect(uploadTorrentMock).not.toHaveBeenCalled()
        expect(toastAddMock).not.toHaveBeenCalled()
        expect(navigateToMock).not.toHaveBeenCalled()
    })
})
