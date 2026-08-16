export function makeConst<T extends Record<string, { value: string; label: string }>>(
    input: T
): [{ readonly [K in keyof T]: T[K]['value'] }, Array<{ value: T[keyof T]['value']; label: string }>] {
    const values = Object.fromEntries(Object.entries(input).map(([key, item]) => [key, item.value]))
    const options = Object.values(input).map(({ value, label }) => ({ value, label }))
    return [values as { readonly [K in keyof T]: T[K]['value'] }, options]
}
