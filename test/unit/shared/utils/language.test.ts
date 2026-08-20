import { describe, expect, it } from 'vitest'
import { getLanguageDisplayName, getLanguageOptions, languageListIncludes, languagesMatch, normalizeLanguageCode } from '../../../../shared/types/language'

describe('language utilities', () => {
    it.each([
        [' cn ', 'zh'],
        ['in', 'id'],
        ['ENG', 'en'],
        ['fre', 'fr'],
        ['fra', 'fr'],
        ['en-US', 'en'],
        ['cmn', 'cmn'],
        ['yue', 'yue'],
        ['unknown', 'unknown'],
        ['   ', ''],
    ])('normalizes "%s" to "%s"', (input, expected) => {
        expect(normalizeLanguageCode(input)).toBe(expected)
    })

    it.each([
        ['zh', 'Chinese'],
        ['dum', 'Middle Dutch'],
        ['cmn', 'Mandarin Chinese'],
        ['yue', 'Cantonese'],
        ['ro', 'Romanian'],
        ['id', 'Indonesian'],
        ['is', 'Icelandic'],
        ['mul', 'Multiple Languages'],
        ['und', 'Undetermined'],
        ['mis', 'Uncoded Language'],
        ['zxx', 'No Linguistic Content'],
        ['xyz', 'xyz'],
        ['', ''],
    ])('displays "%s" as "%s"', (code, expected) => {
        expect(getLanguageDisplayName(code)).toBe(expected)
    })

    it.each([
        ['en', 'eng', true],
        ['cmn', 'zh', true],
        ['zh', 'cmn', true],
        ['yue', 'zh', true],
        ['cmn', 'yue', false],
        ['mul', 'en', false],
        ['mul', 'mul', true],
        ['', 'en', false],
        ['en', '', false],
    ])('matches "%s" with "%s" as %s', (first, second, expected) => {
        expect(languagesMatch(first, second)).toBe(expected)
    })

    it('checks a language list using normalized equivalence', () => {
        expect(languageListIncludes(['fr', 'cmn'], 'zh')).toBe(true)
        expect(languageListIncludes(['fr', 'cmn'], 'en')).toBe(false)
    })

    it('builds common options with special values last', () => {
        const options = getLanguageOptions()
        const specialCodes = ['mis', 'mul', 'und', 'zxx']
        const specialOptions = options.slice(-specialCodes.length)

        expect(options.find(({ value }) => value === 'cmn')).toEqual({ value: 'cmn', label: 'Mandarin Chinese' })
        expect(options.find(({ value }) => value === 'yue')).toEqual({ value: 'yue', label: 'Cantonese' })
        expect(specialOptions.map(({ value }) => value)).toEqual(expect.arrayContaining(specialCodes))
        expect(options.slice(0, -specialCodes.length).some(({ value }) => specialCodes.includes(value))).toBe(false)
    })

    it('searches the complete dataset by code or label and limits results', () => {
        expect(getLanguageOptions([], 'Welsh')).toContainEqual({ value: 'cy', label: 'Welsh' })
        expect(getLanguageOptions([], 'wel')).toContainEqual({ value: 'cy', label: 'Welsh' })
        expect(getLanguageOptions([], 'a')).toHaveLength(50)
    })

    it('appends normalized unknown codes once while ignoring known and blank extras', () => {
        const options = getLanguageOptions([' XYZ ', 'xyz', 'eng', '   '])

        expect(options.filter(({ value }) => value === 'xyz')).toEqual([{ value: 'xyz', label: 'xyz' }])
        expect(options.filter(({ value }) => value === 'en')).toHaveLength(1)
    })
})
