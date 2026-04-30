import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import userEvent from '@testing-library/user-event'
import { screen, within } from '@testing-library/vue'
import DefaultLayout from '../../../app/layouts/default.vue'

const { logoutMock, logoutState, navigateToMock, routeState } = vi.hoisted(() => ({
    logoutMock: vi.fn(),
    logoutState: { loading: false },
    navigateToMock: vi.fn(),
    routeState: { path: '/' },
}))

mockNuxtImport('useLogout', () => {
    return () => ({
        logout: logoutMock,
        loading: logoutState.loading,
        errorMessage: { value: '' },
    })
})

mockNuxtImport('navigateTo', () => navigateToMock)
mockNuxtImport('useRoute', () => () => routeState)

describe('default layout', () => {
    beforeEach(() => {
        logoutMock.mockReset()
        navigateToMock.mockReset()
        logoutState.loading = false
        routeState.path = '/'
    })

    it('renders navigation items', async () => {
        await renderSuspended(DefaultLayout, {
            slots: {
                default: '<div>slot content</div>',
            },
        })

        expect(screen.getByRole('link', { name: 'Dashboard' })).toBeDefined()
        expect(screen.getByRole('link', { name: 'History' })).toBeDefined()
        expect(screen.getByRole('link', { name: 'Upload' })).toBeDefined()
        expect(screen.getByRole('link', { name: 'About' })).toBeDefined()
        expect(screen.getByText('slot content')).toBeDefined()
    })

    it('opens and closes logout modal with cancel', async () => {
        const user = userEvent.setup()

        await renderSuspended(DefaultLayout)

        await user.click(screen.getAllByRole('button', { name: 'Log out' })[0] as HTMLElement)
        expect(screen.getByText('Are you sure you want to log out?')).toBeDefined()

        const dialog = screen.getByRole('dialog')
        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('calls logout and navigates to login when confirmed', async () => {
        logoutMock.mockResolvedValue(undefined)
        const user = userEvent.setup()

        await renderSuspended(DefaultLayout)
        await user.click(screen.getAllByRole('button', { name: 'Log out' })[0] as HTMLElement)

        const dialog = screen.getByRole('dialog')
        await user.click(within(dialog).getByRole('button', { name: 'Log out' }))

        expect(logoutMock).toHaveBeenCalledTimes(1)
        expect(navigateToMock).toHaveBeenCalledWith('/login')
    })

    it('navigates to login even when logout returns null', async () => {
        logoutMock.mockResolvedValue(null)
        const user = userEvent.setup()

        await renderSuspended(DefaultLayout)
        await user.click(screen.getAllByRole('button', { name: 'Log out' })[0] as HTMLElement)

        const dialog = screen.getByRole('dialog')
        await user.click(within(dialog).getByRole('button', { name: 'Log out' }))

        expect(logoutMock).toHaveBeenCalledTimes(1)
        expect(navigateToMock).toHaveBeenCalledWith('/login')
    })

    it('keeps logout confirm button disabled while logout is loading', async () => {
        logoutState.loading = true
        const user = userEvent.setup()

        await renderSuspended(DefaultLayout)
        await user.click(screen.getAllByRole('button', { name: 'Log out' })[0] as HTMLElement)

        const dialog = screen.getByRole('dialog')
        const confirmButton = within(dialog).getByRole('button', { name: 'Log out' })
        expect(confirmButton.getAttribute('disabled')).not.toBeNull()
    })

    it.each(['/history', '/upload', '/about'])('renders navigation for route %s', async (path) => {
        routeState.path = path

        await renderSuspended(DefaultLayout)

        expect(screen.getByRole('link', { name: 'Dashboard' })).toBeDefined()
        expect(screen.getByRole('link', { name: 'History' })).toBeDefined()
        expect(screen.getByRole('link', { name: 'Upload' })).toBeDefined()
        expect(screen.getByRole('link', { name: 'About' })).toBeDefined()
    })
})
