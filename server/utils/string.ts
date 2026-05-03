export function isBlank(value?: string | null): value is undefined | null | '' {
    return !value || value.trim().length === 0
}
