import { describe, expect, it } from 'vitest'
import { isBlank } from '../../../../server/utils/string'

describe('string utils', () => {
    it.each([undefined, null, '', '   ', '\n\t'])('returns true for blank value %j', (value) => {
        expect(isBlank(value)).toBe(true)
    })

    it.each(['a', '  a  '])('returns false for non-blank value %j', (value) => {
        expect(isBlank(value)).toBe(false)
    })
})
