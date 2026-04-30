import { describe, expect, it } from 'vitest'
import { renderSuspended } from '@nuxt/test-utils/runtime'
import { screen } from '@testing-library/vue'
import IndexPage from '../../../app/pages/index.vue'

describe('index page', () => {
    it('renders dashboard heading', async () => {
        await renderSuspended(IndexPage)

        expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeDefined()
    })
})
