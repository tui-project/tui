const store = new Map<string, string>()

const localStorageStub: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
        store.set(key, String(value))
    },
    removeItem: (key: string) => {
        store.delete(key)
    },
    clear: () => {
        store.clear()
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
        return store.size
    },
}

if (typeof window !== 'undefined') {
    const hasWorkingLocalStorage = typeof window.localStorage?.getItem === 'function' && typeof window.localStorage?.setItem === 'function'

    if (!hasWorkingLocalStorage) {
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: localStorageStub,
        })
    }
}
