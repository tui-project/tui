export function useDescriptionFooter() {
    const {
        public: { version, projectUrl },
    } = useRuntimeConfig()

    const footer = `[right][url=${projectUrl}]Uploaded using Tui v ${version}[/url][/right]`

    function withFooter(description: string) {
        return description ? `${description}\n\n${footer}` : footer
    }

    return { withFooter }
}
