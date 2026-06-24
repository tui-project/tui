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

const FILENAME = 'Movie.2024.1080p.BluRay.ENCODE.H.264.DTS-HD.MA.5.1-GROUP.mkv'

const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/paths') return [{ path: '/media/Movie.2024.mkv', folder: false }]
        if (url === '/api/metadata') return { filename: FILENAME, metadata: fetchedMetadata }
        if (url === '/api/settings') return { trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx' }] }
        if (url === '/api/tracker/ULCX/title') return { title: 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP' }
        if (url === '/api/tracker/ULCX/rules') return { violations: [] }
        if (url === '/api/tracker/ULCX/duplicates') return { duplicates: [] }
        return null
    })
    vi.stubGlobal('$fetch', fetchMock)
})

// Navigate to the metadata step and wait until the form is fully populated.
async function advanceToMetadata() {
    const user = userEvent.setup({ delay: null })
    await renderSuspended(UploadPage)

    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: '/media/Movie.2024.mkv' }))
    await waitFor(() => expect(screen.getByText('Selected file')).toBeTruthy())
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(screen.getByText('Review Metadata')).toBeTruthy())
    // Wait for the fetch response to propagate through useFetch → watch → state → DOM
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBe('Movie'))

    return user
}

// Navigate through all five steps and land on the Review step.
async function advanceToReview() {
    const user = await advanceToMetadata()
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(screen.getByText('Add the release notes and BBCode details you want included with this upload.')).toBeTruthy())
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' })).toBeTruthy())
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false))
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(screen.getByText('Review Upload')).toBeTruthy())
}

describe('upload page', () => {
    describe('initial render', () => {
        it('renders the Upload heading', async () => {
            await renderSuspended(UploadPage)
            expect(screen.getByRole('heading', { name: 'Upload', level: 1 })).toBeTruthy()
        })

        it('starts on the Select Media step', async () => {
            await renderSuspended(UploadPage)
            expect(await screen.findByText('Select media source')).toBeTruthy()
        })
    })

    describe('step 2 — metadata', () => {
        it('fetches and displays metadata for the selected file', async () => {
            await advanceToMetadata()

            expect(fetchMock).toHaveBeenCalledWith('/api/metadata', expect.anything())
            expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBe('Movie')
            expect(screen.getByLabelText('selected-file-or-folder').textContent).toContain(FILENAME)
        })

        it('does not re-fetch metadata when navigating back to metadata without changing the file', async () => {
            await advanceToMetadata()

            await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
            await waitFor(() => expect(screen.getByText('Select media source')).toBeTruthy())

            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            await waitFor(() => expect(screen.getByText('Review Metadata')).toBeTruthy())

            expect(screen.getByLabelText('selected-file-or-folder').textContent).toContain(FILENAME)
            expect(fetchMock.mock.calls.filter((args) => args[0] === '/api/metadata')).toHaveLength(1)
        })

        it('re-fetches metadata when a different file is selected', async () => {
            fetchMock.mockImplementation(async (url: string) => {
                if (url === '/api/paths')
                    return [
                        { path: '/media/Movie.2024.mkv', folder: false },
                        { path: '/media/Other.2023.mkv', folder: false },
                    ]
                if (url === '/api/metadata') return { filename: FILENAME, metadata: fetchedMetadata }
                return null
            })

            const user = userEvent.setup({ delay: null })
            await renderSuspended(UploadPage)

            await user.click(await screen.findByRole('combobox'))
            await user.click(await screen.findByRole('option', { name: '/media/Movie.2024.mkv' }))
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/metadata', expect.anything()))

            await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
            await waitFor(() => expect(screen.getByText('Select media source')).toBeTruthy())
            await user.click(screen.getByRole('combobox'))
            await user.click(await screen.findByRole('option', { name: '/media/Other.2023.mkv' }))

            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            await waitFor(() => expect(fetchMock.mock.calls.filter((args) => args[0] === '/api/metadata')).toHaveLength(2))
        })

        it('preserves filename after back-navigating to the metadata step', async () => {
            await advanceToMetadata()
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(screen.getByText('Add the release notes and BBCode details you want included with this upload.')).toBeTruthy())
            await fireEvent.click(screen.getByRole('button', { name: 'Back' }))

            await waitFor(() => expect(screen.getByText('Review Metadata')).toBeTruthy())
            expect(screen.getByLabelText('selected-file-or-folder').textContent).toContain(FILENAME)
        })
    })

    describe('step 3 — description', () => {
        it('updates description as the user types', async () => {
            const user = await advanceToMetadata()
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(screen.getByPlaceholderText('Description')).toBeTruthy())
            await user.type(screen.getByPlaceholderText('Description'), 'My release notes')
            expect((screen.getByPlaceholderText('Description') as HTMLTextAreaElement).value).toBe('My release notes')
        })
    })

    describe('step 4 — select trackers', () => {
        it('Next button is disabled until a tracker is checked', async () => {
            await advanceToMetadata()
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(screen.getByText('Add the release notes and BBCode details you want included with this upload.')).toBeTruthy())
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' })).toBeTruthy())
            expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true)
            expect(screen.queryByText('Review Upload')).toBeNull()
        })
    })

    describe('step 5 — review', () => {
        it('threads sourcePath, metadata and selectedTrackers to StepReview', async () => {
            await advanceToReview()

            await waitFor(() => expect(screen.getByPlaceholderText('Title for ULCX')).toBeTruthy())
            expect(fetchMock).toHaveBeenCalledWith(
                '/api/tracker/ULCX/title',
                expect.objectContaining({ body: expect.objectContaining({ metadata: expect.objectContaining({ title: 'Movie', year: 2024 }) }) })
            )
            expect(screen.getByRole('heading', { name: 'Upload.cx (ULCX)', level: 3 })).toBeTruthy()
        })

        it('goes back to Select Trackers step', async () => {
            await advanceToReview()
            await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
            await waitFor(() => expect(screen.getByText('Choose which trackers you want to upload this torrent to.')).toBeTruthy())
        })
    })
})
