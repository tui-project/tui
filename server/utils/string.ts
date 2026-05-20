export function isBlank(value: string | null): value is null | '' {
    return !value || value.trim().length === 0
}

export function normaliseString(input: unknown) {
    if (typeof input !== 'string') {
        return null
    }

    return input.trim()
}

export function normaliseRequiredString(input: unknown) {
    const value = normaliseString(input)
    return value && value.length > 0 ? value : null
}

export function normaliseBoolean(input: unknown) {
    return typeof input === 'boolean' ? input : null
}

export function normalisePositiveInteger(input: unknown) {
    if (typeof input !== 'number' || !Number.isInteger(input) || input < 1) {
        return null
    }

    return input
}

export function normaliseSearchString(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}
