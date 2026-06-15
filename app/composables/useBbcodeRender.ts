import { TagNode, getUniqAttr, isTagNode } from '@bbob/plugin-helper'
import presetHTML5 from '@bbob/preset-html5'
import type { NodeContent, ParseError, PresetTagsDefinition, TagNodeTree } from '@bbob/types'
import bbobHTML from '@bbob/html'

export function useBbcodeRender() {
    const parseError = ref<string | undefined>(undefined)

    function toHtml(content: string) {
        parseError.value = undefined

        const processed = bbobHTML(normalizeListItems(content), extendedPresetHTML5(), {
            caseFreeTags: true,
            onError: (err) => onError(err),
        })

        function onError(error: ParseError) {
            parseError.value = `parsing error: tag: ${error.tagName}, line number: ${error.lineNumber}, colum number: ${error.columnNumber}.`
        }

        return processed
    }

    return {
        toHtml,
        error: parseError,
    }
}

// Wraps runs of bare [*] lines (outside an existing [list]) with [list]...[/list]
// so the base preset's list handler processes them correctly.
function normalizeListItems(content: string): string {
    return content
        .split(/(\[list[^\]]*\][\s\S]*?\[\/list\])/gi)
        .map((segment, i) => {
            if (i % 2 === 1) return segment
            return segment.replace(/(\[\*\][^\n]*(?:\n|(?=\[\/)))+/g, (match) => `[list]\n${match}[/list]\n`)
        })
        .join('')
}

const extendedPresetHTML5 = presetHTML5.extend((tags: PresetTagsDefinition<string>) => ({
    ...tags,
    center: (node) =>
        TagNode.create(
            'div',
            {
                class: 'text-center',
            },
            node.content
        ),
    right: (node) =>
        TagNode.create(
            'div',
            {
                class: 'text-right',
            },
            node.content
        ),
    img: (node, { render }) => {
        const widthAttr = node.attrs?.width
        const rawSize = String(widthAttr ?? getUniqAttr(node.attrs) ?? '').trim()
        const widthFromAttr = rawSize.match(/^(?:width\s*=\s*)?(\d+)(?:\s*[xX]\s*\d+)?$/i)?.[1]
        const width = widthFromAttr ? `${widthFromAttr}px` : undefined

        return TagNode.create(
            'img',
            {
                class: 'inline-block max-w-full my-1',
                src: render(node.content),
                referrerpolicy: 'no-referrer',
                ...(width && { width }),
            },
            null
        )
    },
    size: (node) => {
        const fontSize = Math.min(Math.max(Number(getUniqAttr(node.attrs)), 10), 100)

        return TagNode.create(
            'span',
            {
                style: `font-size:${fontSize}px;`,
            },
            node.content
        )
    },
    url: (node, { render }) => {
        return TagNode.create(
            'a',
            {
                href: getUniqAttr(node.attrs) ? getUniqAttr(node.attrs) : render(node.content),
                class: 'font-medium text-blue-400 transition-colors duration-150 hover:text-blue-300',
            },
            node.content
        )
    },
    spoiler: (node) =>
        TagNode.create('details', {}, [
            TagNode.create(
                'summary',
                {
                    class: 'cursor-pointer font-medium text-default',
                },
                getUniqAttr(node.attrs) ? String(getUniqAttr(node.attrs)) : 'Spoiler'
            ),
            TagNode.create('div', {}, node.content),
        ]),
    b: (node) =>
        TagNode.create(
            'span',
            {
                class: 'font-bold',
            },
            node.content
        ),
    quote: (node) =>
        TagNode.create(
            'blockquote',
            {
                class: 'rounded-md border border-default/60 border-l-4 border-l-emerald-400/70 bg-elevated/40 px-3 py-2 text-muted shadow-xs',
            },
            node.content
        ),
    comparison: (node) => {
        const values = getUniqAttr(node.attrs)
        const labels = values ? String(values).split(',') : ['Comparison']
        const text = labels.map((s) => `<span class="font-bold">${s.trim()}</span>`).join(' vs ') + ': Show'

        return TagNode.create('div', {}, text)
    },
    code: (node) =>
        TagNode.create(
            'pre',
            {
                class: 'overflow-x-auto whitespace-pre text-justify rounded-xl border border-default/60 bg-elevated/40 px-3 py-3 shadow-xs',
            },
            node.content
        ),
    font: (node) => {
        const fontFamily = getUniqAttr(node.attrs)
        const style = fontFamily ? `font-family:${fontFamily};` : undefined

        return TagNode.create(
            'span',
            {
                ...(style && { style: style }),
            },
            node.content
        )
    },
    list: (node) => {
        const type = getUniqAttr(node.attrs)
        const attrs: Record<string, string> = { class: type ? 'list-decimal ml-5' : 'list-disc ml-5' }
        if (type) attrs.type = String(type)

        return TagNode.create(type ? 'ol' : 'ul', attrs, toListNodes(node.content))
    },
}))

// Inlined from @bbob/preset-html5 defaultTags (not exported by the package).
function toListNodes(content: TagNodeTree | undefined): NodeContent[] {
    return (content as NodeContent[]).reduce<NodeContent[]>((acc, node) => {
        const listItem = acc[acc.length - 1]

        if (isTagNode(node) && TagNode.isOf(node, '*')) {
            acc.push(TagNode.create('li', {}, []))
            return acc
        }

        if (isTagNode(listItem) && Array.isArray(listItem.content)) {
            listItem.content = listItem.content.concat(node)
            return acc
        }

        acc.push(node)
        return acc
    }, [])
}
