import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/vue'
import LoginPage from '../../../app/pages/login.vue'

const { loginMock, loginState, errorMessageRef, navigateToMock } = vi.hoisted(() => ({
    loginMock: vi.fn(),
    loginState: { loading: false },
    errorMessageRef: { value: '' },
    navigateToMock: vi.fn(),
}))

mockNuxtImport('useLogin', () => {
    return () => ({
        login: loginMock,
        loading: loginState.loading,
        errorMessage: errorMessageRef,
    })
})

mockNuxtImport('navigateTo', () => navigateToMock)

describe('login page', () => {
    beforeEach(() => {
        loginMock.mockReset()
        navigateToMock.mockReset()
        loginState.loading = false
        errorMessageRef.value = ''
    })

    it('renders login heading', async () => {
        await renderSuspended(LoginPage)
        expect(screen.getByText('Sign in to continue.')).toBeDefined()
    })

    it('shows invalid credentials message from error key', async () => {
        errorMessageRef.value = 'invalid_credentials'
        await renderSuspended(LoginPage)
        expect(screen.getByText('Invalid username or password.')).toBeDefined()
    })

    it('shows generic login failure message for unknown errors', async () => {
        errorMessageRef.value = 'network_error'
        await renderSuspended(LoginPage)
        expect(screen.getByText('Failed to log in.')).toBeDefined()
    })

    it('submits login form and navigates on success', async () => {
        loginMock.mockResolvedValue({
            sessionId: 'session-1',
            userId: 'user-1',
            expiresAt: '2030-01-01T01:00:00.000Z',
        })
        const user = userEvent.setup({ delay: null })

        await renderSuspended(LoginPage)
        await user.type(screen.getByPlaceholderText('enter your username'), 'admin')
        await user.type(screen.getByPlaceholderText('enter your password'), 'Admin@123')
        await user.click(screen.getByRole('button', { name: /log in/i }))

        expect(loginMock).toHaveBeenCalledWith('admin', 'Admin@123')
        expect(navigateToMock).toHaveBeenCalledWith('/')
    })

    it('does not navigate when login fails', async () => {
        loginMock.mockResolvedValue(null)
        const user = userEvent.setup({ delay: null })

        await renderSuspended(LoginPage)
        await user.type(screen.getByPlaceholderText('enter your username'), 'admin')
        await user.type(screen.getByPlaceholderText('enter your password'), 'Wrong@123')
        await user.click(screen.getByRole('button', { name: /log in/i }))

        expect(loginMock).toHaveBeenCalledWith('admin', 'Wrong@123')
        expect(navigateToMock).not.toHaveBeenCalled()
    })
})
