import { renderSuspended } from '@nuxt/test-utils/runtime'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UploadPage from '../../../app/pages/upload.vue'

const fetchedMetadata: Metadata = {
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

const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()

    fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/paths') return [{ path: '/media/Movie.2024.mkv', folder: false }]
        if (url === '/api/metadata') return { filename: 'Movie.2024.1080p.BluRay.ENCODE.H.264.DTS-HD.MA.5.1-GROUP.mkv', metadata: fetchedMetadata }
        if (url === '/api/settings') return { trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx' }] }
        if (url === '/api/tracker/ULCX/title') return { title: 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP' }
        if (url === '/api/tracker/ULCX/rules') return { violations: [] }
        if (url === '/api/tracker/ULCX/duplicates') return { duplicates: [] }
        return null
    })

    vi.stubGlobal('$fetch', fetchMock)
})

// Walk through all five steps and land on the Review step.
async function advanceToReview() {
    const user = userEvent.setup()
    await renderSuspended(UploadPage)

    // Step 1 — Select Media
    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: '/media/Movie.2024.mkv' }))
    await waitFor(() => expect(screen.getByText('Selected file')).toBeTruthy())
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    // Step 2 — Metadata: wait for auto-fetch to populate then submit
    await waitFor(() => expect(screen.getByText('Review Metadata')).toBeTruthy())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/metadata', expect.anything()))
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    // Step 3 — Description
    await waitFor(() => expect(screen.getByText('Add the release notes and BBCode details you want included with this upload.')).toBeTruthy())
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    // Step 4 — Select Trackers: wait for settings, check ULCX, proceed
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' })).toBeTruthy())
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false))
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    // Step 5 — Review
    await waitFor(() => expect(screen.getByText('Review Upload')).toBeTruthy())
}

