import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

describe('useBbcodeRender composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
        vi.stubGlobal('ref', ref)
    })

    it('renders the custom BBCode tags into HTML', async () => {
        const { useBbcodeRender } = await import('../../../../app/composables/useBbcodeRender')
        const { toHtml, error } = useBbcodeRender()

        const html = toHtml(
            '[center]Title[/center][right]Right[/right][img=500]https://img[/img][size=200]Large[/size][url=https://example.com]Link[/url][spoiler=Hide]Body[/spoiler][b]Bold[/b][quote]Quote[/quote][comparison=Source A, Source B][/comparison][code]const a = 1[/code][font=Courier New]Mono[/font]'
        )

        expect(html).toContain('class="text-center"')
        expect(html).toContain('class="text-right"')
        expect(html).toContain('src="https://img"')
        expect(html).toContain('width="500px"')
        expect(html).toContain('font-size:100px;')
        expect(html).toContain('href="https://example.com"')
        expect(html).toContain('>Hide<')
        expect(html).toContain('class="font-bold"')
        expect(html).toContain('<blockquote')
        expect(html).toContain('Source A')
        expect(html).toContain('Source B')
        expect(html).toContain('<pre')
        expect(html).toContain('font-family:Courier New;')
        expect(error.value).toBeUndefined()
    })

    it('uses content as the url href and clamps small font sizes', async () => {
        const { useBbcodeRender } = await import('../../../../app/composables/useBbcodeRender')
        const { toHtml } = useBbcodeRender()

        const html = toHtml('[url]https://example.com/path[/url][size=8]Tiny[/size][img=640x360]https://thumb[/img]')

        expect(html).toContain('href="https://example.com/path"')
        expect(html).toContain('font-size:10px;')
        expect(html).toContain('width="640px"')
    })

    it('handles bbcode variants without optional attrs', async () => {
        const { useBbcodeRender } = await import('../../../../app/composables/useBbcodeRender')
        const { toHtml } = useBbcodeRender()

        const html = toHtml('[img]https://plain[/img][spoiler]Hidden[/spoiler][comparison]Body[/comparison][font]Plain[/font]')

        expect(html).toContain('src="https://plain"')
        expect(html).not.toContain('width=')
        expect(html).toContain('>Spoiler<')
        expect(html).toContain('Comparison')
        expect(html).not.toContain('font-family:')
    })

    it('renders [*] list items as li elements in any container', async () => {
        const { useBbcodeRender } = await import('../../../../app/composables/useBbcodeRender')
        const { toHtml } = useBbcodeRender()

        const inQuote = toHtml('[quote][*][b]Source #1.[/b] Link\n[*][b]Source #2.[/b] Other[/quote]')
        expect(inQuote).toContain('<li')
        expect(inQuote).toContain('Source #1.')
        expect(inQuote).toContain('Source #2.')

        const inList = toHtml('[list][*]item one\n[*]item two\n[/list]')
        expect(inList).toContain('<li')
        expect(inList).toContain('list-disc')
        expect(inList).toContain('item one')
        expect(inList).toContain('item two')

        const ordered = toHtml('[list=1][*]first\n[*]second\n[/list]')
        expect(ordered).toContain('<ol')
        expect(ordered).toContain('list-decimal')
        expect(ordered).toContain('first')
    })

    it('stores parse errors from invalid BBCode', async () => {
        vi.resetModules()
        vi.doMock('@bbob/html', () => ({
            default: vi.fn((_content: string, _preset: unknown, options: { onError?: (error: { tagName: string; lineNumber: number; columnNumber: number }) => void }) => {
                options.onError?.({
                    tagName: 'b',
                    lineNumber: 1,
                    columnNumber: 4,
                })

                return 'broken'
            }),
        }))
        const { useBbcodeRender } = await import('../../../../app/composables/useBbcodeRender')
        const { toHtml, error } = useBbcodeRender()

        expect(toHtml('[/b]')).toBe('broken')

        expect(error.value).toContain('parsing error: tag: b')
    })
})
