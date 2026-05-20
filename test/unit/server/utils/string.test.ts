import { describe, expect, it } from 'vitest'
import { isBlank, normaliseBoolean, normalisePositiveInteger, normaliseRequiredString, normaliseSearchString, normaliseString } from '../../../../server/utils/string'

describe('string utils', () => {
    it.each([undefined, null, '', '   ', '\n\t'])('returns true for blank value %j', (value) => {
        expect(isBlank(value)).toBe(true)
    })

    it.each(['a', '  a  '])('returns false for non-blank value %j', (value) => {
        expect(isBlank(value)).toBe(false)
    })

    it.each([
        ['  abc  ', 'abc'],
        ['', ''],
        ['   ', ''],
    ])('normaliseString trims string value %j', (value, expected) => {
        expect(normaliseString(value)).toBe(expected)
    })

    it.each([undefined, null, 1, false, {}])('normaliseString returns null for non-string value %j', (value) => {
        expect(normaliseString(value)).toBeNull()
    })

    it.each([
        ['  abc  ', 'abc'],
        ['abc', 'abc'],
    ])('normaliseRequiredString returns trimmed non-empty value %j', (value, expected) => {
        expect(normaliseRequiredString(value)).toBe(expected)
    })

    it.each(['', '   ', undefined, null, 1, false])('normaliseRequiredString returns null for invalid value %j', (value) => {
        expect(normaliseRequiredString(value)).toBeNull()
    })

    it.each([
        [true, true],
        [false, false],
    ])('normaliseBoolean preserves boolean value %j', (value, expected) => {
        expect(normaliseBoolean(value)).toBe(expected)
    })

    it.each(['true', 1, undefined, null, {}])('normaliseBoolean returns null for non-boolean value %j', (value) => {
        expect(normaliseBoolean(value)).toBeNull()
    })

    it.each([
        [1, 1],
        [5, 5],
    ])('normalisePositiveInteger preserves positive integer %j', (value, expected) => {
        expect(normalisePositiveInteger(value)).toBe(expected)
    })

    it.each([0, -1, 1.5, '1', undefined, null])('normalisePositiveInteger returns null for invalid value %j', (value) => {
        expect(normalisePositiveInteger(value)).toBeNull()
    })

    it.each([
        ['Hello World', 'hello world'],
        ['  Hello   World  ', 'hello world'],
        ['Númenór', 'numenor'],
        ['Khazad-dûm', 'khazaddum'],
        ['Stories of the Second Age – Númenór', 'stories of the second age numenor'],
        ['Stories of the Second Age – Khazad-dûm', 'stories of the second age khazaddum'],
    ])('normaliseSearchString %j -> %j', (input, expected) => {
        expect(normaliseSearchString(input)).toBe(expected)
    })
})
