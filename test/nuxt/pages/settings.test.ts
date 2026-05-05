import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/vue'
import { ref } from 'vue'
import SettingsPage from '../../../app/pages/settings.vue'

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

describe('settings page', () => {
    beforeEach(() => {
        getSettingsMock.mockReset()
        saveSettingsMock.mockReset()
        loadingRef.value = false
        errorRef.value = false
    })

    it('loads and renders saved media paths', async () => {
        getSettingsMock.mockResolvedValue({ mediaPaths: ['/media/a'], tmdbApiKey: '' })
        await renderSuspended(SettingsPage)

        expect(getSettingsMock).toHaveBeenCalledTimes(1)
        expect(screen.getByText('/media/a')).toBeDefined()
    })

    it('adds/removes paths and submits updated settings', async () => {
        getSettingsMock.mockResolvedValue({ mediaPaths: [], tmdbApiKey: '' })
        saveSettingsMock.mockResolvedValue({ mediaPaths: ['/media/a'], tmdbApiKey: '' })
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.type(screen.getByPlaceholderText('/path/to/media/folder'), '/media/a')
        await user.click(screen.getByRole('button', { name: 'Add' }))
        expect(screen.getByText('/media/a')).toBeDefined()

        await user.click(screen.getByRole('button', { name: /save/i }))
        expect(saveSettingsMock).toHaveBeenCalledWith({ mediaPaths: ['/media/a'], tmdbApiKey: '' })

        await user.click(screen.getByRole('button', { name: 'Remove /media/a' }))
        expect(screen.queryByText('/media/a')).toBeNull()
    })

    it('does not add empty or duplicate media paths', async () => {
        getSettingsMock.mockResolvedValue({ mediaPaths: [], tmdbApiKey: '' })
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)

        await user.type(screen.getByPlaceholderText('/path/to/media/folder'), '   ')
        await user.click(screen.getByRole('button', { name: 'Add' }))
        expect(screen.queryByRole('button', { name: 'Remove /path/to/media/folder' })).toBeNull()

        await user.type(screen.getByPlaceholderText('/path/to/media/folder'), '/path/to/media/folder')
        await user.click(screen.getByRole('button', { name: 'Add' }))
        expect(screen.getByText('/path/to/media/folder')).toBeDefined()

        await user.type(screen.getByPlaceholderText('/path/to/media/folder'), '/path/to/media/folder')
        await user.click(screen.getByRole('button', { name: 'Add' }))
        expect(screen.getAllByText('/path/to/media/folder')).toHaveLength(1)
    })

    it('does not submit when no media paths are configured', async () => {
        getSettingsMock.mockResolvedValue({ mediaPaths: [], tmdbApiKey: '' })
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).not.toHaveBeenCalled()
    })

    it('shows load error alert when settings fetch fails', async () => {
        getSettingsMock.mockResolvedValue(null)
        errorRef.value = true

        await renderSuspended(SettingsPage)

        expect(screen.getByText('Failed to load settings. Please try again.')).toBeDefined()
    })

    it('does not show load error when settings fetch returns null without error', async () => {
        getSettingsMock.mockResolvedValue(null)
        errorRef.value = false

        await renderSuspended(SettingsPage)

        expect(screen.queryByText('Failed to load settings. Please try again.')).toBeNull()
    })

    it('shows save error alert when settings save fails', async () => {
        getSettingsMock.mockResolvedValue({ mediaPaths: ['/media/a'], tmdbApiKey: '' })
        saveSettingsMock.mockResolvedValue(null)
        errorRef.value = true
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(screen.getByText('Unable to save settings. Please try again.')).toBeDefined()
    })

    it('shows success alert when settings save succeeds', async () => {
        getSettingsMock.mockResolvedValue({ mediaPaths: [], tmdbApiKey: '' })
        saveSettingsMock.mockResolvedValue({ mediaPaths: ['/media/a'], tmdbApiKey: '' })
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        await user.type(screen.getByPlaceholderText('/path/to/media/folder'), '/media/a')
        await user.click(screen.getByRole('button', { name: 'Add' }))
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalledWith({ mediaPaths: ['/media/a'], tmdbApiKey: '' })
        expect(await screen.findByText('Settings successfully saved.')).toBeDefined()
    })

    it('shows loading skeletons and hides form while loading is true', async () => {
        loadingRef.value = true
        getSettingsMock.mockResolvedValue({ mediaPaths: ['/media/a'], tmdbApiKey: '' })

        await renderSuspended(SettingsPage)

        expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
        expect(screen.getAllByLabelText('loading')).toHaveLength(3)
    })

    it('loads and submits tmdb api key', async () => {
        getSettingsMock.mockResolvedValue({ mediaPaths: ['/media/a'], tmdbApiKey: 'old-key' })
        saveSettingsMock.mockResolvedValue({ mediaPaths: ['/media/a'], tmdbApiKey: 'new-key' })
        const user = userEvent.setup()

        await renderSuspended(SettingsPage)
        expect(screen.getByDisplayValue('old-key')).toBeDefined()

        await user.clear(screen.getByPlaceholderText('Enter TMDB API key'))
        await user.type(screen.getByPlaceholderText('Enter TMDB API key'), 'new-key')
        await user.click(screen.getByRole('button', { name: /save/i }))

        expect(saveSettingsMock).toHaveBeenCalledWith({ mediaPaths: ['/media/a'], tmdbApiKey: 'new-key' })
    })
})
