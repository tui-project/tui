import { mockNuxtImport, mountSuspended, renderSuspended } from '@nuxt/test-utils/runtime'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { isRef, ref, toValue, watch } from 'vue'
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
    videoBitrate: 12_000_000,
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    tmdbId: 1,
    imdbId: 'tt1234567',
}

const FILENAME = 'Movie.2024.1080p.BluRay.ENCODE.H.264.DTS-HD.MA.5.1-GROUP.mkv'

const sourceQuery = ref<Record<string, unknown>>({})
mockNuxtImport('useRoute', () => () => ({ query: sourceQuery.value }))

const fetchMock = vi.fn()
type UseFetchTestOptions = Record<string, unknown> & {
    query?: unknown
    body?: unknown
    transform?: (response: unknown) => unknown
    watch?: boolean
    immediate?: boolean
}

mockNuxtImport('useApiFetch', () => (request: string | (() => string), options: UseFetchTestOptions = {}) => {
    const pending = ref(false)
    const data = ref()
    const error = ref()

    async function execute() {
        pending.value = true
        error.value = undefined

        try {
            const resolvedOptions = typeof options === 'object' ? { ...options, query: resolveOptionObject(options.query), body: resolveOptionObject(options.body) } : options
            const response = await fetchMock(toValue(request), resolvedOptions)
            data.value = options.transform ? options.transform(response) : response
        } catch (fetchError) {
            error.value = fetchError
        } finally {
            pending.value = false
        }
    }

    if (options.watch !== false && isRef(options.query)) {
        watch(options.query, execute)
    }
    if (options.immediate !== false) {
        void execute()
    }

    return { pending, data, error, execute, refresh: execute }
})

function resolveOptionObject(value: unknown) {
    const resolvedValue = isRef(value) ? value.value : value
    if (!resolvedValue || typeof resolvedValue !== 'object' || Array.isArray(resolvedValue)) return resolvedValue

    return Object.fromEntries(Object.entries(resolvedValue).map(([key, entry]) => [key, isRef(entry) ? entry.value : entry]))
}

beforeEach(() => {
    vi.clearAllMocks()
    sourceQuery.value = {}
    fetchMock.mockImplementation(async (url: string) => {
        if (url === '/api/paths') return [{ path: '/media/Movie.2024.mkv', folder: false }]
        if (url === '/api/metadata') return { filename: FILENAME, metadata: fetchedMetadata }
        if (url === '/api/settings') return { trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx' }] }
        if (url === '/api/tracker/ULCX/title') return { title: 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP' }
        if (url === '/api/tracker/ULCX/rules') return { violations: [] }
        if (url === '/api/tracker/ULCX/duplicates') return { duplicates: [] }
        return null
    })
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
    // Wait for the fetch response to propagate through useApiFetch → watch → state → DOM
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBe('Movie'))

    return user
}

// Navigate through all five steps and land on the Review step.
async function advanceToReview() {
    await advanceToMetadata()
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' })).toBeTruthy())
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false))
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(screen.getByText('Review Upload')).toBeTruthy())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false))
}

