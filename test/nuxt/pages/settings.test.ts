import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSuspended, mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/vue'
import { ref } from 'vue'
import SettingsPage from '../../../app/pages/settings.vue'
import type { AppSettings } from '../../../app/composables/useSettings'

const loadingRef = ref(false)
const loadErrorRef = ref(false)
const saveErrorRef = ref<string | null>(null)

const { getSettingsMock, saveSettingsMock, toastAddMock } = vi.hoisted(() => ({
    getSettingsMock: vi.fn(),
    saveSettingsMock: vi.fn(),
    toastAddMock: vi.fn(),
}))

mockNuxtImport('useToast', () => {
    return () => ({ add: toastAddMock })
})

mockNuxtImport('useSettings', () => {
    return () => ({
        getSettings: getSettingsMock,
        saveSettings: saveSettingsMock,
        loading: loadingRef,
        loadError: loadErrorRef,
        saveError: saveErrorRef,
    })
})

function buildSettings(overrides: Partial<AppSettings> = {}): AppSettings {
    return {
        mediaPaths: [],
        tmdbApiKey: 'tmdb-key',
        imageHostProviders: [{ selected: false, code: 'imgbb', name: 'ImgBB' }],
        trackers: [{ selected: false, code: 'ULCX', name: 'Upload.cx' }],
        torrentClients: [{ selected: false, code: 'QUI', name: 'qui', url: '', apiKey: '' }],
        mediainfoPath: 'mediainfo',
        ffmpegPath: 'ffmpeg',
        ffprobePath: 'ffprobe',
        movieScreenshotCount: 6,
        episodePackScreenshotCount: 3,
        logLevel: 3,
        ...overrides,
    }
}

function buildSaveSettingsRequest(overrides: Partial<AppSettings> = {}): AppSettings {
    return buildSettings(overrides)
}

