export type Path = {
    label: string
    value: string
    icon: string
    folder: boolean
}

type PathResponse = {
    path: string
    folder: boolean
}

export function useGetPaths(parent: Ref<string>) {
    const query = computed(() => (parent.value ? { parent: parent.value } : undefined))

    const { pending, data, error, refresh } = useFetch('/api/paths', {
        query: query,
        transform: (paths: PathResponse[]): Path[] =>
            paths.map((path) => ({
                label: path.path,
                value: path.path,
                icon: path.folder ? 'i-lucide-folder' : 'i-lucide-file',
                folder: path.folder,
            })),
    })

    return {
        pending,
        error,
        data,
        refresh,
    }
}