describe('upload page', () => {
    describe('reuse an existing request', () => {
        it.each([false, true])('loads saved data and navigates back and forth for folder: %s', async (folder) => {
            sourceQuery.value = { source: 'saved-request' }
            const fallback = fetchMock.getMockImplementation()!
            fetchMock.mockImplementation(async (url, options) => {
                if (url === '/api/tracker/requests/saved-request')
                    return {
                        filepath: '/media/Movie.2024.mkv',
                        folder,
                        filename: FILENAME,
                        metadata: { ...fetchedMetadata, title: 'Saved title' },
                        description: 'Saved description\n\n[right][url=https://example.com]Uploaded using Tui v 0.1.0[/url][/right]',
                    }
                return fallback(url, options)
            })
            await renderSuspended(UploadPage)
            await screen.findByRole('checkbox', { name: 'Upload.cx (ULCX)' })
            expect(fetchMock.mock.calls.filter(([url]) => url === '/api/settings')).toHaveLength(1)
            expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true)
            expect(fetchMock.mock.calls.some(([url]) => url === '/api/paths')).toBe(false)
            await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
            expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveProperty('value', 'Saved title')
            expect(fetchMock.mock.calls.some(([url]) => url === '/api/paths')).toBe(false)
            await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
            expect(await screen.findByText(folder ? 'Selected folder' : 'Selected file')).toBeTruthy()
            expect(fetchMock.mock.calls.some(([url]) => url === '/api/paths')).toBe(true)
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            await screen.findByRole('textbox', { name: 'Title' })
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            await fireEvent.click(await screen.findByRole('checkbox', { name: 'Upload.cx (ULCX)' }))
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false))
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            expect(await screen.findByPlaceholderText('Description')).toHaveProperty('value', 'Saved description')
            await fireEvent.click(screen.getByRole('button', { name: 'Submit Upload' }))
            await waitFor(() =>
                expect(fetchMock).toHaveBeenCalledWith(
                    '/api/tracker/requests',
                    expect.objectContaining({
                        body: expect.objectContaining({
                            filepath: '/media/Movie.2024.mkv',
                            metadata: expect.objectContaining({ title: 'Saved title' }),
                            description: expect.stringContaining('Saved description'),
                        }),
                    })
                )
            )
            const body = fetchMock.mock.calls.find(([url]) => url === '/api/tracker/requests')![1].body
            expect(body.description.match(/Uploaded using Tui/g)).toHaveLength(1)
            expect(body).not.toHaveProperty('id')
            expect(fetchMock.mock.calls.some(([url]) => url === '/api/metadata')).toBe(false)
        })

        it('shows a loading state until the saved request arrives', async () => {
            sourceQuery.value = { source: 'saved-request' }
            let resolveSource!: (value: unknown) => void
            fetchMock.mockReturnValue(
                new Promise((resolve) => {
                    resolveSource = resolve
                })
            )
            const wrapper = await mountSuspended(UploadPage)
            expect(wrapper.findAllComponents({ name: 'USkeleton' })).toHaveLength(3)
            expect(wrapper.text()).not.toContain('Select media source')
            resolveSource(null)
            await waitFor(() => expect(wrapper.text()).toContain('Select media source'))
        })

        it('allows starting from media selection when loading fails', async () => {
            sourceQuery.value = { source: 'missing' }
            fetchMock.mockRejectedValue(new Error('not_found'))
            await renderSuspended(UploadPage)
            expect(await screen.findByText('Unable to reuse this upload request.')).toBeTruthy()
            expect(await screen.findByText('Select media source')).toBeTruthy()
        })

        it.each(['', ['one', 'two']])('ignores an invalid source query: %j', async (source) => {
            sourceQuery.value = { source }
            await renderSuspended(UploadPage)
            expect(await screen.findByText('Select media source')).toBeTruthy()
            expect(fetchMock.mock.calls.some(([url]) => url.startsWith('/api/tracker/requests/'))).toBe(false)
        })
    })

    describe('initial render', () => {
        it('renders the Upload heading', async () => {
            await renderSuspended(UploadPage)
            expect(screen.getByRole('heading', { name: 'Upload', level: 1 })).toBeTruthy()
        })

        it('starts on the Select Media step', async () => {
            await renderSuspended(UploadPage)
            expect(await screen.findByText('Select media source')).toBeTruthy()
        })

        it('labels Description as the final step', async () => {
            await renderSuspended(UploadPage)
            const stepTitles = screen.getAllByText(/Select Media|Metadata|Select Trackers|Review|Description/, { selector: '[data-slot="title"]' })
            expect(stepTitles.at(-1)?.textContent).toBe('Description')
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

        it('clears the description when a different path is selected', async () => {
            fetchMock.mockImplementation(async (url: string) => {
                if (url === '/api/paths')
                    return [
                        { path: '/media/Movie.2024.mkv', folder: false },
                        { path: '/media/Other.2023.mkv', folder: false },
                    ]
                if (url === '/api/metadata') return { filename: FILENAME, metadata: fetchedMetadata }
                if (url === '/api/settings') return { trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx' }] }
                if (url === '/api/tracker/ULCX/title') return { title: 'Movie title' }
                if (url === '/api/tracker/ULCX/rules') return { violations: [] }
                if (url === '/api/tracker/ULCX/duplicates') return { duplicates: [] }
                return null
            })

            const user = userEvent.setup({ delay: null })
            await advanceToReview()
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            await user.type(screen.getByPlaceholderText('Description'), 'Old description')

            await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
            await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
            await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
            await fireEvent.click(screen.getByRole('button', { name: 'Back' }))

            await user.click(screen.getByRole('combobox'))
            await user.click(await screen.findByRole('option', { name: '/media/Other.2023.mkv' }))

            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            await waitFor(() => expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBe('Movie'))
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            const trackerCheckbox = (await screen.findByRole('checkbox', { name: 'Upload.cx (ULCX)' })) as HTMLInputElement
            if (!trackerCheckbox.checked) await fireEvent.click(trackerCheckbox)
            await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false))
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            await waitFor(() => expect(screen.getByText('Review Upload')).toBeTruthy())
            await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false))
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            expect(((await screen.findByPlaceholderText('Description')) as HTMLTextAreaElement).value).toBe('')
        })

        it('preserves filename after back-navigating to the metadata step', async () => {
            await advanceToMetadata()
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(screen.getByText('Choose which trackers you want to upload this torrent to.')).toBeTruthy())
            await fireEvent.click(screen.getByRole('button', { name: 'Back' }))

            await waitFor(() => expect(screen.getByText('Review Metadata')).toBeTruthy())
            expect(screen.getByLabelText('selected-file-or-folder').textContent).toContain(FILENAME)
        })
    })

    describe('step 5 — description', () => {
        it('automatically adds the fetched logo to the description', async () => {
            fetchMock.mockImplementation(async (url: string) => {
                if (url === '/api/paths') return [{ path: '/media/Movie.2024.mkv', folder: false }]
                if (url === '/api/metadata') return { filename: FILENAME, metadata: fetchedMetadata, logoUrl: 'https://image.tmdb.org/t/p/original/logo.png' }
                if (url === '/api/settings') return { trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx' }] }
                if (url === '/api/tracker/ULCX/title') return { title: 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP' }
                if (url === '/api/tracker/ULCX/rules') return { violations: [] }
                if (url === '/api/tracker/ULCX/duplicates') return { duplicates: [] }
                return null
            })

            await advanceToReview()
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => {
                expect((screen.getByPlaceholderText('Description') as HTMLTextAreaElement).value).toBe(
                    '[center][img=500]https://image.tmdb.org/t/p/original/logo.png[/img][/center]'
                )
            })
        })

        it('updates description as the user types', async () => {
            const user = userEvent.setup({ delay: null })
            await advanceToReview()
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(screen.getByPlaceholderText('Description')).toBeTruthy())
            await user.type(screen.getByPlaceholderText('Description'), 'My release notes')
            expect((screen.getByPlaceholderText('Description') as HTMLTextAreaElement).value).toBe('My release notes')

            await fireEvent.click(screen.getByRole('button', { name: 'Submit Upload' }))
            await waitFor(() =>
                expect(fetchMock).toHaveBeenCalledWith(
                    '/api/tracker/requests',
                    expect.objectContaining({ body: expect.objectContaining({ description: expect.stringContaining('My release notes') }) })
                )
            )
        })

        it('stays on the description step and shows an error when the upload request fails', async () => {
            await advanceToReview()
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(screen.getByPlaceholderText('Description')).toBeTruthy())

            fetchMock.mockImplementation(async (url: string) => {
                if (url === '/api/tracker/requests') {
                    throw new Error('upload failed')
                }
                return null
            })

            await fireEvent.click(screen.getByRole('button', { name: 'Submit Upload' }))

            await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/tracker/requests', expect.anything()))
            await waitFor(() => expect(screen.getByText('Failed to submit upload request. Please try again.')).toBeTruthy())
            expect(screen.getByPlaceholderText('Description')).toBeTruthy()
        })
    })

    describe('step 3 — select trackers', () => {
        it('Next button is disabled until a tracker is checked', async () => {
            await advanceToMetadata()
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' })).toBeTruthy())
            expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true)
            expect(screen.queryByText('Review Upload')).toBeNull()
        })
    })

    describe('step 4 — review', () => {
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
