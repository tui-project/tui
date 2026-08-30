import { mockNuxtImport, mountSuspended, renderSuspended } from '@nuxt/test-utils/runtime'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StepMetadata from '~/components/upload/StepMetadata.vue'

mockNuxtImport('getLanguageOptions', () =>
    vi.fn((extraCodes: string[] = [], _searchTerm = '') => {
        const options = [
            { value: 'en', label: 'English' },
            { value: 'ko', label: 'Korean' },
            { value: 'zh', label: 'Chinese' },
        ]
        for (const value of extraCodes) {
            if (value && !options.some((option) => option.value === value)) options.push({ value, label: value })
        }
        return options
    })
)

const selectedPath: Path = {
    label: '/media/nas/movie.mkv',
    value: '/media/nas/movie.mkv',
    icon: 'i-lucide-file',
    folder: false,
}

function createMetadata(overrides: Partial<Metadata> = {}, filename = 'movie.mkv') {
    return {
        filename,
        logoUrl: undefined,
        metadata: {
            releaseGroup: 'FLUX',
            mediaType: 'movie',
            title: 'Dune',
            originalTitle: 'No Idea',
            year: 2021,
            language: ['en'],
            originalLanguage: 'en',
            sourceType: 'WEB-DL',
            source: 'Web',
            service: 'NF',
            repack: 1,
            proper: 1,
            rerip: 0,
            cut: 'Extended',
            hybrid: true,
            hi10p: false,
            hasEnglishSubs: false,
            resolution: '2160p',
            hdr: ['HDR10+'],
            videoCodec: 'HEVC',
            audioCodec: 'DD+',
            audioChannels: '5.1',
            audioMetadata: 'Atmos',
            tmdbId: 438631,
            imdbId: 'tt1160419',
            ...overrides,
        } as Metadata,
    }
}

const mockExecute = vi.fn()
const mockPending = ref(false)
const mockData = ref<ReturnType<typeof createMetadata> | null>(null)
const mockError = ref<unknown>(null)

vi.mock('~/composables/useGetMetadata', () => ({
    useGetMetadata: () => ({ execute: mockExecute, pending: mockPending, error: mockError, data: mockData }),
}))

beforeEach(() => {
    vi.clearAllMocks()
    mockPending.value = false
    mockData.value = null
    mockError.value = null
    mockExecute.mockImplementation(() => {
        mockData.value = createMetadata()
    })
})

afterEach(() => cleanup())

