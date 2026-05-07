import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSuspended, mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/vue'
import { ref } from 'vue'
import SettingsPage from '../../../app/pages/settings.vue'
import type { AppSettings } from '../../../app/composables/useSettings'

const loadingRef = ref(false)
const errorRef = ref(false)

const { getSettingsMock, saveSettingsMock } = vi.hoisted(() => ({
    getSettingsMock: vi.fn(),
    saveSettingsMock: vi.fn(),
}))

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
        trackers: [{ selected: false, code: 'FNP', name: 'FearNoPeer' }],
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

        expect(await screen.findByText('Settings successfully saved.')).toBeDefined()
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
                trackers: [{ selected: true, code: 'FNP', name: 'FearNoPeer', apiKey: 'old-api-key', passKey: 'old-pass-key' }],
            })
        )
        saveSettingsMock.mockResolvedValue(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: true, code: 'FNP', name: 'FearNoPeer', apiKey: 'new-api-key', passKey: 'new-pass-key' }],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)

        await user.clear(screen.getByPlaceholderText('Enter FNP API key'))
        await user.type(screen.getByPlaceholderText('Enter FNP API key'), 'new-api-key')
        await user.clear(screen.getByPlaceholderText('Enter FNP pass key'))
        await user.type(screen.getByPlaceholderText('Enter FNP pass key'), 'new-pass-key')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalledWith(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: true, code: 'FNP', name: 'FearNoPeer', apiKey: 'new-api-key', passKey: 'new-pass-key' }],
            })
        )
    })

    it('removes tracker object from payload when unticked', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: true, code: 'FNP', name: 'FearNoPeer', apiKey: 'old-api-key', passKey: 'old-pass-key' }],
            })
        )
        saveSettingsMock.mockResolvedValue(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: false, code: 'FNP', name: 'FearNoPeer' }],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'FearNoPeer (FNP)' }))
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalledWith(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: false, code: 'FNP', name: 'FearNoPeer' }],
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
        await user.click(screen.getByRole('checkbox', { name: 'FearNoPeer (FNP)' }))
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('API Key is required for FNP.')).toBeDefined()
        expect(screen.getByText('Pass Key is required for FNP.')).toBeDefined()
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
                trackers: [{ selected: true, code: 'FNP', name: 'FearNoPeer', apiKey: 'saved-api-key', passKey: 'saved-pass-key' }],
            })
        )
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'FearNoPeer (FNP)' }))
        await user.click(screen.getByRole('checkbox', { name: 'FearNoPeer (FNP)' }))

        expect((screen.getByPlaceholderText('Enter FNP API key') as HTMLInputElement).value).toBe('saved-api-key')
        expect((screen.getByPlaceholderText('Enter FNP pass key') as HTMLInputElement).value).toBe('saved-pass-key')
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
        await user.click(screen.getByRole('checkbox', { name: 'FearNoPeer (FNP)' }))
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('API Key is required for FNP.')).toBeDefined()
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter FNP API key').getAttribute('aria-invalid')).toBe('true')
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

        await user.clear(screen.getByPlaceholderText('6'))
        await user.type(screen.getByPlaceholderText('6'), '8')
        await user.clear(screen.getByPlaceholderText('3'))
        await user.type(screen.getByPlaceholderText('3'), '4')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalledWith(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                movieScreenshotCount: 8,
                tvEpisodeScreenshotCount: 4,
            })
        )

        await waitFor(() => {
            expect((screen.getByPlaceholderText('6') as HTMLInputElement).value).toBe('8')
            expect((screen.getByPlaceholderText('3') as HTMLInputElement).value).toBe('4')
        })
    })

    it('handles the tracker and image host toggle helpers directly', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: false, code: 'imgbb', name: 'ImgBB' }],
                trackers: [{ selected: false, code: 'FNP', name: 'FearNoPeer' }],
            })
        )

        const wrapper = await mountSuspended(SettingsPage)
        const vm = wrapper.vm as unknown as {
            formState: AppSettings
            toggleTracker: (trackerCode: string, checked: boolean | 'indeterminate') => void
            toggleImageHostProvider: (providerCode: string, checked: boolean | 'indeterminate') => void
            onSubmit: (event: { data: AppSettings }) => Promise<void>
        }

        vm.toggleTracker('FNP', true)
        vm.toggleImageHostProvider('imgbb', true)

        expect(vm.formState.trackers[0]?.selected).toBe(true)
        expect(vm.formState.imageHostProviders[0]?.selected).toBe(true)
    })

    it('refreshes ffmpeg and ffprobe values when submit resolves with saved settings', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                ffmpegPath: 'ffmpeg',
                ffprobePath: 'ffprobe',
            })
        )
        saveSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                ffmpegPath: '/custom/ffmpeg',
                ffprobePath: '/custom/ffprobe',
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
                ffmpegPath: '/custom/ffmpeg',
                ffprobePath: '/custom/ffprobe',
            }),
        })

        expect(vm.formState.ffmpegPath).toBe('/custom/ffmpeg')
        expect(vm.formState.ffprobePath).toBe('/custom/ffprobe')
    })

    it('responds to checkbox and input update events from the rendered form controls', async () => {
        getSettingsMock.mockResolvedValue(
            buildSettings({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: false, code: 'imgbb', name: 'ImgBB' }],
                trackers: [{ selected: false, code: 'FNP', name: 'FearNoPeer' }],
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
