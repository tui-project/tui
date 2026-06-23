import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSuspended, mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/vue'
import { ref } from 'vue'
import SettingsPage from '../../../app/pages/settings.vue'
import type { AppSettings } from '../../../app/composables/useGetSettings'

const loadingRef = ref(false)
const loadErrorRef = ref<Error | null>(null)
const loadedDataRef = ref<AppSettings | null>(null)
const savedDataRef = ref<AppSettings | null>(null)
const saveErrorRef = ref('')
let capturedSaveBody: AppSettings | undefined

const { saveSettingsMock, toastAddMock } = vi.hoisted(() => ({
    saveSettingsMock: vi.fn(),
    toastAddMock: vi.fn(),
}))

mockNuxtImport('useToast', () => {
    return () => ({ add: toastAddMock })
})

mockNuxtImport('useGetSettings', () => {
    return () => ({
        pending: loadingRef,
        data: loadedDataRef,
        error: loadErrorRef,
        refresh: vi.fn(),
    })
})

mockNuxtImport('usePostSettings', () => {
    return () => {
        return {
            pending: ref(false),
            data: savedDataRef,
            errorMessage: saveErrorRef,
            execute: (body: AppSettings) => {
                capturedSaveBody = body
                return saveSettingsMock(body)
            },
        }
    }
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
        saveSettingsMock.mockReset()
        toastAddMock.mockReset()
        loadingRef.value = false
        loadErrorRef.value = null
        loadedDataRef.value = buildSettings()
        savedDataRef.value = null
        saveErrorRef.value = ''
        capturedSaveBody = undefined
    })

    it('adds/removes paths and submits updated settings', async () => {
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.type(screen.getByPlaceholderText('/path/to/media/folder'), '/media/a')
        await user.keyboard('{Enter}')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalled()
        expect(capturedSaveBody).toEqual(buildSaveSettingsRequest({ mediaPaths: ['/media/a'] }))
    })

    it('shows success message after saving settings', async () => {
        loadedDataRef.value = buildSettings({ mediaPaths: ['/media/a'] })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        await waitFor(() => {
            expect(toastAddMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Settings successfully saved.', color: 'success' }))
        })
    })

    it('loads and submits screenshot settings in nested provider payload', async () => {
        loadedDataRef.value = buildSettings({
            mediaPaths: ['/media/a'],
            imageHostProviders: [{ selected: true, code: 'imgbb', name: 'ImgBB', apiKey: 'old-imgbb-key' }],
            ffmpegPath: '/usr/local/bin/ffmpeg',
            ffprobePath: '/usr/local/bin/ffprobe',
        })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)

        await user.clear(screen.getByPlaceholderText('ffmpeg'))
        await user.type(screen.getByPlaceholderText('ffmpeg'), '/opt/ffmpeg')
        await user.clear(screen.getByPlaceholderText('ffprobe'))
        await user.type(screen.getByPlaceholderText('ffprobe'), '/opt/ffprobe')
        await user.clear(screen.getByPlaceholderText('Enter ImgBB API key'))
        await user.type(screen.getByPlaceholderText('Enter ImgBB API key'), 'new-imgbb-key')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalled()
        expect(capturedSaveBody).toEqual(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: true, code: 'imgbb', name: 'ImgBB', apiKey: 'new-imgbb-key' }],
                ffmpegPath: '/opt/ffmpeg',
                ffprobePath: '/opt/ffprobe',
            })
        )
    })

    it('loads and submits tracker settings in nested tracker payload', async () => {
        loadedDataRef.value = buildSettings({
            mediaPaths: ['/media/a'],
            trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx', apiKey: 'old-api-key', passKey: 'old-pass-key' }],
        })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)

        await user.clear(screen.getByPlaceholderText('Enter ULCX API key'))
        await user.type(screen.getByPlaceholderText('Enter ULCX API key'), 'new-api-key')
        await user.clear(screen.getByPlaceholderText('Enter ULCX pass key'))
        await user.type(screen.getByPlaceholderText('Enter ULCX pass key'), 'new-pass-key')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalled()
        expect(capturedSaveBody).toEqual(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx', apiKey: 'new-api-key', passKey: 'new-pass-key' }],
            })
        )
    })

    it.each([
        {
            label: 'tracker',
            settings: { trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx', apiKey: 'old-api-key', passKey: 'old-pass-key' }] },
            checkboxLabel: 'Upload.cx (ULCX)',
            expected: { trackers: [{ selected: false, code: 'ULCX', name: 'Upload.cx' }] },
        },
        {
            label: 'image host provider',
            settings: { imageHostProviders: [{ selected: true, code: 'imgbb', name: 'ImgBB', apiKey: 'old-imgbb-key' }] },
            checkboxLabel: 'ImgBB',
            expected: { imageHostProviders: [{ selected: false, code: 'imgbb', name: 'ImgBB' }] },
        },
    ] as { label: string; settings: Partial<AppSettings>; checkboxLabel: string; expected: Partial<AppSettings> }[])(
        'removes $label from payload when unticked',
        async ({ settings, checkboxLabel, expected }) => {
            loadedDataRef.value = buildSettings({ mediaPaths: ['/media/a'], ...settings })
            const user = userEvent.setup({ delay: null })

            await renderSuspended(SettingsPage)
            await user.click(screen.getByRole('checkbox', { name: checkboxLabel }))
            await user.click(screen.getByRole('button', { name: /save/i }))

            expect(saveSettingsMock).toHaveBeenCalled()
            expect(capturedSaveBody).toEqual(buildSaveSettingsRequest({ mediaPaths: ['/media/a'], ...expected }))
        }
    )

    it('refreshes image host credentials from the saved response after unticking and saving', async () => {
        loadedDataRef.value = buildSettings({
            mediaPaths: ['/media/a'],
            imageHostProviders: [{ selected: true, code: 'imgbb', name: 'ImgBB', apiKey: 'old-imgbb-key' }],
        })
        saveSettingsMock.mockImplementation(async () => {
            savedDataRef.value = buildSettings({
                mediaPaths: ['/media/a'],
                imageHostProviders: [{ selected: false, code: 'imgbb', name: 'ImgBB' }],
            })
        })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'ImgBB' }))
        await user.click(screen.getByRole('button', { name: /save/i }))
        await user.click(screen.getByRole('checkbox', { name: 'ImgBB' }))

        expect((screen.getByPlaceholderText('Enter ImgBB API key') as HTMLInputElement).value).toBe('')
    })

    it.each([
        {
            label: 'tracker credentials',
            checkboxLabel: 'Upload.cx (ULCX)',
            errors: ['API Key is required for ULCX.', 'Pass Key is required for ULCX.'],
        },
        {
            label: 'image host api key',
            checkboxLabel: 'ImgBB',
            errors: ['ImgBB API Key is required when ImgBB is selected.'],
        },
    ])('shows inline $label validation errors and blocks submit when missing', async ({ checkboxLabel, errors }) => {
        loadedDataRef.value = buildSettings({ mediaPaths: ['/media/a'] })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: checkboxLabel }))
        await user.click(screen.getByRole('button', { name: /save/i }))

        await screen.findByText(errors[0]!)
        for (const error of errors.slice(1)) expect(screen.getByText(error)).toBeDefined()
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })

    it('preserves tracker credentials locally when a tracker is unticked and re-ticked', async () => {
        loadedDataRef.value = buildSettings({
            mediaPaths: ['/media/a'],
            trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx', apiKey: 'saved-api-key', passKey: 'saved-pass-key' }],
        })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))
        await user.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))

        expect((screen.getByPlaceholderText('Enter ULCX API key') as HTMLInputElement).value).toBe('saved-api-key')
        expect((screen.getByPlaceholderText('Enter ULCX pass key') as HTMLInputElement).value).toBe('saved-pass-key')
    })

    it('blocks submit when TMDB API key is empty', async () => {
        loadedDataRef.value = buildSettings({ mediaPaths: ['/media/a'], tmdbApiKey: '' })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter TMDB API key').getAttribute('aria-invalid')).toBe('true')
        })
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })

    it('submits updated TMDB API key', async () => {
        loadedDataRef.value = buildSettings({ mediaPaths: ['/media/a'], tmdbApiKey: 'old-key' })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.clear(screen.getByPlaceholderText('Enter TMDB API key'))
        await user.type(screen.getByPlaceholderText('Enter TMDB API key'), 'new-key')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalled()
        expect(capturedSaveBody?.tmdbApiKey).toBe('new-key')
    })

    it.each([
        { name: 'ffmpegPath', settings: { ffmpegPath: '' }, error: 'FFmpeg Path is required.' },
        { name: 'ffprobePath', settings: { ffprobePath: '' }, error: 'FFprobe Path is required.' },
        { name: 'mediainfoPath', settings: { mediainfoPath: '' }, error: 'Mediainfo Path is required.' },
    ])('blocks submit when $name is empty', async ({ settings, error }) => {
        loadedDataRef.value = buildSettings({ mediaPaths: ['/media/a'], ...settings })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        await screen.findByText(error)
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })

    it('clears the media paths validation error after adding a path', async () => {
        loadedDataRef.value = buildSettings()
        const user = userEvent.setup({ delay: null })

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
        loadedDataRef.value = buildSettings({ mediaPaths: ['/media/a'] })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }))
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('API Key is required for ULCX.')).toBeDefined()
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter ULCX API key').getAttribute('aria-invalid')).toBe('true')
        })
    })

    it('submits updated screenshot counts and refreshes the saved values from the response', async () => {
        loadedDataRef.value = buildSettings({ mediaPaths: ['/media/a'], movieScreenshotCount: 6, episodePackScreenshotCount: 3 })
        saveSettingsMock.mockImplementation(async () => {
            savedDataRef.value = buildSettings({ mediaPaths: ['/media/a'], movieScreenshotCount: 8, episodePackScreenshotCount: 4 })
        })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)

        await user.clear(screen.getByLabelText('Movie / Single Episode Screenshot Count'))
        await user.type(screen.getByLabelText('Movie / Single Episode Screenshot Count'), '8')
        await user.clear(screen.getByLabelText('Episode Pack Screenshot Count'))
        await user.type(screen.getByLabelText('Episode Pack Screenshot Count'), '4')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalled()
        expect(capturedSaveBody).toEqual(buildSaveSettingsRequest({ mediaPaths: ['/media/a'], movieScreenshotCount: 8, episodePackScreenshotCount: 4 }))

        await waitFor(() => {
            expect((screen.getByLabelText('Movie / Single Episode Screenshot Count') as HTMLInputElement).value).toBe('8')
            expect((screen.getByLabelText('Episode Pack Screenshot Count') as HTMLInputElement).value).toBe('4')
        })
    })

    it('refreshes all tool path and screenshot fields from the save response', async () => {
        loadedDataRef.value = buildSettings({
            mediaPaths: ['/media/a'],
            mediainfoPath: 'mediainfo',
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            episodePackScreenshotCount: 3,
        })
        saveSettingsMock.mockImplementation(async () => {
            savedDataRef.value = buildSettings({
                mediaPaths: ['/media/a'],
                mediainfoPath: '/custom/mediainfo',
                ffmpegPath: '/custom/ffmpeg',
                ffprobePath: '/custom/ffprobe',
                movieScreenshotCount: 10,
                episodePackScreenshotCount: 5,
            })
        })

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

    it('shows error toast and not success toast when save fails', async () => {
        loadedDataRef.value = buildSettings({ mediaPaths: ['/media/a'] })
        saveSettingsMock.mockImplementation(async () => {
            saveErrorRef.value = 'Media path does not exist: /missing'
        })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        await waitFor(() => {
            expect(toastAddMock).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'Failed to save settings.', description: 'Media path does not exist: /missing', color: 'error' })
            )
            expect(toastAddMock).not.toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }))
        })
    })

    it('does not scroll to a field when onError is called with no errors', async () => {
        loadedDataRef.value = buildSettings()

        const wrapper = await mountSuspended(SettingsPage)
        const vm = wrapper.vm as unknown as {
            onError: (event: { errors: unknown[] }) => Promise<void>
        }

        await expect(vm.onError({ errors: [] })).resolves.toBeUndefined()
    })

    it('shows loading skeletons while settings are loading', async () => {
        loadingRef.value = true

        const wrapper = await mountSuspended(SettingsPage)

        expect(wrapper.find('[data-media-paths-input]').exists()).toBe(false)
    })

    it('shows load error alert when settings fail to load', async () => {
        loadErrorRef.value = new Error('network')

        await renderSuspended(SettingsPage)

        expect(await screen.findByText('Failed to load settings. Please try again.')).toBeDefined()
        expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
    })

    it('shows separator between selected trackers when there are multiple', async () => {
        loadedDataRef.value = buildSettings({
            mediaPaths: ['/media/a'],
            trackers: [
                { selected: true, code: 'ULCX', name: 'Upload.cx', apiKey: 'key1', passKey: 'pass1' },
                { selected: true, code: 'BHD', name: 'BeyondHD', apiKey: 'key2', passKey: 'pass2' },
            ],
        })

        const wrapper = await mountSuspended(SettingsPage)

        expect(wrapper.findAllComponents({ name: 'USeparator' }).length).toBeGreaterThan(0)
    })

    it('does not deselect other torrent clients when a client is deselected', async () => {
        loadedDataRef.value = buildSettings({
            mediaPaths: ['/media/a'],
            torrentClients: [
                { selected: true, code: 'QUI', name: 'qui', url: 'http://localhost:7474', apiKey: 'key' },
                { selected: false, code: 'OTHER', name: 'Other', url: '', apiKey: '' },
            ],
        })

        const wrapper = await mountSuspended(SettingsPage)
        const vm = wrapper.vm as unknown as { formState: AppSettings }

        const checkboxes = wrapper.findAllComponents({ name: 'UCheckbox' })
        const quiCheckbox = checkboxes.find((c) => c.props('label') === 'qui')
        await quiCheckbox?.vm.$emit('update:model-value', false)

        expect(vm.formState.torrentClients[0]?.selected).toBe(false)
        expect(vm.formState.torrentClients[1]?.selected).toBe(false)
    })

    it('submits updated mediainfo path', async () => {
        loadedDataRef.value = buildSettings({ mediaPaths: ['/media/a'] })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.clear(screen.getByPlaceholderText('mediainfo'))
        await user.type(screen.getByPlaceholderText('mediainfo'), '/usr/bin/mediainfo')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalled()
        expect(capturedSaveBody?.mediainfoPath).toBe('/usr/bin/mediainfo')
    })

    it('submits updated log level', async () => {
        loadedDataRef.value = buildSettings({ mediaPaths: ['/media/a'] })

        const wrapper = await mountSuspended(SettingsPage)
        const vm = wrapper.vm as unknown as { formState: AppSettings; onSubmit: (event: { data: AppSettings }) => Promise<void> }

        await wrapper.findComponent({ name: 'USelect' }).vm.$emit('update:model-value', 4)
        await vm.onSubmit({ data: vm.formState })

        expect(saveSettingsMock).toHaveBeenCalled()
        expect(capturedSaveBody?.logLevel).toBe(4)
    })

    it('submits torrent client url and api key when credentials are filled after selecting the client', async () => {
        loadedDataRef.value = buildSettings({
            mediaPaths: ['/media/a'],
            torrentClients: [{ selected: false, code: 'QUI', name: 'qui', url: '', apiKey: '' }],
        })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('checkbox', { name: 'qui' }))
        await user.type(screen.getByPlaceholderText('e.g. http://localhost:7474'), 'http://localhost:7474')
        await user.type(screen.getByPlaceholderText('Enter qui API key'), 'my-api-key')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalled()
        expect(capturedSaveBody).toEqual(
            buildSaveSettingsRequest({
                mediaPaths: ['/media/a'],
                torrentClients: [{ selected: true, code: 'QUI', name: 'qui', url: 'http://localhost:7474', apiKey: 'my-api-key' }],
            })
        )
    })

    it('shows inline torrent client validation errors when url or api key is missing', async () => {
        loadedDataRef.value = buildSettings({
            mediaPaths: ['/media/a'],
            torrentClients: [{ selected: true, code: 'QUI', name: 'qui', url: '', apiKey: '' }],
        })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('URL is required for qui.')).toBeDefined()
        expect(screen.getByText('API Key is required for qui.')).toBeDefined()
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })

    it('deselects other torrent clients when one is selected', async () => {
        loadedDataRef.value = buildSettings({
            mediaPaths: ['/media/a'],
            torrentClients: [
                { selected: true, code: 'QUI', name: 'qui', url: 'http://localhost:7474', apiKey: 'key' },
                { selected: false, code: 'OTHER', name: 'Other', url: '', apiKey: '' },
            ],
        })

        const wrapper = await mountSuspended(SettingsPage)
        const vm = wrapper.vm as unknown as { formState: AppSettings }

        const checkboxes = wrapper.findAllComponents({ name: 'UCheckbox' })
        const otherCheckbox = checkboxes.find((c) => c.props('label') === 'Other')
        await otherCheckbox?.vm.$emit('update:model-value', true)

        expect(vm.formState.torrentClients[0]?.selected).toBe(false)
        expect(vm.formState.torrentClients[1]?.selected).toBe(true)
    })

    it('shows validation error and blocks submit when more than one torrent client is selected', async () => {
        loadedDataRef.value = buildSettings({
            mediaPaths: ['/media/a'],
            torrentClients: [
                { selected: true, code: 'QUI', name: 'qui', url: 'http://localhost:7474', apiKey: 'key' },
                { selected: true, code: 'OTHER', name: 'Other', url: 'http://localhost:8080', apiKey: 'key2' },
            ],
        })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(await screen.findByText('Only one torrent client can be selected at a time.')).toBeDefined()
        expect(saveSettingsMock).not.toHaveBeenCalled()
    })
})
