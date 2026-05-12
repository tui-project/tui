import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSuspended, mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/vue'
import { ref } from 'vue'
import SettingsPage from '../../../app/pages/settings.vue'
import type { AppSettings } from '../../../app/composables/useSettings'

const loadingRef = ref(false)
const errorRef = ref(false)

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
        error: errorRef,
    })
})

function buildSettings(overrides: Partial<AppSettings> = {}) {
    return {
        mediaPaths: [],
        tmdbApiKey: 'tmdb-key',
        imageHostProviders: [{ selected: false, code: 'imgbb', name: 'ImgBB' }],
        trackers: [{ selected: false, code: 'ULCX', name: 'Upload.cx' }],
        mediainfoPath: 'mediainfo',
        ffmpegPath: 'ffmpeg',
        ffprobePath: 'ffprobe',
        movieScreenshotCount: 6,
        tvEpisodeScreenshotCount: 3,
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
        errorRef.value = false
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
                tvEpisodeScreenshotCount: 3,
            })
        )
        saveSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                movieScreenshotCount: 8,
                tvEpisodeScreenshotCount: 4,
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)

        await user.clear(screen.getByLabelText('Movie Screenshot Count'))
        await user.type(screen.getByLabelText('Movie Screenshot Count'), '8')
        await user.clear(screen.getByLabelText('Tv Episode Screenshot Count'))
        await user.type(screen.getByLabelText('Tv Episode Screenshot Count'), '4')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalledWith(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                movieScreenshotCount: 8,
                tvEpisodeScreenshotCount: 4,
            })
        )

        await waitFor(() => {
            expect((screen.getByLabelText('Movie Screenshot Count') as HTMLInputElement).value).toBe('8')
            expect((screen.getByLabelText('Tv Episode Screenshot Count') as HTMLInputElement).value).toBe('4')
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
                tvEpisodeScreenshotCount: 3,
            })
        )
        saveSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                mediainfoPath: '/custom/mediainfo',
                ffmpegPath: '/custom/ffmpeg',
                ffprobePath: '/custom/ffprobe',
                movieScreenshotCount: 10,
                tvEpisodeScreenshotCount: 5,
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
        expect(vm.formState.tvEpisodeScreenshotCount).toBe(5)
    })

    it('shows loading skeletons while settings are loading', async () => {
        loadingRef.value = true
        getSettingsMock.mockResolvedValue(buildSettings())

        const wrapper = await mountSuspended(SettingsPage)

        expect(wrapper.find('[data-media-paths-input]').exists()).toBe(false)
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
        await checkboxes[0]?.vm.$emit('update:model-value', true)
        await checkboxes[1]?.vm.$emit('update:model-value', true)

        const ffmpegInput = wrapper.findAllComponents({ name: 'UInput' }).find((component) => component.props('placeholder') === 'ffmpeg')
        const ffprobeInput = wrapper.findAllComponents({ name: 'UInput' }).find((component) => component.props('placeholder') === 'ffprobe')

        await ffmpegInput?.vm.$emit('update:model-value', '/evented/ffmpeg')
        await ffprobeInput?.vm.$emit('update:model-value', '/evented/ffprobe')

        expect(vm.formState.trackers[0]?.selected).toBe(true)
        expect(vm.formState.imageHostProviders[0]?.selected).toBe(true)
        expect(vm.formState.ffmpegPath).toBe('/evented/ffmpeg')
        expect(vm.formState.ffprobePath).toBe('/evented/ffprobe')
    })
})
