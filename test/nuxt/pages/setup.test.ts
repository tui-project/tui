import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/vue'
import SetupPage from '../../../app/pages/setup.vue'

const { initializeMock, setupState, errorMessageRef, navigateToMock } = vi.hoisted(() => ({
    initializeMock: vi.fn(),
    setupState: { loading: false },
    errorMessageRef: { value: '' },
    navigateToMock: vi.fn(),
}))

mockNuxtImport('useSetup', () => {
    return () => ({
        initialize: initializeMock,
        loading: setupState.loading,
        errorMessage: errorMessageRef,
    })
})

mockNuxtImport('navigateTo', () => navigateToMock)

describe('setup page', () => {
    beforeEach(() => {
        initializeMock.mockReset()
        navigateToMock.mockReset()
        setupState.loading = false
        errorMessageRef.value = ''
    })

    it('renders setup heading', async () => {
        await renderSuspended(SetupPage)
        expect(screen.getByText('Create your admin user account.')).toBeDefined()
    })

    it('shows setup-completed message from error key', async () => {
        errorMessageRef.value = 'setup_completed'
        await renderSuspended(SetupPage)
        expect(screen.getByText('Setup is already completed. Please log in.')).toBeDefined()
    })

    it('shows a generic setup failure message for other errors', async () => {
        errorMessageRef.value = 'network_error'
        await renderSuspended(SetupPage)
        expect(screen.getByText('Failed to complete setup.')).toBeDefined()
    })

    it('submits setup form and navigates to login on success', async () => {
        initializeMock.mockResolvedValue({ id: 'user-1', username: 'admin' })
        const user = userEvent.setup({ delay: null })
        await renderSuspended(SetupPage)
        await user.type(screen.getByPlaceholderText('choose a username'), 'admin')
        await user.type(screen.getByPlaceholderText('choose a password'), 'Admin@123')
        await user.click(screen.getByRole('button', { name: /complete setup/i }))

        expect(initializeMock).toHaveBeenCalledWith('admin', 'Admin@123')
        expect(navigateToMock).toHaveBeenCalledWith('/login')
    })

    it('does not navigate when setup submit fails', async () => {
        initializeMock.mockResolvedValue(null)
        const user = userEvent.setup({ delay: null })
        await renderSuspended(SetupPage)
        await user.type(screen.getByPlaceholderText('choose a username'), 'admin')
        await user.type(screen.getByPlaceholderText('choose a password'), 'Admin@123')
        await user.click(screen.getByRole('button', { name: /complete setup/i }))

        expect(initializeMock).toHaveBeenCalledWith('admin', 'Admin@123')
        expect(navigateToMock).not.toHaveBeenCalled()
    })
})
