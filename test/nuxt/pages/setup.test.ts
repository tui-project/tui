import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import SetupPage from '../../../app/pages/setup.vue'

const { initializeMock, loadingRef, errorMessageRef, navigateToMock } = vi.hoisted(() => ({
    initializeMock: vi.fn(),
    loadingRef: { value: false },
    errorMessageRef: { value: '' },
    navigateToMock: vi.fn(),
}))

mockNuxtImport('useSetup', () => {
    return () => ({
        initialize: initializeMock,
        loading: loadingRef,
        errorMessage: errorMessageRef,
    })
})

mockNuxtImport('navigateTo', () => navigateToMock)

describe('setup page', () => {
    beforeEach(() => {
        initializeMock.mockReset()
        navigateToMock.mockReset()
        loadingRef.value = false
        errorMessageRef.value = ''
    })

    it('renders setup heading', async () => {
        const wrapper = await mountSuspended(SetupPage)

        expect(wrapper.text()).toContain('Create your admin user account.')
    })

    it('shows setup-completed message from error key', async () => {
        errorMessageRef.value = 'setup_completed'
        const wrapper = await mountSuspended(SetupPage)

        expect(wrapper.text()).toContain('Setup is already completed. Please log in.')
    })

    it('shows a generic setup failure message for other errors', async () => {
        errorMessageRef.value = 'network_error'
        const wrapper = await mountSuspended(SetupPage)

        expect(wrapper.text()).toContain('Failed to complete setup.')
    })

    it('submits setup form and navigates to login on success', async () => {
        initializeMock.mockResolvedValue({ id: 'user-1', username: 'admin' })
        const wrapper = await mountSuspended(SetupPage)
        const setupForm = wrapper.findComponent({ name: 'UForm' })
        setupForm.vm.$emit('submit', {
            data: {
                username: 'admin',
                password: 'Admin@123',
            },
        })
        await wrapper.vm.$nextTick()

        expect(initializeMock).toHaveBeenCalledWith('admin', 'Admin@123')
        expect(navigateToMock).toHaveBeenCalledWith('/login')
    })

    it('does not navigate when setup submit fails', async () => {
        initializeMock.mockResolvedValue(null)
        const wrapper = await mountSuspended(SetupPage)
        const setupForm = wrapper.findComponent({ name: 'UForm' })
        setupForm.vm.$emit('submit', {
            data: {
                username: 'admin',
                password: 'Admin@123',
            },
        })
        await wrapper.vm.$nextTick()

        expect(initializeMock).toHaveBeenCalledWith('admin', 'Admin@123')
        expect(navigateToMock).not.toHaveBeenCalled()
    })
})