describe('StepMetadata', { timeout: 11000 }, () => {
    describe('no path selected', () => {
        it('shows select path alert and does not call execute', async () => {
            await renderSuspended(StepMetadata, { props: { selectedPath: { label: '', value: '', icon: '', folder: false } } })

            expect(screen.getByText('Select a source path first')).toBeDefined()
            expect(mockExecute).not.toHaveBeenCalled()
        })
    })

    describe('loading and error states', () => {
        it('shows skeletons while pending and hides form and filename header', async () => {
            mockExecute.mockImplementation(() => {
                mockPending.value = true
            })

            const { container } = await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
            expect(screen.queryByText('Basic Details')).toBeNull()
            expect(screen.queryByLabelText('selected-file-or-folder')).toBeNull()
            expect(screen.queryByText('Failed to detect media information.')).toBeNull()
        })

        it('shows error alert when fetch fails', async () => {
            mockExecute.mockImplementation(() => {
                mockError.value = new Error('network error')
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(screen.getByText('Failed to detect media information.')).toBeDefined()
        })
    })

    describe('metadata loading', () => {
        it('calls execute and renders all movie metadata fields', async () => {
            await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(mockExecute).toHaveBeenCalledTimes(1)

            expect(screen.getByText('Review Metadata')).toBeDefined()
            expect(screen.getByText('Basic Details')).toBeDefined()
            expect(screen.getByText('Source And Release')).toBeDefined()
            expect(screen.getByText('Technical')).toBeDefined()
            expect(screen.getByText('External IDs')).toBeDefined()
            expect(screen.getAllByText('Flags').length).toBeGreaterThanOrEqual(2)

            expect(screen.getByLabelText('selected-file-or-folder').textContent).toBe('File: movie.mkv')
            expect(screen.getByRole('combobox', { name: 'Media Type' }).textContent).toBe('Movie')
            expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBe('Dune')
            expect(screen.getByRole('textbox', { name: 'Original Title' }).getAttribute('value')).toBe('No Idea')
            expect(screen.getByRole('spinbutton', { name: 'Year' }).getAttribute('value')).toBe('2021')
            expect(screen.queryByRole('spinbutton', { name: 'Season' })).toBeNull()
            expect(screen.queryByRole('spinbutton', { name: 'Episode' })).toBeNull()
            expect(screen.getByRole('combobox', { name: 'Source' }).textContent).toBe('Web')
            expect(screen.getByRole('combobox', { name: 'Type' }).textContent).toBe('Web-DL')
            expect(screen.getByRole('combobox', { name: 'Service' }).textContent).toBe('Netflix')
            expect(screen.getByRole('textbox', { name: 'Release Group' }).getAttribute('value')).toBe('FLUX')
            expect(screen.getByRole('combobox', { name: 'Resolution' }).textContent).toBe('2160p')
            expect(screen.getByRole('combobox', { name: 'HDR' }).textContent).toBe('HDR10+')
            expect(screen.getByLabelText('Language').textContent).toBe('English')
            expect(screen.getByLabelText('Original Language').textContent).toBe('English')
            expect(screen.getByRole('combobox', { name: 'Cut' }).textContent).toBe('Extended')
            expect(screen.getByRole('checkbox', { name: 'Repack' }).getAttribute('data-state')).toBe('checked')
            expect(screen.getByRole('checkbox', { name: 'Proper' }).getAttribute('data-state')).toBe('checked')
            expect(screen.getByRole('checkbox', { name: 'Hybrid' }).getAttribute('data-state')).toBe('checked')
            expect(screen.getByRole('combobox', { name: 'Video Codec' }).textContent).toBe('HEVC')
            expect(screen.getByRole('combobox', { name: 'Audio Codec' }).textContent).toBe('DD+')
            expect(screen.getByRole('combobox', { name: 'Audio Channels' }).textContent).toBe('5.1')
            expect(screen.getByRole('combobox', { name: 'Audio Metadata' }).textContent).toBe('Atmos')
            expect(screen.getByRole('spinbutton', { name: 'TMDb ID' }).getAttribute('value')).toBe('438631')
            expect(screen.getByRole('textbox', { name: 'IMDb ID' }).getAttribute('value')).toBe('tt1160419')
            expect(screen.queryByRole('spinbutton', { name: 'TVDB ID' })).toBeNull()
        })

        it('renders folder label when selected path is a folder', async () => {
            await renderSuspended(StepMetadata, {
                props: {
                    selectedPath: { label: '/media/nas', value: '/media/nas', icon: 'i-lucide-folder', folder: true },
                },
            })

            expect(screen.getByLabelText('selected-file-or-folder').textContent).toBe('Folder: movie.mkv')
        })

        it.each(['Language', 'Original Language'])('indicates that the complete %s list is searchable', async (label) => {
            const user = userEvent.setup({ delay: null })
            await renderSuspended(StepMetadata, { props: { selectedPath } })

            await user.click(screen.getByLabelText(label))

            const searchInput = screen.getByPlaceholderText('Search all languages…')
            await user.type(searchInput, 'man')

            expect((searchInput as HTMLInputElement).value).toBe('man')
            await user.keyboard('{Escape}')
        })

        it('shows TV-only fields and hides movie-only fields for tv media type', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ mediaType: 'tv', season: 1, episode: 2, tvdbId: 12345 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(screen.getByText('Season')).toBeDefined()
            expect(screen.getByText('Episode')).toBeDefined()
            expect(screen.getByText('TVDB ID')).toBeDefined()
            expect(screen.getByRole('combobox', { name: 'Media Type' }).textContent).toBe('TV')
            expect(screen.getByRole('spinbutton', { name: 'Season' }).getAttribute('value')).toBe('1')
            expect(screen.getByRole('spinbutton', { name: 'Episode' }).getAttribute('value')).toBe('2')
            expect(screen.getByRole('spinbutton', { name: 'TVDB ID' }).getAttribute('value')).toBe('12345')
        })

        it('hides service field when source is not Web', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ source: 'BluRay', service: undefined })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(screen.queryByText('Service')).toBeNull()
        })

        it('uses existing modelValue without calling execute', async () => {
            const model = createMetadata({ title: 'Existing Title' })

            await renderSuspended(StepMetadata, {
                props: { selectedPath, modelValue: model },
            })

            expect(mockExecute).not.toHaveBeenCalled()
            expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBe('Existing Title')
        })

        it('normalizes legacy language aliases before displaying them', async () => {
            const model = createMetadata({ language: ['eng'], originalLanguage: 'cn' })

            await renderSuspended(StepMetadata, {
                props: { selectedPath, modelValue: model },
            })

            expect(screen.getByLabelText('Language').textContent).toBe('English')
            expect(screen.getByLabelText('Original Language').textContent).toBe('Chinese')
        })

        it('uses prefetched data without calling execute', async () => {
            const prefetched = createMetadata({ title: 'Prefetched Title' })

            await renderSuspended(StepMetadata, {
                props: { selectedPath, prefetched },
            })

            expect(mockExecute).not.toHaveBeenCalled()
            expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBe('Prefetched Title')
        })

        it('renders empty form when execute completes but returns no data', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = null
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(mockExecute).toHaveBeenCalledTimes(1)
            expect(screen.getByText('Basic Details')).toBeDefined()
            expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBeNull()
        })

        it('clears modelValue when selected path changes', async () => {
            const model = createMetadata({ title: 'Existing Title' })
            const onUpdateModelValue = vi.fn()

            const { rerender } = await renderSuspended(StepMetadata, {
                props: { selectedPath, modelValue: model, 'onUpdate:modelValue': onUpdateModelValue },
            })

            await rerender({
                selectedPath: { label: '/media/other.mkv', value: '/media/other.mkv', icon: 'i-lucide-file', folder: false },
                modelValue: model,
                'onUpdate:modelValue': onUpdateModelValue,
            })

            await waitFor(() => {
                expect(onUpdateModelValue).toHaveBeenCalledWith(undefined)
            })
        })

        it('clears prefetched when selected path changes', async () => {
            const prefetched = createMetadata({ title: 'Prefetched Title' })
            const onUpdatePrefetched = vi.fn()

            const { rerender } = await renderSuspended(StepMetadata, {
                props: { selectedPath, prefetched, 'onUpdate:prefetched': onUpdatePrefetched },
            })

            await rerender({
                selectedPath: { label: '/media/other.mkv', value: '/media/other.mkv', icon: 'i-lucide-file', folder: false },
                prefetched,
                'onUpdate:prefetched': onUpdatePrefetched,
            })

            await waitFor(() => {
                expect(onUpdatePrefetched).toHaveBeenCalledWith(undefined)
            })
        })
    })

    describe('flags', () => {
        it.each([
            ['repack', 'Repack'],
            ['proper', 'Proper'],
            ['rerip', 'ReRip'],
        ] as const)('toggles %s: hides number input on uncheck, shows on re-check', async (field, label) => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ [field]: 1 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            const numberInputName = `${label} number`
            const checkbox = screen.getByRole('checkbox', { name: label })
            expect(screen.getByRole('spinbutton', { name: numberInputName })).toBeDefined()

            await fireEvent.click(checkbox)
            await waitFor(() => expect(screen.queryByRole('spinbutton', { name: numberInputName })).toBeNull())

            await fireEvent.click(screen.getByRole('checkbox', { name: label }))
            await waitFor(() => expect(screen.getByRole('spinbutton', { name: numberInputName })).toBeDefined())
        })

        it('renders unchecked flags when metadata flags are all zero', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ repack: 0, proper: 0, rerip: 0, hybrid: false })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(screen.getByRole('checkbox', { name: 'Repack' }).getAttribute('data-state')).toBe('unchecked')
            expect(screen.getByRole('checkbox', { name: 'Proper' }).getAttribute('data-state')).toBe('unchecked')
            expect(screen.getByRole('checkbox', { name: 'Hybrid' }).getAttribute('data-state')).toBe('unchecked')
        })

        it('allows typing in repack, proper and rerip number inputs', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ repack: 1, proper: 1, rerip: 1 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            const repackInput = screen.getByRole('spinbutton', { name: 'Repack number' })
            const properInput = screen.getByRole('spinbutton', { name: 'Proper number' })
            const reripInput = screen.getByRole('spinbutton', { name: 'ReRip number' })

            await fireEvent.update(repackInput, '3')
            await fireEvent.update(properInput, '2')
            await fireEvent.update(reripInput, '4')

            await waitFor(() => {
                expect(repackInput.getAttribute('value')).toBe('3')
                expect(properInput.getAttribute('value')).toBe('2')
                expect(reripInput.getAttribute('value')).toBe('4')
            })
        })

        it.each([['AVC'], ['H.264'], ['x264']] as const)('shows Hi10P checkbox when videoCodec is %s', async (videoCodec) => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ videoCodec })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(screen.getByRole('checkbox', { name: 'Hi10P' })).toBeDefined()
        })

        it('hides Hi10P checkbox when videoCodec is not AVC, H.264, or x264', async () => {
            await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(screen.queryByRole('checkbox', { name: 'Hi10P' })).toBeNull()
        })

        it('toggles Hi10P checkbox on and off', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ videoCodec: 'AVC', hi10p: false })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            const hi10pCheckbox = screen.getByRole('checkbox', { name: 'Hi10P' })
            expect(hi10pCheckbox.getAttribute('data-state')).toBe('unchecked')

            await fireEvent.click(hi10pCheckbox)
            await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Hi10P' }).getAttribute('data-state')).toBe('checked'))

            await fireEvent.click(screen.getByRole('checkbox', { name: 'Hi10P' }))
            await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Hi10P' }).getAttribute('data-state')).toBe('unchecked'))
        })

        it.each([
            ['ko', true],
            ['en', false],
        ] as const)('shows English Subs checkbox=%s when originalLanguage is %s', async (originalLanguage, visible) => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ originalLanguage })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            if (visible) {
                expect(screen.getByRole('checkbox', { name: 'English Subs' })).toBeDefined()
            } else {
                expect(screen.queryByRole('checkbox', { name: 'English Subs' })).toBeNull()
            }
        })

        it('toggles English Subs checkbox off', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ originalLanguage: 'ko', hasEnglishSubs: true })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            const checkbox = screen.getByRole('checkbox', { name: 'English Subs' })
            expect(checkbox.getAttribute('data-state')).toBe('checked')

            await fireEvent.click(checkbox)
            await waitFor(() => expect(screen.getByRole('checkbox', { name: 'English Subs' }).getAttribute('data-state')).toBe('unchecked'))
        })

        it.each([
            ['TrueHD', true],
            ['DD+', false],
        ] as const)('shows TrueHD Compatibility Track checkbox=%s when audioCodec is %s', async (audioCodec, visible) => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ audioCodec })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            if (visible) {
                expect(screen.getByRole('checkbox', { name: 'TrueHD Compatibility Track' })).toBeDefined()
            } else {
                expect(screen.queryByRole('checkbox', { name: 'TrueHD Compatibility Track' })).toBeNull()
            }
        })

        it('toggles TrueHD Compatibility Track checkbox on and off', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ audioCodec: 'TrueHD', hasTrueHDCompatibilityTrack: true })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            const checkbox = screen.getByRole('checkbox', { name: 'TrueHD Compatibility Track' })
            expect(checkbox.getAttribute('data-state')).toBe('checked')

            await fireEvent.click(checkbox)
            await waitFor(() => expect(screen.getByRole('checkbox', { name: 'TrueHD Compatibility Track' }).getAttribute('data-state')).toBe('unchecked'))

            await fireEvent.click(screen.getByRole('checkbox', { name: 'TrueHD Compatibility Track' }))
            await waitFor(() => expect(screen.getByRole('checkbox', { name: 'TrueHD Compatibility Track' }).getAttribute('data-state')).toBe('checked'))
        })
    })

    describe('TV features', () => {
        it('shows Last Episode input when multi-episode toggle is enabled', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ mediaType: 'tv', season: 1, episode: 3, tvdbId: 999 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(screen.queryByRole('spinbutton', { name: 'Last Episode' })).toBeNull()

            await fireEvent.click(screen.getByRole('switch', { name: 'Multi-episode' }))

            expect(screen.getByRole('spinbutton', { name: 'Last Episode' })).toBeDefined()
            expect(screen.getByRole('spinbutton', { name: 'First Episode' })).toBeDefined()
        })

        it('initialises multi-episode toggle from metadata with episodeEnd', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ mediaType: 'tv', season: 0, episode: 3, episodeEnd: 8, tvdbId: 311711 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(screen.getByRole('switch', { name: 'Multi-episode' }).getAttribute('aria-checked')).toBe('true')
            expect(screen.getByRole('spinbutton', { name: 'First Episode' }).getAttribute('value')).toBe('3')
            expect(screen.getByRole('spinbutton', { name: 'Last Episode' }).getAttribute('value')).toBe('8')
        })

        it('hides Last Episode input when toggle is turned off but preserves the value', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ mediaType: 'tv', season: 0, episode: 3, episodeEnd: 8, tvdbId: 311711 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            await fireEvent.click(screen.getByRole('switch', { name: 'Multi-episode' }))
            expect(screen.queryByRole('spinbutton', { name: 'Last Episode' })).toBeNull()

            await fireEvent.click(screen.getByRole('switch', { name: 'Multi-episode' }))
            expect(screen.getByRole('spinbutton', { name: 'Last Episode' }).getAttribute('value')).toBe('8')
        })

        it.each([
            [0, 12, 'Polar Challenge'],
            [27, 0, 'Nepal Special'],
        ] as const)('shows Special Name field when season=%s, episode=%s', async (season, episode, specialName) => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ mediaType: 'tv', season, episode, specialName, tvdbId: 74608 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(screen.getByText('Special Name')).toBeDefined()
            expect(screen.getByRole('textbox', { name: 'Special Name' }).getAttribute('value')).toBe(specialName)
        })

        it('hides Special Name field for regular TV episodes', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ mediaType: 'tv', season: 2, episode: 5, tvdbId: 999 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            expect(screen.queryByText('Special Name')).toBeNull()
        })

        it('allows typing into the Last Episode input', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ mediaType: 'tv', season: 1, episode: 1, tvdbId: 999 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            await fireEvent.click(screen.getByRole('switch', { name: 'Multi-episode' }))
            const lastEpisodeInput = await screen.findByRole('spinbutton', { name: 'Last Episode' })
            await fireEvent.update(lastEpisodeInput, '6')
            await fireEvent.blur(lastEpisodeInput)

            await waitFor(() => expect(lastEpisodeInput.getAttribute('value')).toBe('6'))
        })

        it('allows editing the special name field', async () => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ mediaType: 'tv', season: 0, episode: 3, specialName: 'Old Name', tvdbId: 74608 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            const input = screen.getByRole('textbox', { name: 'Special Name' })
            await fireEvent.update(input, 'New Name')

            await waitFor(() => expect(screen.getByRole('textbox', { name: 'Special Name' }).getAttribute('value')).toBe('New Name'))
        })
    })

    describe('form interaction', () => {
        it('allows user edits after loading', async () => {
            await renderSuspended(StepMetadata, { props: { selectedPath } })

            const titleInput = screen.getByRole('textbox', { name: 'Title' })
            await fireEvent.update(titleInput, 'Dune Part One')

            await waitFor(() => expect(screen.getByDisplayValue('Dune Part One')).toBeDefined())
        })

        it('handles number input component model updates for TV metadata', async () => {
            const wrapper = await mountSuspended(StepMetadata, {
                props: {
                    selectedPath,
                    modelValue: createMetadata({ mediaType: 'tv', season: 1, episode: 2, tvdbId: 12345 }),
                },
            })
            const getNumberInput = (placeholder: string) => {
                const input = wrapper.findAllComponents({ name: 'UInputNumber' }).find((component) => component.props('placeholder') === placeholder)
                expect(input).toBeDefined()
                return input!
            }

            getNumberInput('Enter year').vm.$emit('update:modelValue', 2024)
            getNumberInput('Enter season').vm.$emit('update:modelValue', 3)
            getNumberInput('Enter episode').vm.$emit('update:modelValue', 7)
            getNumberInput('Enter TMDb ID').vm.$emit('update:modelValue', 99999)
            getNumberInput('Enter TVDb ID').vm.$emit('update:modelValue', 67890)
            await wrapper.vm.$nextTick()

            expect(getNumberInput('Enter year').props('modelValue')).toBe(2024)
            expect(getNumberInput('Enter season').props('modelValue')).toBe(3)
            expect(getNumberInput('Enter episode').props('modelValue')).toBe(7)
            expect(getNumberInput('Enter TMDb ID').props('modelValue')).toBe(99999)
            expect(getNumberInput('Enter TVDb ID').props('modelValue')).toBe(67890)
        })

        it('updates the Hybrid flag and Resolution', async () => {
            const user = userEvent.setup({ delay: null })
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ hybrid: false })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            const hybridCheckbox = screen.getByRole('checkbox', { name: 'Hybrid' })
            const resolutionSelect = screen.getByRole('combobox', { name: 'Resolution' })

            await fireEvent.click(hybridCheckbox)
            await user.click(resolutionSelect)
            await user.click(await screen.findByRole('option', { name: '1080p' }))

            expect(hybridCheckbox.getAttribute('data-state')).toBe('checked')
            expect(screen.getByRole('combobox', { name: 'Resolution' }).textContent).toBe('1080p')
        })

        it.each([
            ['Video Codec', 'AVC'],
            ['Audio Codec', 'DTS-HD MA'],
            ['Audio Channels', '7.1'],
            ['Audio Metadata', 'Auro3D'],
        ] as const)(
            'allows changing %s dropdown',
            async (comboboxName, optionName) => {
                const user = userEvent.setup({ delay: null })
                await renderSuspended(StepMetadata, { props: { selectedPath } })

                await user.click(screen.getByRole('combobox', { name: comboboxName }))
                await user.click(await screen.findByRole('option', { name: optionName }))
                await waitFor(() => expect(screen.getByRole('combobox', { name: comboboxName }).textContent).toBe(optionName))
            },
            10000
        )

        it('covers single-select dropdown v-model handlers in basic and source-release sections', async () => {
            // All interactions in one test: one renderSuspended, one cleanup — avoids multi-test
            // pointer-event accumulation that degrades the happy-dom environment over time.
            const user = userEvent.setup({ delay: null })
            await renderSuspended(StepMetadata, { props: { selectedPath } })

            // Service must be clicked before Source changes away from Web
            await user.click(screen.getByRole('combobox', { name: 'Service' }))
            await user.click(await screen.findByRole('option', { name: 'Apple TV+' }))

            await user.click(screen.getByLabelText('Original Language'))
            await user.click(await screen.findByRole('option', { name: 'Korean' }))

            await user.click(screen.getByRole('combobox', { name: 'Cut' }))
            await user.click(await screen.findByRole('option', { name: "Director's Cut" }))

            await user.click(screen.getByRole('combobox', { name: 'Ratio' }))
            await user.click(await screen.findByRole('option', { name: 'IMAX' }))

            await user.click(screen.getByRole('combobox', { name: 'Source' }))
            await user.click(await screen.findByRole('option', { name: 'BluRay' }))

            await user.click(screen.getByRole('combobox', { name: 'Type' }))
            await user.click(await screen.findByRole('option', { name: 'Remux' }))

            await user.click(screen.getByRole('combobox', { name: 'Media Type' }))
            await user.click(await screen.findByRole('option', { name: 'TV' }))

            await waitFor(() => {
                expect(screen.getByRole('combobox', { name: 'Source' }).textContent).toBe('BluRay')
                expect(screen.getByRole('combobox', { name: 'Type' }).textContent).toBe('Remux')
                expect(screen.getByRole('combobox', { name: 'Media Type' }).textContent).toBe('TV')
            })
        }, 20000)

        it('covers HDR and Language multi-select v-model handlers', async () => {
            const user = userEvent.setup({ delay: null })
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ hdr: [], language: [] })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })

            // Multi-select dropdowns stay open after selecting — close with Escape before
            // opening the next one to prevent aria-modal from hiding siblings.
            await user.click(screen.getByRole('combobox', { name: 'HDR' }))
            await user.click(await screen.findByRole('option', { name: 'DV' }))
            await user.keyboard('{Escape}')

            await user.click(screen.getByLabelText('Language'))
            await user.click(await screen.findByRole('option', { name: 'Korean' }))
            await user.keyboard('{Escape}')

            await waitFor(() => {
                expect(screen.getByRole('combobox', { name: 'HDR' }).textContent).toContain('DV')
                expect(screen.getByLabelText('Language').textContent).toContain('Korean')
            })
        }, 20000)

        it('covers UInput v-model handlers for Original Title, IMDb ID, Release Group and Locale', async () => {
            await renderSuspended(StepMetadata, { props: { selectedPath } })

            await fireEvent.update(screen.getByRole('textbox', { name: 'Original Title' }), 'New Original Title')
            await fireEvent.update(screen.getByRole('textbox', { name: 'IMDb ID' }), 'tt9999999')
            await fireEvent.update(screen.getByRole('textbox', { name: 'Release Group' }), 'NEWGROUP')
            await fireEvent.update(screen.getByRole('textbox', { name: 'Locale' }), 'AU')

            await waitFor(() => {
                expect(screen.getByRole('textbox', { name: 'Original Title' }).getAttribute('value')).toBe('New Original Title')
                expect(screen.getByRole('textbox', { name: 'IMDb ID' }).getAttribute('value')).toBe('tt9999999')
                expect(screen.getByRole('textbox', { name: 'Release Group' }).getAttribute('value')).toBe('NEWGROUP')
                expect(screen.getByRole('textbox', { name: 'Locale' }).getAttribute('value')).toBe('AU')
            })
        })
    })

    describe('validation', () => {
        it('rejects a whitespace-only release group', async () => {
            const onNext = vi.fn()
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ releaseGroup: ' ' })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath, onNext } })

            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(onNext).not.toHaveBeenCalled())
        })

        it('requires TV-only fields and original language before continuing', async () => {
            const onNext = vi.fn()
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ mediaType: 'tv', originalLanguage: '', season: undefined, tvdbId: undefined })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath, onNext } })

            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            expect(await screen.findByText('Original language is required')).toBeDefined()
            expect(screen.getByText('Season is required')).toBeDefined()
            expect(screen.getByText('TVDB ID is required')).toBeDefined()
            expect(onNext).not.toHaveBeenCalled()
        })

        it.each([
            [undefined as number | undefined, 5, 'First episode is required for a range'],
            [5, 5, 'Must be greater than the first episode'],
        ] as const)('shows episodeEnd validation error when episode=%s, episodeEnd=%s', async (episode, episodeEnd, errorMessage) => {
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ mediaType: 'tv', season: 1, episode, episodeEnd, tvdbId: 999 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath } })
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(screen.getByText(errorMessage)).toBeDefined())
        })
    })

    describe('navigation and submission', () => {
        it('continues when the locale is removed', async () => {
            const onNext = vi.fn()
            const onUpdateModelValue = vi.fn()
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ locale: 'US' })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath, onNext, 'onUpdate:modelValue': onUpdateModelValue } })

            await fireEvent.update(screen.getByRole('textbox', { name: 'Locale' }), '')
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => {
                expect(onNext).toHaveBeenCalledTimes(1)
                expect(onUpdateModelValue).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ locale: undefined }) }))
            })
        })

        it('continues when the original title is removed', async () => {
            const onNext = vi.fn()

            await renderSuspended(StepMetadata, { props: { selectedPath, onNext } })

            await fireEvent.update(screen.getByRole('textbox', { name: 'Original Title' }), '')
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
        })

        it('continues when the release group is empty', async () => {
            const onNext = vi.fn()
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ releaseGroup: undefined })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath, onNext } })

            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
        })

        it('emits back and next events', async () => {
            const onBack = vi.fn()
            const onNext = vi.fn()

            await renderSuspended(StepMetadata, { props: { selectedPath, onBack, onNext } })

            await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            expect(onBack).toHaveBeenCalledTimes(1)
            await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
        })

        it('updates modelValue on submit', async () => {
            const onUpdateModelValue = vi.fn()

            await renderSuspended(StepMetadata, { props: { selectedPath, 'onUpdate:modelValue': onUpdateModelValue } })

            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => {
                expect(onUpdateModelValue).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ title: 'Dune' }) }))
            })
        })

        it('preserves identified mixed-track languages on submit', async () => {
            const onUpdateModelValue = vi.fn()
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ language: ['mul'], mixedAudioLanguages: ['en', 'es'], originalLanguage: 'es' })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath, 'onUpdate:modelValue': onUpdateModelValue } })

            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => {
                expect(onUpdateModelValue).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ mixedAudioLanguages: ['en', 'es'] }) }))
            })
        })

        it('preserves episodeEnd on submit when multi-episode toggle is on', async () => {
            const onUpdateModelValue = vi.fn()
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ mediaType: 'tv', season: 1, episode: 3, episodeEnd: 8, tvdbId: 311711 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath, 'onUpdate:modelValue': onUpdateModelValue } })

            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => {
                expect(onUpdateModelValue).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ episodeEnd: 8 }) }))
            })
        })

        it('clears episodeEnd on submit when multi-episode toggle is off', async () => {
            const user = userEvent.setup({ delay: null })
            const onUpdateModelValue = vi.fn()
            mockExecute.mockImplementation(() => {
                mockData.value = createMetadata({ mediaType: 'tv', season: 0, episode: 3, episodeEnd: 8, tvdbId: 311711 })
            })

            await renderSuspended(StepMetadata, { props: { selectedPath, 'onUpdate:modelValue': onUpdateModelValue } })

            await user.click(screen.getByRole('switch', { name: 'Multi-episode' }))
            await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

            await waitFor(() => {
                expect(onUpdateModelValue).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.not.objectContaining({ episodeEnd: expect.anything() }) }))
            })
        })
    })
})