describe('settings page', () => {
    beforeEach(() => {
        getSettingsMock.mockReset()
        saveSettingsMock.mockReset()
        toastAddMock.mockReset()
        loadingRef.value = false
        loadErrorRef.value = false
        saveErrorRef.value = null
    })

    it('adds/removes paths and submits updated settings', async () => {
        getSettingsMock.mockResolvedValue(buildSettings())
        saveSettingsMock.mockResolvedValue(buildSettings({ mediaPaths: ['/media/a'] }))
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.type(screen.getByPlaceholderText('/path/to/media/folder'), '/media/a')
        await user.keyboard('{Enter}')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalledWith(buildSaveSettingsRequest({ mediaPaths: ['/media/a'] }))
    })

    it('shows success message after saving settings', async () => {
        getSettingsMock.mockResolvedValue(buildSettings({ mediaPaths: ['/media/a'] }))
        saveSettingsMock.mockResolvedValue(undefined)
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        await waitFor(() => {
            expect(toastAddMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Settings successfully saved.', color: 'success' }))
        })
    })

    it('loads and submits screenshot settings in nested provider payload', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: true, code: 'imgbb', name: 'ImgBB', apiKey: 'old-imgbb-key' }],
                ffmpegPath: '/usr/local/bin/ffmpeg',
                ffprobePath: '/usr/local/bin/ffprobe',
            })
        )
        saveSettingsMock.mockResolvedValue(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: true, code: 'imgbb', name: 'ImgBB', apiKey: 'new-imgbb-key' }],
                ffmpegPath: '/opt/ffmpeg',
                ffprobePath: '/opt/ffprobe',
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)

        await user.clear(screen.getByPlaceholderText('ffmpeg'))
        await user.type(screen.getByPlaceholderText('ffmpeg'), '/opt/ffmpeg')
        await user.clear(screen.getByPlaceholderText('ffprobe'))
        await user.type(screen.getByPlaceholderText('ffprobe'), '/opt/ffprobe')
        await user.clear(screen.getByPlaceholderText('Enter ImgBB API key'))
        await user.type(screen.getByPlaceholderText('Enter ImgBB API key'), 'new-imgbb-key')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalledWith(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: true, code: 'imgbb', name: 'ImgBB', apiKey: 'new-imgbb-key' }],
                ffmpegPath: '/opt/ffmpeg',
                ffprobePath: '/opt/ffprobe',
            })
        )
    })

    it('loads and submits tracker settings in nested tracker payload', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx', apiKey: 'old-api-key', passKey: 'old-pass-key' }],
            })
        )
        saveSettingsMock.mockResolvedValue(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx', apiKey: 'new-api-key', passKey: 'new-pass-key' }],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)

        await user.clear(screen.getByPlaceholderText('Enter ULCX API key'))
        await user.type(screen.getByPlaceholderText('Enter ULCX API key'), 'new-api-key')
        await user.clear(screen.getByPlaceholderText('Enter ULCX pass key'))
        await user.type(screen.getByPlaceholderText('Enter ULCX pass key'), 'new-pass-key')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalledWith(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx', apiKey: 'new-api-key', passKey: 'new-pass-key' }],
            })
        )
    })

    it('removes tracker object from payload when unticked', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx', apiKey: 'old-api-key', passKey: 'old-pass-key' }],
            })
        )
        saveSettingsMock.mockResolvedValue(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: false, code: 'ULCX', name: 'Upload.cx' }],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalledWith(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: false, code: 'ULCX', name: 'Upload.cx' }],
            })
        )
    })

    it('removes image host object from payload when unticked', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: true, code: 'imgbb', name: 'ImgBB', apiKey: 'old-imgbb-key' }],
            })
        )
        saveSettingsMock.mockResolvedValue(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: false, code: 'imgbb', name: 'ImgBB' }],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'ImgBB' }))
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalledWith(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: false, code: 'imgbb', name: 'ImgBB' }],
            })
        )
    })

    it('refreshes image host credentials from the saved response after unticking and saving', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: true, code: 'imgbb', name: 'ImgBB', apiKey: 'old-imgbb-key' }],
            })
        )
        saveSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: false, code: 'imgbb', name: 'ImgBB' }],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'ImgBB' }))
        await user.click(screen.getByRole('button', { name: /save/i }))
        await user.click(screen.getByRole('checkbox', { name: 'ImgBB' }))

        expect((screen.getByPlaceholderText('Enter ImgBB API key') as HTMLInputElement).value).toBe('')
    })

    it('shows inline tracker validation errors and blocks submit when credentials are missing', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('API Key is required for ULCX.')).toBeDefined()
        expect(screen.getByText('Pass Key is required for ULCX.')).toBeDefined()
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })

    it('shows inline image host validation errors and blocks submit when the api key is missing', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'ImgBB' }))
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('ImgBB API Key is required when ImgBB is selected.')).toBeDefined()
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })

    it('preserves tracker credentials locally when a tracker is unticked and re-ticked', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx', apiKey: 'saved-api-key', passKey: 'saved-pass-key' }],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))
        await user.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))

        expect((screen.getByPlaceholderText('Enter ULCX API key') as HTMLInputElement).value).toBe('saved-api-key')
        expect((screen.getByPlaceholderText('Enter ULCX pass key') as HTMLInputElement).value).toBe('saved-pass-key')
    })

    it('blocks submit when TMDB API key is empty', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                tmdbApiKey: '',
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter TMDB API key').getAttribute('aria-invalid')).toBe('true')
        })
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })

    it('blocks submit when FFmpeg path is empty', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                ffmpegPath: '',
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('FFmpeg Path is required.')).toBeDefined()
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })

    it('blocks submit when FFprobe path is empty', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                ffprobePath: '',
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('FFprobe Path is required.')).toBeDefined()
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })

    it('clears the media paths validation error after adding a path', async () => {
        getSettingsMock.mockResolvedValue(buildSettings())
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('At least one media path is required.')).toBeDefined()

        await user.type(screen.getByPlaceholderText('/path/to/media/folder'), '/media/a')
        await user.keyboard('{Enter}')

        await waitFor(() => {
            expect(screen.queryByText('At least one media path is required.')).toBeNull()
        })
    })

    it('marks the first invalid settings input after schema validation fails', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('API Key is required for ULCX.')).toBeDefined()
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter ULCX API key').getAttribute('aria-invalid')).toBe('true')
        })
    })

    it('submits updated screenshot counts and refreshes the saved values from the response', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                movieScreenshotCount: 6,
                episodePackScreenshotCount: 3,
            })
        )
        saveSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                movieScreenshotCount: 8,
                episodePackScreenshotCount: 4,
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)

        await user.clear(screen.getByLabelText('Movie / Single Episode Screenshot Count'))
        await user.type(screen.getByLabelText('Movie / Single Episode Screenshot Count'), '8')
        await user.clear(screen.getByLabelText('Episode Pack Screenshot Count'))
        await user.type(screen.getByLabelText('Episode Pack Screenshot Count'), '4')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalledWith(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                movieScreenshotCount: 8,
                episodePackScreenshotCount: 4,
            })
        )

        await waitFor(() => {
            expect((screen.getByLabelText('Movie / Single Episode Screenshot Count') as HTMLInputElement).value).toBe('8')
            expect((screen.getByLabelText('Episode Pack Screenshot Count') as HTMLInputElement).value).toBe('4')
        })
    })

    it('refreshes all tool path and screenshot fields from the save response', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                mediainfoPath: 'mediainfo',
                ffmpegPath: 'ffmpeg',
                ffprobePath: 'ffprobe',
                movieScreenshotCount: 6,
                episodePackScreenshotCount: 3,
            })
        )
        saveSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                mediainfoPath: '/custom/mediainfo',
                ffmpegPath: '/custom/ffmpeg',
                ffprobePath: '/custom/ffprobe',
                movieScreenshotCount: 10,
                episodePackScreenshotCount: 5,
            })
        )

        const wrapper = await mountSuspended(SettingsPage)
        const vm = wrapper.vm as unknown as {
            formState: AppSettings
            onSubmit: (event: { data: AppSettings }) => Promise<void>
        }

        await vm.onSubmit({
            data: buildSettings({
                mediaPaths: ['/media/a'],
                mediainfoPath: '/custom/mediainfo',
                ffmpegPath: '/custom/ffmpeg',
                ffprobePath: '/custom/ffprobe',
            }),
        })

        expect(vm.formState.mediainfoPath).toBe('/custom/mediainfo')
        expect(vm.formState.ffmpegPath).toBe('/custom/ffmpeg')
        expect(vm.formState.ffprobePath).toBe('/custom/ffprobe')
        expect(vm.formState.movieScreenshotCount).toBe(10)
        expect(vm.formState.episodePackScreenshotCount).toBe(5)
    })

    it('shows error toast with API message when save fails', async () => {
        getSettingsMock.mockResolvedValue(buildSettings({ mediaPaths: ['/media/a'] }))
        saveSettingsMock.mockImplementation(async () => {
            saveErrorRef.value = 'Media path does not exist: /missing'
            return null
        })
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        await waitFor(() => {
            expect(toastAddMock).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'Failed to save settings.', description: 'Media path does not exist: /missing', color: 'error' })
            )
        })
    })

    it('does not show success toast when save fails', async () => {
        getSettingsMock.mockResolvedValue(buildSettings({ mediaPaths: ['/media/a'] }))
        saveSettingsMock.mockImplementation(async () => {
            saveErrorRef.value = 'Media path does not exist: /missing'
            return null
        })
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        await waitFor(() => {
            expect(toastAddMock).not.toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }))
        })
    })

    it('does not scroll to a field when onError is called with no errors', async () => {
        getSettingsMock.mockResolvedValue(buildSettings())

        const wrapper = await mountSuspended(SettingsPage)
        const vm = wrapper.vm as unknown as {
            onError: (event: { errors: unknown[] }) => Promise<void>
        }

        await expect(vm.onError({ errors: [] })).resolves.toBeUndefined()
    })

    it('shows loading skeletons while settings are loading', async () => {
        loadingRef.value = true
        getSettingsMock.mockResolvedValue(buildSettings())

        const wrapper = await mountSuspended(SettingsPage)

        expect(wrapper.find('[data-media-paths-input]').exists()).toBe(false)
    })

    it('shows load error alert when settings fail to load', async () => {
        loadErrorRef.value = true
        getSettingsMock.mockResolvedValue(null)

        await renderSuspended(SettingsPage)

        expect(await screen.findByText('Failed to load settings. Please try again.')).toBeDefined()
        expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
    })

    it('shows separator between selected trackers when there are multiple', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                trackers: [
                    { selected: true, code: 'ULCX', name: 'Upload.cx', apiKey: 'key1', passKey: 'pass1' },
                    { selected: true, code: 'BHD', name: 'BeyondHD', apiKey: 'key2', passKey: 'pass2' },
                ],
            })
        )

        const wrapper = await mountSuspended(SettingsPage)

        expect(wrapper.findAllComponents({ name: 'USeparator' }).length).toBeGreaterThan(0)
    })

    it('does not deselect other torrent clients when a client is deselected', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                torrentClients: [
                    { selected: true, code: 'QUI', name: 'qui', url: 'http://localhost:7474', apiKey: 'key' },
                    { selected: false, code: 'OTHER', name: 'Other', url: '', apiKey: '' },
                ],
            })
        )

        const wrapper = await mountSuspended(SettingsPage)
        const vm = wrapper.vm as unknown as { formState: AppSettings }

        const checkboxes = wrapper.findAllComponents({ name: 'UCheckbox' })
        const quiCheckbox = checkboxes.find((c) => c.props('label') === 'qui')
        await quiCheckbox?.vm.$emit('update:model-value', false)

        expect(vm.formState.torrentClients[0]?.selected).toBe(false)
        expect(vm.formState.torrentClients[1]?.selected).toBe(false)
    })

    it('blocks submit when mediainfoPath is empty', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                mediainfoPath: '',
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('Mediainfo Path is required.')).toBeDefined()
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })

    it('responds to checkbox and input update events from the rendered form controls', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: false, code: 'imgbb', name: 'ImgBB' }],
                trackers: [{ selected: false, code: 'ULCX', name: 'Upload.cx' }],
                ffmpegPath: 'ffmpeg',
                ffprobePath: 'ffprobe',
            })
        )

        const wrapper = await mountSuspended(SettingsPage)
        const vm = wrapper.vm as unknown as {
            formState: AppSettings
        }

        const checkboxes = wrapper.findAllComponents({ name: 'UCheckbox' })
        const trackerCheckbox = checkboxes.find((c) => c.props('label')?.includes('ULCX'))
        const imageHostCheckbox = checkboxes.find((c) => c.props('label') === 'ImgBB')
        await trackerCheckbox?.vm.$emit('update:model-value', true)
        await imageHostCheckbox?.vm.$emit('update:model-value', true)

        const ffmpegInput = wrapper.findAllComponents({ name: 'UInput' }).find((component) => component.props('placeholder') === 'ffmpeg')
        const ffprobeInput = wrapper.findAllComponents({ name: 'UInput' }).find((component) => component.props('placeholder') === 'ffprobe')

        await ffmpegInput?.vm.$emit('update:model-value', '/evented/ffmpeg')
        await ffprobeInput?.vm.$emit('update:model-value', '/evented/ffprobe')

        expect(vm.formState.trackers[0]?.selected).toBe(true)
        expect(vm.formState.imageHostProviders[0]?.selected).toBe(true)
        expect(vm.formState.ffmpegPath).toBe('/evented/ffmpeg')
        expect(vm.formState.ffprobePath).toBe('/evented/ffprobe')
    })

    it('shows url and api key inputs when a torrent client is selected', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                torrentClients: [{ selected: false, code: 'QUI', name: 'qui', url: '', apiKey: '' }],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'qui' }))

        expect(screen.getByPlaceholderText('e.g. http://localhost:7474')).toBeTruthy()
        expect(screen.getByPlaceholderText('Enter qui API key')).toBeTruthy()
    })

    it('shows inline torrent client validation errors when url or api key is missing', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                torrentClients: [{ selected: true, code: 'QUI', name: 'qui', url: '', apiKey: '' }],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('URL is required for qui.')).toBeDefined()
        expect(screen.getByText('API Key is required for qui.')).toBeDefined()
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })

    it('deselects other torrent clients when one is selected', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                torrentClients: [
                    { selected: true, code: 'QUI', name: 'qui', url: 'http://localhost:7474', apiKey: 'key' },
                    { selected: false, code: 'OTHER', name: 'Other', url: '', apiKey: '' },
                ],
            })
        )

        const wrapper = await mountSuspended(SettingsPage)
        const vm = wrapper.vm as unknown as { formState: AppSettings }

        const checkboxes = wrapper.findAllComponents({ name: 'UCheckbox' })
        const otherCheckbox = checkboxes.find((c) => c.props('label') === 'Other')
        await otherCheckbox?.vm.$emit('update:model-value', true)

        expect(vm.formState.torrentClients[0]?.selected).toBe(false)
        expect(vm.formState.torrentClients[1]?.selected).toBe(true)
    })

    it('shows validation error and blocks submit when more than one torrent client is selected', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                torrentClients: [
                    { selected: true, code: 'QUI', name: 'qui', url: 'http://localhost:7474', apiKey: 'key' },
                    { selected: true, code: 'OTHER', name: 'Other', url: 'http://localhost:8080', apiKey: 'key2' },
                ],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('Only one torrent client can be selected at a time.')).toBeDefined()
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })
})
