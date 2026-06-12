export type BiMap<K, V> = ReturnType<typeof BiMap<K, V>>

export function BiMap<K, V>(entries: [K, V][]) {
    const forward = new Map<K, V>(entries)
    const reverse = new Map<V, K>(entries.map(([k, v]) => [v, k]))
    return {
        getByKey: (key: K) => forward.get(key),
        getByValue: (value: V) => reverse.get(value),
    }
}

export type ManyToOneMap<K, V> = ReturnType<typeof ManyToOneMap<K, V>>

export function ManyToOneMap<K, V>(entries: [K, V][]) {
    const forward = new Map<K, V>(entries)
    const reverse = new Map<V, K[]>()
    for (const [k, v] of entries) {
        const existing = reverse.get(v)
        if (existing) existing.push(k)
        else reverse.set(v, [k])
    }
    return {
        getByKey: (key: K) => forward.get(key)!,
        getByValue: (value: V) => reverse.get(value) ?? [],
    }
}
