export function useDescriptionFooter() {
    const {
        public: { version, projectUrl },
    } = useRuntimeConfig()

    const footer = `[right][url=${projectUrl}]Uploaded using Tui v ${version}[/url][/right]`

    function withFooter(description: string) {
        return description ? `${description}\n\n${footer}` : footer
    }

    function withoutFooter(description: string) {
        return description.replace(/(?:\n\n)?\[right\]\[url=[^\]]+\]Uploaded using Tui v [^[]+\[\/url\]\[\/right\]$/, '')
    }

    return { withFooter, withoutFooter }
}
