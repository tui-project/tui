import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRuntimeConfig = {
    public: {
        version: '1.2.3',
        projectUrl: 'https://github.com/tui-project/tui',
    },
}

describe('useDescriptionFooter composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
        vi.stubGlobal('useRuntimeConfig', () => mockRuntimeConfig)
    })

    it.each([
        ['My description', 'My description\n\n'],
        ['', ''],
    ])('appends the footer to description %j', async (description, prefix) => {
        const { useDescriptionFooter } = await import('../../../../app/composables/useDescriptionFooter')
        const { withFooter } = useDescriptionFooter()

        expect(withFooter(description)).toBe(`${prefix}[right][url=https://github.com/tui-project/tui]Uploaded using Tui v 1.2.3[/url][/right]`)
    })
    it.each([
        ['', ''],
        ['Release notes', 'Release notes'],
        ['Release notes\n\n[right][url=https://example.com]Uploaded using Tui v 0.1.0[/url][/right]', 'Release notes'],
        ['[right][url=https://example.com]Uploaded using Tui v 0.1.0[/url][/right]', ''],
        ['[right]Custom footer[/right]', '[right]Custom footer[/right]'],
    ])('removes only the generated trailing footer from %j', async (description, expected) => {
        const { useDescriptionFooter } = await import('../../../../app/composables/useDescriptionFooter')
        expect(useDescriptionFooter().withoutFooter(description)).toBe(expected)
    })
})
