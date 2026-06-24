import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRuntimeConfig = {
    public: {
        version: '1.2.3',
        projectUrl: 'https://github.com/tui-project/tui-v2',
    },
}

describe('useDescriptionFooter composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
        vi.stubGlobal('useRuntimeConfig', () => mockRuntimeConfig)
    })

    it('appends the footer to a non-empty description', async () => {
        const { useDescriptionFooter } = await import('../../../../app/composables/useDescriptionFooter')
        const { withFooter } = useDescriptionFooter()

        const result = withFooter('My description')

        expect(result).toBe('My description\n\n[right][url=https://github.com/tui-project/tui-v2]Uploaded using Tui v 1.2.3[/url][/right]')
    })

    it('returns only the footer when description is empty', async () => {
        const { useDescriptionFooter } = await import('../../../../app/composables/useDescriptionFooter')
        const { withFooter } = useDescriptionFooter()

        const result = withFooter('')

        expect(result).toBe('[right][url=https://github.com/tui-project/tui-v2]Uploaded using Tui v 1.2.3[/url][/right]')
    })
})
