import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import App from '../../app/app.vue'

describe('app shell', () => {
    it('renders the active page inside the app shell', async () => {
        const wrapper = await mountSuspended(App, {
            route: '/setup',
        })

        expect(wrapper.text()).toContain('Create your admin user account.')
    })
})
