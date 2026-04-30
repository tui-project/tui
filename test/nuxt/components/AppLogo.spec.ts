import { renderSuspended } from '@nuxt/test-utils/runtime'
import { screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import AppLogo from '~/components/AppLogo.vue'

describe('AppLogo', () => {
    it('renders the brand link to the home page', async () => {
        await renderSuspended(AppLogo, {
            props: {
                to: '/',
            },
        })

        const homeLink = screen.getByRole('link', { name: /logo/i })

        expect(homeLink.getAttribute('href')).toBe('/')
    })

    it('renders the logo image', async () => {
        await renderSuspended(AppLogo)

        const logoImage = screen.getByAltText('logo')

        expect(logoImage.getAttribute('src')).toContain('logo.png')
    })

    it('applies a custom height class when provided', async () => {
        await renderSuspended(AppLogo, {
            props: {
                height: 'h-12',
            },
        })

        const logoImage = screen.getByAltText('logo')

        expect(logoImage.className).toContain('h-12')
    })

    it('renders a non-link logo when no destination is provided', async () => {
        await renderSuspended(AppLogo)

        expect(screen.queryByRole('link', { name: /logo/i })).toBeNull()
        expect(screen.getByAltText('logo')).toBeDefined()
    })
})
