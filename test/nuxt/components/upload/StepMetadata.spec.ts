import { renderSuspended } from '@nuxt/test-utils/runtime'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StepMetadata from '~/components/upload/StepMetadata.vue'
import type { Path } from '~/components/upload/upload.types'

const selectedPath: Path = {
    label: '/media/nas/movie.mkv',
    value: '/media/nas/movie.mkv',
    icon: 'i-lucide-file',
    folder: false,
}

function createMetadata(overrides: Partial<Metadata> = {}): Metadata {
    return {
        fileName: 'movie.mkv',
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
    }
}

describe('StepMetadata', () => {
    beforeEach(() => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata()))
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.doUnmock('~/composables/useMetadata')
    })

    it('asks for path when no path is provided', async () => {
        await renderSuspended(StepMetadata)

        expect(screen.getByText('Select a source path first')).toBeDefined()
        expect($fetch).not.toHaveBeenCalled()
    })

    it('loads media info and renders expected movie labels/values', async () => {
        await renderSuspended(StepMetadata, {
            props: {
                selectedPath,
            },
        })

        expect($fetch).toHaveBeenCalledWith(
            '/api/metadata',
            expect.objectContaining({
                method: 'GET',
                query: { path: '/media/nas/movie.mkv' },
            })
        )

        expect(screen.getByText('Review Metadata')).toBeDefined()
        expect(screen.getByText('Detected metadata is editable. Update anything before continuing.')).toBeDefined()
        expect(screen.getByText('Basic Details')).toBeDefined()
        expect(screen.getByText('Media Type')).toBeDefined()
        expect(screen.getByText('Title')).toBeDefined()
        expect(screen.getByText('Original Title')).toBeDefined()
        expect(screen.getByText('Year')).toBeDefined()
        expect(screen.getByText('Source And Release')).toBeDefined()
        expect(screen.getByText('Source')).toBeDefined()
        expect(screen.getByText('Type')).toBeDefined()
        expect(screen.getByText('Service')).toBeDefined()
        expect(screen.getByText('Release Group')).toBeDefined()
        expect(screen.getByText('Resolution')).toBeDefined()
        expect(screen.getByText('HDR', { selector: 'label' })).toBeDefined()
        expect(screen.getByText('Language')).toBeDefined()
        expect(screen.getByText('Original Language')).toBeDefined()
        expect(screen.getByText('Cut')).toBeDefined()
        expect(screen.getAllByText('Flags').length).toBeGreaterThanOrEqual(2)
        expect(screen.getByText('Repack')).toBeDefined()
        expect(screen.getByText('Proper')).toBeDefined()
        expect(screen.getByText('Hybrid')).toBeDefined()
        expect(screen.getByText('Technical')).toBeDefined()
        expect(screen.getByText('Video Codec')).toBeDefined()
        expect(screen.getByText('Audio Codec')).toBeDefined()
        expect(screen.getByText('Audio Channels')).toBeDefined()
        expect(screen.getByText('Audio Metadata')).toBeDefined()
        expect(screen.getByText('External IDs')).toBeDefined()
        expect(screen.getByText('TMDb ID')).toBeDefined()
        expect(screen.getByText('IMDb ID')).toBeDefined()

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
        expect(screen.getByRole('combobox', { name: 'Language' }).textContent).toBe('English')
        expect(screen.getByRole('combobox', { name: 'Original Language' }).textContent).toBe('English')
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

    it('shows error when media info request fails', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockRejectedValue({ status: 500 }))

        await renderSuspended(StepMetadata, {
            props: {
                selectedPath,
            },
        })

        expect(await screen.findByText('Failed to detect media information.')).toBeDefined()
    })

    it('allows user edits after loading detected values', async () => {
        await renderSuspended(StepMetadata, {
            props: {
                selectedPath,
            },
        })

        const titleInput = await screen.findByDisplayValue('Dune')
        await fireEvent.update(titleInput, 'Dune Part One')

        await waitFor(() => {
            expect(screen.getByDisplayValue('Dune Part One')).toBeDefined()
        })
    })

    it('shows folder label when selected path is a folder', async () => {
        await renderSuspended(StepMetadata, {
            props: {
                selectedPath: {
                    label: '/media/nas',
                    value: '/media/nas',
                    icon: 'i-lucide-folder',
                    folder: true,
                },
            },
        })

        expect(screen.getByLabelText('selected-file-or-folder').textContent).toBe('Folder: movie.mkv')
    })

    it('shows TV-only fields when media type is tv', async () => {
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue(
                createMetadata({
                    mediaType: 'tv',
                    season: 1,
                    episode: 2,
                    tvdbId: 12345,
                })
            )
        )

        await renderSuspended(StepMetadata, {
            props: {
                selectedPath,
            },
        })

        expect(await screen.findByDisplayValue('Dune')).toBeDefined()

        expect(screen.getByText('Review Metadata')).toBeDefined()
        expect(screen.getByText('Basic Details')).toBeDefined()
        expect(screen.getByText('Source And Release')).toBeDefined()
        expect(screen.getByText('Technical')).toBeDefined()
        expect(screen.getByText('External IDs')).toBeDefined()

        expect(screen.getByText('Media Type')).toBeDefined()
        expect(screen.getByText('Title')).toBeDefined()
        expect(screen.getByText('Original Title')).toBeDefined()
        expect(screen.getByText('Year')).toBeDefined()
        expect(screen.getByText('Season')).toBeDefined()
        expect(screen.getByText('Episode')).toBeDefined()
        expect(screen.getByText('Source')).toBeDefined()
        expect(screen.getByText('Type')).toBeDefined()
        expect(screen.getByText('Service')).toBeDefined()
        expect(screen.getByText('Release Group')).toBeDefined()
        expect(screen.getByText('Resolution')).toBeDefined()
        expect(screen.getByText('HDR', { selector: 'label' })).toBeDefined()
        expect(screen.getByText('Language')).toBeDefined()
        expect(screen.getByText('Original Language')).toBeDefined()
        expect(screen.getByText('Cut')).toBeDefined()
        expect(screen.getAllByText('Flags').length).toBeGreaterThanOrEqual(2)
        expect(screen.getByText('Repack')).toBeDefined()
        expect(screen.getByText('Proper')).toBeDefined()
        expect(screen.getByText('Hybrid')).toBeDefined()
        expect(screen.getByText('Video Codec')).toBeDefined()
        expect(screen.getByText('Audio Codec')).toBeDefined()
        expect(screen.getByText('Audio Channels')).toBeDefined()
        expect(screen.getByText('Audio Metadata')).toBeDefined()
        expect(screen.getByText('TMDb ID')).toBeDefined()
        expect(screen.getByText('IMDb ID')).toBeDefined()
        expect(screen.getByText('TVDB ID')).toBeDefined()

        expect(screen.getByRole('combobox', { name: 'Media Type' }).textContent).toBe('TV')
        expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBe('Dune')
        expect(screen.getByRole('textbox', { name: 'Original Title' }).getAttribute('value')).toBe('No Idea')
        expect(screen.getByRole('spinbutton', { name: 'Year' }).getAttribute('value')).toBe('2021')
        expect(screen.getByRole('spinbutton', { name: 'Season' }).getAttribute('value')).toBe('1')
        expect(screen.getByRole('spinbutton', { name: 'Episode' }).getAttribute('value')).toBe('2')
        expect(screen.getByRole('combobox', { name: 'Source' }).textContent).toBe('Web')
        expect(screen.getByRole('combobox', { name: 'Type' }).textContent).toBe('Web-DL')
        expect(screen.getByRole('combobox', { name: 'Service' }).textContent).toBe('Netflix')
        expect(screen.getByRole('textbox', { name: 'Release Group' }).getAttribute('value')).toBe('FLUX')
        expect(screen.getByRole('combobox', { name: 'Resolution' }).textContent).toBe('2160p')
        expect(screen.getByRole('combobox', { name: 'HDR' }).textContent).toBe('HDR10+')
        expect(screen.getByRole('combobox', { name: 'Language' }).textContent).toBe('English')
        expect(screen.getByRole('combobox', { name: 'Original Language' }).textContent).toBe('English')
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
        expect(screen.getByRole('spinbutton', { name: 'TVDB ID' }).getAttribute('value')).toBe('12345')
    })

    it('hides service when source is not Web', async () => {
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue(
                createMetadata({
                    source: 'BluRay',
                    service: undefined,
                })
            )
        )

        await renderSuspended(StepMetadata, {
            props: {
                selectedPath,
            },
        })

        await screen.findByDisplayValue('Dune')
        expect(screen.queryByText('Service')).toBeNull()
    })

    it('shows loading placeholders while metadata is loading', async () => {
        vi.resetModules()
        vi.doMock('~/composables/useMetadata', () => ({
            useMetadata: () => ({
                getMetadata: vi.fn(),
                loading: ref(true),
                error: ref(false),
            }),
        }))
        const { default: LoadingStepMetadata } = await import('~/components/upload/StepMetadata.vue')

        const { container } = await renderSuspended(LoadingStepMetadata, {
            props: {
                selectedPath,
            },
        })

        expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
        expect(screen.queryByText('Basic Details')).toBeNull()
        expect(screen.queryByLabelText('selected-file-or-folder')).toBeNull()
        expect(screen.queryByText('Failed to detect media information.')).toBeNull()
    })

    it('uses existing model metadata without refetching and updates model when path changes', async () => {
        const model = createMetadata({
            fileName: 'existing.mkv',
            title: 'Existing Title',
        })
        const onUpdateModelValue = vi.fn()
        const nextPath: Path = {
            label: '/media/nas/next.mkv',
            value: '/media/nas/next.mkv',
            icon: 'i-lucide-file',
            folder: false,
        }

        const { rerender } = await renderSuspended(StepMetadata, {
            props: {
                selectedPath,
                modelValue: model,
                'onUpdate:modelValue': onUpdateModelValue,
            },
        })

        expect($fetch).not.toHaveBeenCalled()
        expect(screen.getByLabelText('selected-file-or-folder').textContent).toBe('File: existing.mkv')
        expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBe('Existing Title')

        await rerender({
            selectedPath: nextPath,
            modelValue: model,
            'onUpdate:modelValue': onUpdateModelValue,
        })

        await waitFor(() => {
            expect(onUpdateModelValue).toHaveBeenCalledWith(undefined)
        })
    })

    it('shows repack and proper number inputs when repack/proper are set', async () => {
        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        expect(screen.getByRole('spinbutton', { name: 'Repack number' })).toBeDefined()
        expect(screen.getByRole('spinbutton', { name: 'Proper number' })).toBeDefined()
        expect(screen.getByRole('spinbutton', { name: 'Repack number' }).getAttribute('value')).toBe('1')
        expect(screen.getByRole('spinbutton', { name: 'Proper number' }).getAttribute('value')).toBe('1')
    })

    it('shows Hi10P checkbox when video codec is AVC, H.264, or x264', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ videoCodec: 'AVC', hi10p: true })))

        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        expect(screen.getByRole('checkbox', { name: 'Hi10P' })).toBeDefined()
        expect(screen.getByRole('checkbox', { name: 'Hi10P' }).getAttribute('data-state')).toBe('checked')
    })

    it('shows Hi10P checkbox when video codec is x264', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ videoCodec: 'x264', hi10p: false })))

        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        expect(screen.getByRole('checkbox', { name: 'Hi10P' })).toBeDefined()
    })

    it('hides Hi10P checkbox when video codec is HEVC', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ videoCodec: 'HEVC' })))

        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        expect(screen.queryByRole('checkbox', { name: 'Hi10P' })).toBeNull()
    })

    it('shows ReRip checkbox as checked', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ rerip: 1 })))

        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        expect(screen.getByRole('checkbox', { name: 'ReRip' }).getAttribute('data-state')).toBe('checked')
    })

    it('shows season and episode inputs for tv metadata', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ mediaType: 'tv', season: 2, episode: 5, tvdbId: 999 })))

        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        expect(screen.getByRole('spinbutton', { name: 'Season' }).getAttribute('value')).toBe('2')
        expect(screen.getByRole('spinbutton', { name: 'Episode' }).getAttribute('value')).toBe('5')
        expect(screen.getByRole('spinbutton', { name: 'TMDb ID' }).getAttribute('value')).toBe('438631')
        expect(screen.getByRole('spinbutton', { name: 'TVDB ID' }).getAttribute('value')).toBe('999')
    })

    it('renders unchecked flags when metadata flags are false', async () => {
        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue(
                createMetadata({
                    repack: 0,
                    proper: 0,
                    hybrid: false,
                })
            )
        )

        await renderSuspended(StepMetadata, {
            props: {
                selectedPath,
            },
        })

        await screen.findByDisplayValue('Dune')

        expect(screen.getByRole('checkbox', { name: 'Repack' }).getAttribute('data-state')).toBe('unchecked')
        expect(screen.getByRole('checkbox', { name: 'Proper' }).getAttribute('data-state')).toBe('unchecked')
        expect(screen.getByRole('checkbox', { name: 'Hybrid' }).getAttribute('data-state')).toBe('unchecked')
    })

    it('updates flag checkboxes and renders an empty TVDB field for tv metadata', async () => {
        const user = userEvent.setup()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue(
                createMetadata({
                    mediaType: 'tv',
                    season: 3,
                    tvdbId: undefined,
                    repack: 0,
                    proper: 0,
                    hybrid: false,
                })
            )
        )

        await renderSuspended(StepMetadata, {
            props: {
                selectedPath,
            },
        })

        await screen.findByDisplayValue('Dune')

        const repackCheckbox = screen.getByRole('checkbox', { name: 'Repack' })
        const properCheckbox = screen.getByRole('checkbox', { name: 'Proper' })
        const hybridCheckbox = screen.getByRole('checkbox', { name: 'Hybrid' })
        const yearInput = screen.getByRole('spinbutton', { name: 'Year' })
        const tvdbInput = screen.getByRole('spinbutton', { name: 'TVDB ID' })
        const resolutionSelect = screen.getByRole('combobox', { name: 'Resolution' })

        await user.click(repackCheckbox)
        await user.click(properCheckbox)
        await user.click(hybridCheckbox)
        await user.clear(yearInput)
        await user.type(yearInput, '2024')
        await user.click(resolutionSelect)
        await user.click(await screen.findByRole('option', { name: '1080p' }))
        await user.type(tvdbInput, '4321')

        expect(repackCheckbox.getAttribute('data-state')).toBe('checked')
        expect(properCheckbox.getAttribute('data-state')).toBe('checked')
        expect(hybridCheckbox.getAttribute('data-state')).toBe('checked')
        expect(yearInput.getAttribute('value')).toBe('2024')
        expect(screen.getByRole('combobox', { name: 'Resolution' }).textContent).toBe('1080p')
        expect(tvdbInput.getAttribute('value')).toBe('4321')
    })

    it('requires TV-only fields and original language before continuing', async () => {
        const onNext = vi.fn()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue(
                createMetadata({
                    mediaType: 'tv',
                    originalLanguage: '',
                    season: undefined,
                    tvdbId: undefined,
                })
            )
        )

        await renderSuspended(StepMetadata, {
            props: {
                selectedPath,
                onNext,
            },
        })

        await screen.findByDisplayValue('Dune')
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        expect(await screen.findByText('Original language is required')).toBeDefined()
        expect(screen.getByText('Season is required')).toBeDefined()
        expect(screen.getByText('TVDB ID is required')).toBeDefined()
        expect(onNext).not.toHaveBeenCalled()
    })

    it('emits back and next events', async () => {
        const onBack = vi.fn()
        const onNext = vi.fn()

        await renderSuspended(StepMetadata, {
            props: {
                selectedPath,
                onBack,
                onNext,
            },
        })

        await screen.findByDisplayValue('Dune')
        await fireEvent.click(screen.getByRole('button', { name: 'Back' }))
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        expect(onBack).toHaveBeenCalledTimes(1)
        await waitFor(() => {
            expect(onNext).toHaveBeenCalledTimes(1)
        })
    })

    it('shows Hi10P checkbox when video codec is H.264', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ videoCodec: 'H.264', hi10p: false })))

        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        expect(screen.getByRole('checkbox', { name: 'Hi10P' })).toBeDefined()
    })

    it('unchecking repack and proper sets them to 0 and hides number inputs', async () => {
        const user = userEvent.setup()

        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        expect(screen.getByRole('spinbutton', { name: 'Repack number' })).toBeDefined()
        expect(screen.getByRole('spinbutton', { name: 'Proper number' })).toBeDefined()

        await user.click(screen.getByRole('checkbox', { name: 'Repack' }))
        await user.click(screen.getByRole('checkbox', { name: 'Proper' }))

        await waitFor(() => {
            expect(screen.queryByRole('spinbutton', { name: 'Repack number' })).toBeNull()
            expect(screen.queryByRole('spinbutton', { name: 'Proper number' })).toBeNull()
        })
    })

    it('updates modelValue on submit', async () => {
        const onUpdateModelValue = vi.fn()

        await renderSuspended(StepMetadata, {
            props: {
                selectedPath,
                'onUpdate:modelValue': onUpdateModelValue,
            },
        })

        await screen.findByDisplayValue('Dune')
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => {
            expect(onUpdateModelValue).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dune' }))
        })
    })

    it('updates repack and proper number inputs via typing', async () => {
        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        const repackInput = screen.getByRole('spinbutton', { name: 'Repack number' })
        const properInput = screen.getByRole('spinbutton', { name: 'Proper number' })

        await fireEvent.update(repackInput, '3')
        await fireEvent.update(properInput, '2')

        await waitFor(() => {
            expect(repackInput.getAttribute('value')).toBe('3')
            expect(properInput.getAttribute('value')).toBe('2')
        })
    })

    it('toggles Hi10P checkbox on and off', async () => {
        const user = userEvent.setup()

        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ videoCodec: 'AVC', hi10p: false })))

        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        const hi10pCheckbox = screen.getByRole('checkbox', { name: 'Hi10P' })
        expect(hi10pCheckbox.getAttribute('data-state')).toBe('unchecked')

        await user.click(hi10pCheckbox)
        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'Hi10P' }).getAttribute('data-state')).toBe('checked')
        })

        await user.click(screen.getByRole('checkbox', { name: 'Hi10P' }))
        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'Hi10P' }).getAttribute('data-state')).toBe('unchecked')
        })
    })

    it('updates season, episode, tmdb and tvdb inputs for TV media type', async () => {
        const user = userEvent.setup()

        vi.stubGlobal(
            '$fetch',
            vi.fn().mockResolvedValue(
                createMetadata({
                    mediaType: 'tv',
                    season: undefined,
                    episode: undefined,
                    tvdbId: undefined,
                    tmdbId: undefined,
                })
            )
        )

        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        const seasonInput = screen.getByRole('spinbutton', { name: 'Season' })
        const episodeInput = screen.getByRole('spinbutton', { name: 'Episode' })
        const tvdbInput = screen.getByRole('spinbutton', { name: 'TVDB ID' })
        const tmdbInput = screen.getByRole('spinbutton', { name: 'TMDb ID' })

        await user.type(seasonInput, '2')
        await user.type(episodeInput, '5')
        await user.type(tvdbInput, '67890')
        await user.type(tmdbInput, '99999')

        await waitFor(() => {
            expect(seasonInput.getAttribute('value')).toBe('2')
            expect(episodeInput.getAttribute('value')).toBe('5')
            expect(tvdbInput.getAttribute('value')).toBe('67890')
            expect(tmdbInput.getAttribute('value')).toBe('99999')
        })
    })

    it('shows Last Episode input when multi-episode toggle is enabled', async () => {
        const user = userEvent.setup()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ mediaType: 'tv', season: 1, episode: 3, tvdbId: 999 })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })
        await screen.findByDisplayValue('Dune')

        expect(screen.queryByRole('spinbutton', { name: 'Last Episode' })).toBeNull()

        await user.click(screen.getByRole('switch', { name: 'Multi-episode' }))

        expect(screen.getByRole('spinbutton', { name: 'Last Episode' })).toBeDefined()
        expect(screen.getByRole('spinbutton', { name: 'First Episode' })).toBeDefined()
    })

    it('initialises multi-episode toggle from loaded metadata with episodeEnd', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ mediaType: 'tv', season: 0, episode: 3, episodeEnd: 8, tvdbId: 311711 })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })
        await screen.findByDisplayValue('Dune')

        expect(screen.getByRole('switch', { name: 'Multi-episode' }).getAttribute('aria-checked')).toBe('true')
        expect(screen.getByRole('spinbutton', { name: 'First Episode' }).getAttribute('value')).toBe('3')
        expect(screen.getByRole('spinbutton', { name: 'Last Episode' }).getAttribute('value')).toBe('8')
    })

    it('hides Last Episode input when multi-episode toggle is turned off but preserves the value', async () => {
        const user = userEvent.setup()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ mediaType: 'tv', season: 0, episode: 3, episodeEnd: 8, tvdbId: 311711 })))

        const modelRef = ref<Metadata | undefined>()
        await renderSuspended(StepMetadata, { props: { selectedPath }, attrs: { modelValue: modelRef } })
        await screen.findByDisplayValue('Dune')

        // toggle off — input should hide but state.episodeEnd not yet cleared
        await user.click(screen.getByRole('switch', { name: 'Multi-episode' }))
        expect(screen.queryByRole('spinbutton', { name: 'Last Episode' })).toBeNull()

        // toggle back on — value should still be there
        await user.click(screen.getByRole('switch', { name: 'Multi-episode' }))
        expect(screen.getByRole('spinbutton', { name: 'Last Episode' }).getAttribute('value')).toBe('8')
    })

    it('shows Special Name field when season is 0 (TVDb special S00E##)', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ mediaType: 'tv', season: 0, episode: 12, specialName: 'Polar Challenge', tvdbId: 74608 })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })

        await screen.findByDisplayValue('Dune')

        expect(screen.getByText('Special Name')).toBeDefined()
        expect(screen.getByRole('textbox', { name: 'Special Name' }).getAttribute('value')).toBe('Polar Challenge')
    })

    it('shows Special Name field when episode is 0 (non-TVDb special S##E00)', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ mediaType: 'tv', season: 27, episode: 0, specialName: 'Nepal Special', tvdbId: 74608 })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })

        await screen.findByDisplayValue('Dune')

        expect(screen.getByText('Special Name')).toBeDefined()
        expect(screen.getByRole('textbox', { name: 'Special Name' }).getAttribute('value')).toBe('Nepal Special')
    })

    it('hides Special Name field for regular TV episodes', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ mediaType: 'tv', season: 2, episode: 5, tvdbId: 999 })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })

        await screen.findByDisplayValue('Dune')

        expect(screen.queryByText('Special Name')).toBeNull()
    })

    it('allows editing the special name field', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ mediaType: 'tv', season: 0, episode: 3, specialName: 'Old Name', tvdbId: 74608 })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })

        const specialNameInput = await screen.findByRole('textbox', { name: 'Special Name' })
        await fireEvent.update(specialNameInput, 'New Name')

        await waitFor(() => {
            expect(screen.getByRole('textbox', { name: 'Special Name' }).getAttribute('value')).toBe('New Name')
        })
    })

    it('updates tmdb input for movie media type', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ tmdbId: undefined })))

        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        const tmdbInput = screen.getByRole('spinbutton', { name: 'TMDb ID' })
        await fireEvent.input(tmdbInput, { target: { value: '12345' } })
        await fireEvent.change(tmdbInput, { target: { value: '12345' } })

        await waitFor(() => {
            expect(tmdbInput.getAttribute('value')).toBe('12345')
        })
    })

    it('toggles rerip checkbox on and off', async () => {
        const user = userEvent.setup()

        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ rerip: 0 })))

        await renderSuspended(StepMetadata, {
            props: { selectedPath },
        })

        await screen.findByDisplayValue('Dune')

        const reripCheckbox = screen.getByRole('checkbox', { name: 'ReRip' })

        expect(reripCheckbox.getAttribute('data-state')).toBe('unchecked')

        await user.click(reripCheckbox)
        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'ReRip' }).getAttribute('data-state')).toBe('checked')
        })

        await user.click(reripCheckbox)
        await waitFor(() => {
            expect(screen.getByRole('checkbox', { name: 'ReRip' }).getAttribute('data-state')).toBe('unchecked')
        })
    })

    it('shows validation error when episodeEnd is set but episode is null', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ mediaType: 'tv', season: 1, episode: undefined, episodeEnd: 5, tvdbId: 999 })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })
        await screen.findByDisplayValue('Dune')

        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => {
            expect(screen.getByText('First episode is required for a range')).toBeDefined()
        })
    })

    it('shows validation error when episodeEnd is not greater than episode', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ mediaType: 'tv', season: 1, episode: 5, episodeEnd: 5, tvdbId: 999 })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })
        await screen.findByDisplayValue('Dune')

        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => {
            expect(screen.getByText('Must be greater than the first episode')).toBeDefined()
        })
    })

    it('preserves episodeEnd on submit when multi-episode toggle is on', async () => {
        const onUpdateModelValue = vi.fn()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ mediaType: 'tv', season: 1, episode: 3, episodeEnd: 8, tvdbId: 311711 })))

        await renderSuspended(StepMetadata, { props: { selectedPath, 'onUpdate:modelValue': onUpdateModelValue } })
        await screen.findByDisplayValue('Dune')

        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => {
            expect(onUpdateModelValue).toHaveBeenCalledWith(expect.objectContaining({ episodeEnd: 8 }))
        })
    })

    it('clears episodeEnd on submit when multi-episode toggle is off', async () => {
        const onUpdateModelValue = vi.fn()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ mediaType: 'tv', season: 0, episode: 3, episodeEnd: 8, tvdbId: 311711 })))

        const user = userEvent.setup()
        await renderSuspended(StepMetadata, { props: { selectedPath, 'onUpdate:modelValue': onUpdateModelValue } })
        await screen.findByDisplayValue('Dune')

        await user.click(screen.getByRole('switch', { name: 'Multi-episode' }))
        await fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => {
            expect(onUpdateModelValue).toHaveBeenCalledWith(expect.not.objectContaining({ episodeEnd: expect.anything() }))
        })
    })

    it('shows English Subs checkbox when original language is not English', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ originalLanguage: 'ko' })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })
        await screen.findByDisplayValue('Dune')

        expect(screen.getByRole('checkbox', { name: 'English Subs' })).toBeDefined()
    })

    it('hides English Subs checkbox when original language is English', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ originalLanguage: 'en' })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })
        await screen.findByDisplayValue('Dune')

        expect(screen.queryByRole('checkbox', { name: 'English Subs' })).toBeNull()
    })

    it('shows TrueHD Compatibility Track checkbox when audio codec is TrueHD and toggles it', async () => {
        const user = userEvent.setup()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ audioCodec: 'TrueHD' })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })
        await screen.findByDisplayValue('Dune')

        const checkbox = screen.getByRole('checkbox', { name: 'TrueHD Compatibility Track' })
        expect(checkbox).toBeDefined()
        expect(checkbox.getAttribute('data-state')).toBe('unchecked')

        await user.click(checkbox)
        expect(checkbox.getAttribute('data-state')).toBe('checked')
    })

    it('hides TrueHD Compatibility Track checkbox when audio codec is not TrueHD', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ audioCodec: 'DD+' })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })
        await screen.findByDisplayValue('Dune')

        expect(screen.queryByRole('checkbox', { name: 'TrueHD Compatibility Track' })).toBeNull()
    })

    it('shows Hi10P checkbox when video codec is AVC, H.264, or x264', async () => {
        for (const videoCodec of ['AVC', 'H.264', 'x264'] as const) {
            vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ videoCodec })))

            await renderSuspended(StepMetadata, { props: { selectedPath } })
            await screen.findByDisplayValue('Dune')

            expect(screen.getByRole('checkbox', { name: 'Hi10P' }), `expected Hi10P for codec ${videoCodec}`).toBeDefined()
        }
    })

    it('hides Hi10P checkbox when video codec is not AVC, H.264, or x264', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ videoCodec: 'HEVC' })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })
        await screen.findByDisplayValue('Dune')

        expect(screen.queryByRole('checkbox', { name: 'Hi10P' })).toBeNull()
    })

    it('shows rerip count input when rerip is checked', async () => {
        const user = userEvent.setup()
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(createMetadata({ rerip: 0 })))

        await renderSuspended(StepMetadata, { props: { selectedPath } })
        await screen.findByDisplayValue('Dune')

        expect(screen.queryByRole('spinbutton', { name: 'ReRip number' })).toBeNull()

        await user.click(screen.getByRole('checkbox', { name: 'ReRip' }))
        expect(screen.getByRole('spinbutton', { name: 'ReRip number' })).toBeDefined()
    })
})
