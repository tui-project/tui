import { describe, expect, it } from 'vitest'
import { renderSuspended } from '@nuxt/test-utils/runtime'
import { screen } from '@testing-library/vue'
import App from '../../app/app.vue'

describe('app shell', () => {
    it('renders the active page inside the app shell', async () => {
        await renderSuspended(App, {
            route: '/setup',
        })

        expect(screen.getByText('Create your admin user account.')).toBeDefined()
    })
})