describe('upload page', () => {
    it('renders the Upload heading', async () => {
        await renderSuspended(UploadPage)
        expect(screen.getByRole('heading', { name: 'Upload', level: 1 })).toBeTruthy()
    })

    it('starts on the Select Media step', async () => {
        await renderSuspended(UploadPage)
        expect(await screen.findByText('Select media source')).toBeTruthy()
    })

    it('threads sourcePath to StepReview — tracker title input appears for the selected file', async () => {
        await advanceToReview()
        // StepReview calls /api/tracker/ULCX/title only when sourcePath is non-empty.
        // The title input placeholder is tracker-specific and only renders when the card loaded.
        await waitFor(() => expect(screen.getByPlaceholderText('Title for ULCX')).toBeTruthy())
    })

    it('threads metadata to StepReview — title API is called with the detected metadata', async () => {
        await advanceToReview()
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                '/api/tracker/ULCX/title',
                expect.objectContaining({ body: expect.objectContaining({ metadata: expect.objectContaining({ title: 'Movie', year: 2024 }) }) })
            )
        )
    })

    it('threads selectedTrackers to StepReview — tracker card rendered for selected tracker', async () => {
        await advanceToReview()
        // trackerNames[item.code] ?? item.code rendered as h3 inside the review card.
        // Only present when selectedTrackers contains 'ULCX' AND settings resolved the name.
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Upload.cx (ULCX)', level: 3 })).toBeTruthy())
    })

    it('Next button on Select Trackers is disabled until a tracker is checked', async () => {
        const user = userEvent.setup()
        await renderSuspended(UploadPage)

        await user.click(await screen.findByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: '/media/Movie.2024.mkv' }))
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/metadata', expect.anything()))
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => expect(screen.getByText('Add the release notes and BBCode details you want included with this upload.')).toBeTruthy())
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' })).toBeTruthy())
        // Next is disabled because no tracker is checked — stepper cannot advance to Review
        expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true)
        expect(screen.queryByText('Review Upload')).toBeNull()
    })

    it('re-fetches metadata when a different file is selected', async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url === '/api/paths')
                return [
                    { path: '/media/Movie.2024.mkv', folder: false },
                    { path: '/media/Other.2023.mkv', folder: false },
                ]
            if (url === '/api/metadata') return { filename: 'Movie.2024.1080p.BluRay.ENCODE.H.264.DTS-HD.MA.5.1-GROUP.mkv', metadata: fetchedMetadata }
            return null
        })

        const user = userEvent.setup()
        await renderSuspended(UploadPage)

        // Select first file and advance to metadata (fetch #1)
        await user.click(await screen.findByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: '/media/Movie.2024.mkv' }))
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/metadata', expect.anything()))

        // Go back and select a different file
        await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
        await waitFor(() => expect(screen.getByText('Select media source')).toBeTruthy())
        await user.click(screen.getByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: '/media/Other.2023.mkv' }))

        // Advance to metadata — should re-fetch for the new file
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        await waitFor(() => expect(fetchMock.mock.calls.filter((args) => args[0] === '/api/metadata')).toHaveLength(2))
    })

    it('updates description as the user types in the description step', async () => {
        const user = userEvent.setup()
        await renderSuspended(UploadPage)

        await user.click(await screen.findByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: '/media/Movie.2024.mkv' }))
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/metadata', expect.anything()))
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => expect(screen.getByPlaceholderText('Description')).toBeTruthy())
        await user.type(screen.getByPlaceholderText('Description'), 'My release notes')
        expect((screen.getByPlaceholderText('Description') as HTMLTextAreaElement).value).toBe('My release notes')
    })

    it('goes back from StepReview to StepSelectTrackers', async () => {
        await advanceToReview()
        await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
        await waitFor(() => expect(screen.getByText('Choose which trackers you want to upload this torrent to.')).toBeTruthy())
    })

    it('does not re-fetch metadata when navigating back to the metadata step without changing the file', async () => {
        const user = userEvent.setup()
        await renderSuspended(UploadPage)

        // Step 1 — select file and advance to metadata
        await user.click(await screen.findByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: '/media/Movie.2024.mkv' }))
        await waitFor(() => expect(screen.getByText('Selected file')).toBeTruthy())
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        // Wait for the initial fetch to complete
        await waitFor(() => expect(screen.getByLabelText('selected-file-or-folder').textContent).toContain('Movie.2024.1080p.BluRay.ENCODE.H.264.DTS-HD.MA.5.1-GROUP.mkv'))

        // Go back to Step 1 without submitting metadata
        await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
        await waitFor(() => expect(screen.getByText('Select media source')).toBeTruthy())

        // Go forward to Step 2 again
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        await waitFor(() => expect(screen.getByText('Review Metadata')).toBeTruthy())

        // Filename shown immediately (no loading state — restored from prefetched)
        expect(screen.getByLabelText('selected-file-or-folder').textContent).toContain('Movie.2024.1080p.BluRay.ENCODE.H.264.DTS-HD.MA.5.1-GROUP.mkv')
        // Metadata was fetched exactly once
        expect(fetchMock.mock.calls.filter((args) => args[0] === '/api/metadata')).toHaveLength(1)
    })

    it('preserves filename after back-navigating and re-submitting the metadata step', async () => {
        const user = userEvent.setup()
        await renderSuspended(UploadPage)

        // Step 1 — select file
        await user.click(await screen.findByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: '/media/Movie.2024.mkv' }))
        await waitFor(() => expect(screen.getByText('Selected file')).toBeTruthy())
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        // Step 2 — wait for fetch, submit
        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/metadata', expect.anything()))
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        // Step 3 — go back to metadata
        await waitFor(() => expect(screen.getByText('Add the release notes and BBCode details you want included with this upload.')).toBeTruthy())
        await fireEvent.click(screen.getByRole('button', { name: 'Back' }))

        // Re-submit from back-nav — filename.value must have been restored from model
        await waitFor(() => expect(screen.getByText('Review Metadata')).toBeTruthy())
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        // Back to metadata a second time — filename in the re-submitted model must not be empty
        await waitFor(() => expect(screen.getByText('Add the release notes and BBCode details you want included with this upload.')).toBeTruthy())
        await fireEvent.click(screen.getByRole('button', { name: 'Back' }))

        await waitFor(() => expect(screen.getByText('Review Metadata')).toBeTruthy())
        expect(screen.getByLabelText('selected-file-or-folder').textContent).toContain('Movie.2024.1080p.BluRay.ENCODE.H.264.DTS-HD.MA.5.1-GROUP.mkv')
    })
})
