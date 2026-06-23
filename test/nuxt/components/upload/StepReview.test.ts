import { mockNuxtImport, renderSuspended } from '@nuxt/test-utils/runtime'
import { screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StepReview from '~/components/upload/StepReview.vue'

const { toastAddMock, navigateToMock } = vi.hoisted(() => ({
    toastAddMock: vi.fn(),
    navigateToMock: vi.fn(),
}))

const fetchTitleMock = vi.fn()
let capturedTrackerCode: { value: string } | null = null
const titleDataRef = ref<{ title: string } | null>(null)
const titleLoadingRef = ref(false)
const titleErrorRef = ref<Error | null>(null)
const fetchRulesMock = vi.fn()
let capturedRulesTrackerCode: { value: string } | null = null
const rulesDataRef = ref<{ violations: { rule: string; message: string }[] } | null>(null)
const rulesLoadingRef = ref(false)
const rulesErrorRef = ref<Error | null>(null)
const duplicatesExecuteMock = vi.fn()
let capturedDuplicatesTrackerCode: { value: string } | null = null
const duplicatesDataRef = ref<{ duplicates: Array<{ name: string; url?: string; trumpable: boolean }> } | null>(null)
const duplicatesLoadingRef = ref(false)
const duplicatesErrorRef = ref<Error | null>(null)
const settingsLoading = ref(false)
const settingsData = ref<{ trackers: Array<{ code: string; name: string }> } | null>(null)

const executeUploadMock = vi.fn()
const uploadPending = ref(false)
const uploadError = ref<boolean | null>(null)
type UploadBody = { filepath: string; metadata: Metadata; description: string | undefined; trackers: TrackerItem[] } | null
let capturedUploadBody: { value: UploadBody } | null = null

vi.mock('~/composables/useGetSettings', () => ({
    useGetSettings: () => ({
        pending: settingsLoading,
        data: settingsData,
        error: ref(null),
        refresh: vi.fn(),
    }),
}))

vi.mock('~/composables/usePostTrackerTitle', () => ({
    usePostTrackerTitle: () => ({
        pending: titleLoadingRef,
        data: titleDataRef,
        error: titleErrorRef,
        generateTitle: (code: string, _metadata: Metadata) => {
            capturedTrackerCode = { value: code }
            return fetchTitleMock()
        },
    }),
}))

vi.mock('~/composables/usePostTrackerRules', () => ({
    usePostTrackerRules: () => ({
        pending: rulesLoadingRef,
        data: rulesDataRef,
        error: rulesErrorRef,
        execute: (code: string, _metadata: Metadata) => {
            capturedRulesTrackerCode = { value: code }
            return fetchRulesMock()
        },
    }),
}))

vi.mock('~/composables/usePostTrackerDuplicates', () => ({
    usePostTrackerDuplicates: () => ({
        pending: duplicatesLoadingRef,
        data: duplicatesDataRef,
        error: duplicatesErrorRef,
        execute: (code: string, _metadata: Metadata) => {
            capturedDuplicatesTrackerCode = { value: code }
            return duplicatesExecuteMock()
        },
    }),
}))

mockNuxtImport('useToast', () => () => ({ add: toastAddMock }))
mockNuxtImport('navigateTo', () => navigateToMock)
mockNuxtImport('useFetch', () => (url: string, options?: { body?: { value: UploadBody } }) => {
    if (url === '/api/tracker/requests') {
        capturedUploadBody = options?.body ?? null
        return {
            pending: uploadPending,
            error: uploadError,
            execute: executeUploadMock,
        }
    }
    return { pending: ref(false), error: ref(null), execute: vi.fn() }
})

const metadataFields: Metadata = {
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

const metadata: { filename: string; metadata: Metadata } = {
    filename: 'Movie.2024.1080p.mkv',
    metadata: metadataFields,
}

const DEFAULT_TITLE = 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP'

describe('StepReview', () => {
    beforeEach(() => {
        executeUploadMock.mockReset()
        fetchTitleMock.mockReset()
        fetchRulesMock.mockReset()
        duplicatesExecuteMock.mockReset()
        toastAddMock.mockReset()
        navigateToMock.mockReset()
        capturedTrackerCode = null
        capturedRulesTrackerCode = null
        capturedDuplicatesTrackerCode = null
        titleDataRef.value = { title: DEFAULT_TITLE }
        titleLoadingRef.value = false
        titleErrorRef.value = null
        rulesLoadingRef.value = false
        rulesErrorRef.value = null
        rulesDataRef.value = null
        duplicatesLoadingRef.value = false
        duplicatesErrorRef.value = null
        duplicatesDataRef.value = null
        fetchTitleMock.mockResolvedValue(undefined)
        fetchRulesMock.mockImplementation(async () => {
            rulesDataRef.value = { violations: [] }
        })
        duplicatesExecuteMock.mockImplementation(async () => {
            duplicatesDataRef.value = { duplicates: [] }
        })
        settingsLoading.value = false
        settingsData.value = {
            trackers: [
                { code: 'ULCX', name: 'Upload.cx' },
                { code: 'ATH', name: 'Aither' },
            ],
        }
        uploadPending.value = false
        uploadError.value = null
        capturedUploadBody = null
    })

    it('renders a card per selected tracker with a server-generated title and anonymous checkbox', async () => {
        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByText('Upload.cx (ULCX)')).toBeTruthy())
        await waitFor(() => expect(fetchTitleMock).toHaveBeenCalled())
        expect(capturedTrackerCode?.value).toBe('ULCX')
        await waitFor(() => expect(screen.getByPlaceholderText('Title for ULCX')).toHaveProperty('value', DEFAULT_TITLE))
        expect(screen.getByRole('checkbox', { name: 'Upload anonymously' })).toBeTruthy()
        expect(screen.getByRole('checkbox', { name: 'Opt in to mod queue' })).toBeTruthy()
    })

    it('fetches titles for each selected tracker independently', async () => {
        fetchTitleMock.mockImplementation(async () => {
            titleDataRef.value = { title: `Generated title for ${capturedTrackerCode?.value}` }
        })

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX', 'ATH'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByPlaceholderText('Title for ULCX')).toHaveProperty('value', 'Generated title for ULCX'))
        await waitFor(() => expect(screen.getByPlaceholderText('Title for ATH')).toHaveProperty('value', 'Generated title for ATH'))
    })

    it('marks title as modified when user changes it from the fetched default', async () => {
        const user = userEvent.setup({ delay: null })
        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByPlaceholderText('Title for ULCX')).toHaveProperty('value', DEFAULT_TITLE))
        const input = screen.getByPlaceholderText('Title for ULCX')
        await user.clear(input)
        await user.type(input, 'Custom Title')

        await waitFor(() => expect(screen.getByText('Title modified from default')).toBeTruthy())
    })

    it('submits with overrides and navigates to dashboard on success', async () => {
        const user = userEvent.setup({ delay: null })
        executeUploadMock.mockResolvedValue(undefined)

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv', description: 'Release description' },
        })

        await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Upload' })).toBeTruthy())
        await user.click(screen.getByRole('button', { name: 'Submit Upload' }))

        await waitFor(() => expect(executeUploadMock).toHaveBeenCalled())

        expect(capturedUploadBody?.value).toMatchObject({
            filepath: '/media/movie.mkv',
            description: 'Release description',
            trackers: [expect.objectContaining({ code: 'ULCX', title: DEFAULT_TITLE, titleModified: false, anonymous: false, modQueueOptIn: false })],
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
        expect(executeUploadMock).not.toHaveBeenCalled()
    })

    it('shows an error alert and stays on the page when submission fails', async () => {
        const user = userEvent.setup({ delay: null })
        executeUploadMock.mockImplementation(async () => {
            uploadError.value = true
        })

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Upload' })).toBeTruthy())
        await user.click(screen.getByRole('button', { name: 'Submit Upload' }))

        await waitFor(() => expect(screen.getByText('Failed to submit upload request. Please try again.')).toBeTruthy())
        expect(toastAddMock).not.toHaveBeenCalled()
        expect(navigateToMock).not.toHaveBeenCalled()
    })

    it('Submit Upload button is disabled when no trackers are selected', async () => {
        await renderSuspended(StepReview, {
            props: { selectedTrackers: [], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        const button = await screen.findByRole('button', { name: 'Submit Upload' })
        expect(button).toHaveProperty('disabled', true)
    })

    it('shows the no-trackers-selected message when selectedTrackers is empty', async () => {
        await renderSuspended(StepReview, {
            props: { selectedTrackers: [], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        expect(await screen.findByText('No trackers selected. Go back and select at least one tracker.')).toBeTruthy()
    })

    it('shows Title is required and disables submit when title is cleared', async () => {
        const user = userEvent.setup({ delay: null })
        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByPlaceholderText('Title for ULCX')).toHaveProperty('value', DEFAULT_TITLE))
        await user.clear(screen.getByPlaceholderText('Title for ULCX'))

        await waitFor(() => expect(screen.getByText('Title is required')).toBeTruthy())
        expect(screen.getByRole('button', { name: 'Submit Upload' })).toHaveProperty('disabled', true)
    })

    it('toggles anonymous and modQueueOptIn checkboxes', async () => {
        const user = userEvent.setup({ delay: null })
        executeUploadMock.mockResolvedValue(undefined)

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Upload anonymously' })).toBeTruthy())
        await user.click(screen.getByRole('checkbox', { name: 'Upload anonymously' }))
        await user.click(screen.getByRole('checkbox', { name: 'Opt in to mod queue' }))
        await user.click(screen.getByRole('button', { name: 'Submit Upload' }))

        await waitFor(() => expect(executeUploadMock).toHaveBeenCalled())
        expect(capturedUploadBody?.value).toMatchObject({
            trackers: [expect.objectContaining({ code: 'ULCX', anonymous: true, modQueueOptIn: true })],
        })
    })

    it('emits back when the Back button is clicked', async () => {
        const user = userEvent.setup({ delay: null })
        const { emitted } = await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy())
        await user.click(screen.getByRole('button', { name: 'Back' }))
        expect(emitted()).toHaveProperty('back')
    })

    it.each([
        [
            'settingsLoading',
            () => {
                settingsLoading.value = true
            },
        ],
        [
            'titleLoading',
            () => {
                titleLoadingRef.value = true
            },
        ],
        [
            'rulesLoading',
            () => {
                rulesLoadingRef.value = true
            },
        ],
        [
            'duplicatesLoading',
            () => {
                duplicatesLoadingRef.value = true
            },
        ],
    ])('shows loading skeletons while %s is true', async (_, setLoading) => {
        setLoading()

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    })

    it('shows load error and skips tracker when title generation fails', async () => {
        titleErrorRef.value = new Error('title error')

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByText('Failed to load tracker data — this tracker will be skipped')).toBeTruthy())
        expect(screen.getByText('Failed to generate title')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Submit Upload' })).toHaveProperty('disabled', true)
    })

    it('falls back to tracker code when tracker name is not in settings', async () => {
        settingsData.value = { trackers: [] }

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByText('ULCX')).toBeTruthy())
    })

    describe('duplicates', () => {
        it('shows all-trumpable alert and list when every duplicate is trumpable', async () => {
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = { duplicates: [{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: true }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Existing releases will be trumped')).toBeTruthy())
            expect(screen.queryByText('Duplicates found on this tracker')).toBeNull()
        })

        it('pluralises the trumpable description when more than one release is trumpable', async () => {
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = {
                    duplicates: [
                        { name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: true },
                        { name: 'Movie.2024.1080p.WEB-DL.x265-GROUP', url: 'https://tracker.example.com/torrents/2', trumpable: true },
                    ],
                }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText(/2 existing releases on/)).toBeTruthy())
        })

        it('uses tracker code as fallback in trumpable description when tracker name is absent from settings', async () => {
            settingsData.value = { trackers: [] }
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = { duplicates: [{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: true }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText(/on ULCX will be/)).toBeTruthy())
        })

        it('pluralises the non-trumpable description when more than one release is non-trumpable', async () => {
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = {
                    duplicates: [
                        { name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false },
                        { name: 'Movie.2024.1080p.WEB-DL.x265-GROUP', url: 'https://tracker.example.com/torrents/2', trumpable: false },
                    ],
                }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText(/2 existing releases found on/)).toBeTruthy())
        })

        it('uses tracker code as fallback in non-trumpable description when tracker name is absent from settings', async () => {
            settingsData.value = { trackers: [] }
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = { duplicates: [{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText(/found on ULCX\./)).toBeTruthy())
        })

        it('shows the trumpable release name linked when url is present', async () => {
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = { duplicates: [{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: true }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => {
                const link = screen.getByRole('link', { name: 'Movie.2024.1080p.WEB-DL.x264-GROUP' })
                expect(link).toHaveProperty('href', 'https://tracker.example.com/torrents/1')
            })
        })

        it('shows duplicate name as plain text when url is absent', async () => {
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = { duplicates: [{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', trumpable: true }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Movie.2024.1080p.WEB-DL.x264-GROUP')).toBeTruthy())
            expect(screen.queryByRole('link', { name: 'Movie.2024.1080p.WEB-DL.x264-GROUP' })).toBeNull()
        })

        it('shows non-trumpable duplicates warning and skipped notice', async () => {
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = { duplicates: [{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Duplicates found on this tracker — it will be skipped')).toBeTruthy())
            expect(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' })).toBeTruthy()
        })

        it('hides the skipped notice when user accepts duplicates', async () => {
            const user = userEvent.setup({ delay: null })
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = { duplicates: [{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Duplicates found on this tracker — it will be skipped')).toBeTruthy())
            await user.click(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' }))
            await waitFor(() => expect(screen.queryByText('Duplicates found on this tracker — it will be skipped')).toBeNull())
        })

        it('disables Submit Upload when all trackers have non-trumpable duplicates', async () => {
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = { duplicates: [{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Duplicates found on this tracker — it will be skipped')).toBeTruthy())
            expect(screen.getByRole('button', { name: 'Submit Upload' })).toHaveProperty('disabled', true)
        })

        it('shows mixed duplicates list with (trumpable) label for trumpable entries', async () => {
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = {
                    duplicates: [
                        { name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: true },
                        { name: 'Movie.2024.1080p.WEB-DL.x265-GROUP', url: 'https://tracker.example.com/torrents/2', trumpable: false },
                    ],
                }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Duplicates found on this tracker — it will be skipped')).toBeTruthy())
            expect(screen.getByText('(trumpable)')).toBeTruthy()
        })

        it('submits only trackers without unaccepted non-trumpable duplicates', async () => {
            const user = userEvent.setup({ delay: null })
            executeUploadMock.mockResolvedValue(undefined)
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = {
                    duplicates:
                        capturedDuplicatesTrackerCode?.value === 'ULCX'
                            ? [{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }]
                            : [],
                }
            })
            fetchTitleMock.mockImplementation(async () => {
                titleDataRef.value = { title: `Title for ${capturedTrackerCode?.value}` }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX', 'ATH'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Upload' })).toBeTruthy())
            await user.click(screen.getByRole('button', { name: 'Submit Upload' }))

            await waitFor(() => expect(executeUploadMock).toHaveBeenCalled())
            expect(capturedUploadBody?.value?.trackers).toEqual([expect.objectContaining({ code: 'ATH' })])
            expect(capturedUploadBody?.value?.trackers).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ULCX' })]))
        })
    })

    describe('rule violations', () => {
        it.each([
            [1, /This upload violates 1 rule for/],
            [2, /This upload violates 2 rules for/],
        ])('violation description counts %i rule(s) with correct pluralisation', async (count, pattern) => {
            fetchRulesMock.mockImplementation(async () => {
                rulesDataRef.value = { violations: Array.from({ length: count }, (_, i) => ({ rule: `rule_${i}`, message: `Message ${i}.` })) }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText(pattern)).toBeTruthy())
        })

        it('uses tracker code as fallback in violation description when tracker name is absent from settings', async () => {
            settingsData.value = { trackers: [] }
            fetchRulesMock.mockImplementation(async () => {
                rulesDataRef.value = { violations: [{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned.' }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText(/for ULCX\./)).toBeTruthy())
        })

        it('shows violation message and skipped notice when tracker has an unaccepted violation', async () => {
            fetchRulesMock.mockImplementation(async () => {
                rulesDataRef.value = { violations: [{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Release group "YIFY" is banned on ULCX.')).toBeTruthy())
            expect(screen.getByText('Rule violations detected — this tracker will be skipped')).toBeTruthy()
            expect(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' })).toBeTruthy()
        })

        it('hides the skipped notice after user accepts the violation', async () => {
            const user = userEvent.setup({ delay: null })
            fetchRulesMock.mockImplementation(async () => {
                rulesDataRef.value = { violations: [{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Rule violations detected — this tracker will be skipped')).toBeTruthy())
            await user.click(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' }))
            await waitFor(() => expect(screen.queryByText('Rule violations detected — this tracker will be skipped')).toBeNull())
        })

        it('submits only trackers without unaccepted violations', async () => {
            const user = userEvent.setup({ delay: null })
            executeUploadMock.mockResolvedValue(undefined)
            fetchRulesMock.mockImplementation(async () => {
                rulesDataRef.value = {
                    violations: capturedRulesTrackerCode?.value === 'ULCX' ? [{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }] : [],
                }
            })
            fetchTitleMock.mockImplementation(async () => {
                titleDataRef.value = { title: `Title for ${capturedTrackerCode?.value}` }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX', 'ATH'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Upload' })).toBeTruthy())
            await user.click(screen.getByRole('button', { name: 'Submit Upload' }))

            await waitFor(() => expect(executeUploadMock).toHaveBeenCalled())
            expect(capturedUploadBody?.value?.trackers).toEqual([expect.objectContaining({ code: 'ATH' })])
            expect(capturedUploadBody?.value?.trackers).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ULCX' })]))
        })

        it('includes a tracker with violations once the user accepts', async () => {
            const user = userEvent.setup({ delay: null })
            executeUploadMock.mockResolvedValue(undefined)
            fetchRulesMock.mockImplementation(async () => {
                rulesDataRef.value = { violations: [{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' })).toBeTruthy())
            await user.click(screen.getByRole('checkbox', { name: 'I understand and want to upload to this tracker anyway' }))
            await user.click(screen.getByRole('button', { name: 'Submit Upload' }))

            await waitFor(() => expect(executeUploadMock).toHaveBeenCalled())
            expect(capturedUploadBody?.value?.trackers).toEqual([expect.objectContaining({ code: 'ULCX' })])
        })

        it('disables Submit Upload when all trackers have unaccepted violations', async () => {
            fetchRulesMock.mockImplementation(async () => {
                rulesDataRef.value = { violations: [{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Rule violations detected — this tracker will be skipped')).toBeTruthy())
            expect(screen.getByRole('button', { name: 'Submit Upload' })).toHaveProperty('disabled', true)
        })
    })

    describe('duplicate acceptance state', () => {
        it('shows non-trumpable duplicate name as plain text when url is absent', async () => {
            duplicatesExecuteMock.mockImplementation(async () => {
                duplicatesDataRef.value = { duplicates: [{ name: 'Movie.2024.1080p.WEB-DL.x264-GROUP', trumpable: false }] }
            })

            await renderSuspended(StepReview, {
                props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
            })

            await waitFor(() => expect(screen.getByText('Movie.2024.1080p.WEB-DL.x264-GROUP')).toBeTruthy())
            expect(screen.queryByRole('link', { name: 'Movie.2024.1080p.WEB-DL.x264-GROUP' })).toBeNull()
        })
    })

    it('shows load error and skips tracker when duplicates check fails', async () => {
        duplicatesErrorRef.value = new Error('duplicates error')

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByText('Failed to load tracker data — this tracker will be skipped')).toBeTruthy())
        expect(screen.getByText('Failed to check duplicates')).toBeTruthy()
        expect(screen.queryByText('Duplicates found on this tracker')).toBeNull()
        expect(screen.queryByText('Existing releases will be trumped')).toBeNull()
        expect(screen.getByRole('button', { name: 'Submit Upload' })).toHaveProperty('disabled', true)
    })

    it('shows load error and skips tracker when violations check fails', async () => {
        rulesErrorRef.value = new Error('rules error')

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByText('Failed to load tracker data — this tracker will be skipped')).toBeTruthy())
        expect(screen.getByText('Failed to check rule violations')).toBeTruthy()
        expect(screen.queryByText('Rule violations detected')).toBeNull()
        expect(screen.getByRole('button', { name: 'Submit Upload' })).toHaveProperty('disabled', true)
    })

    it('does not populate trackerNames when getSettings returns null', async () => {
        settingsData.value = null

        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByText('ULCX')).toBeTruthy())
    })

    it('disables Submit Upload button while upload is pending', async () => {
        await renderSuspended(StepReview, {
            props: { selectedTrackers: ['ULCX'], metadata: metadata.metadata, sourcePath: '/media/movie.mkv' },
        })

        await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Upload' })).toBeTruthy())
        uploadPending.value = true
        await nextTick()

        expect(screen.getByRole('button', { name: 'Submit Upload' })).toHaveProperty('disabled', true)
    })
})
