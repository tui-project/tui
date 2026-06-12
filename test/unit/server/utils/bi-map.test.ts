import { describe, expect, it } from 'vitest'
import { BiMap, ManyToOneMap } from '../../../../server/utils/bi-map'

describe('BiMap', () => {
    const map = BiMap<string, number>([
        ['a', 1],
        ['b', 2],
    ])

    it('looks up value by key', () => expect(map.getByKey('a')).toBe(1))
    it('looks up key by value', () => expect(map.getByValue(2)).toBe('b'))
    it('returns undefined for missing key', () => expect(map.getByKey('z')).toBeUndefined())
    it('returns undefined for missing value', () => expect(map.getByValue(99)).toBeUndefined())
})

describe('ManyToOneMap', () => {
    const map = ManyToOneMap<string, string>([
        ['web-dl', 'web'],
        ['webrip', 'web'],
        ['hdtv', 'web'],
        ['encode', 'encode'],
        ['remux', 'remux'],
    ])

    it('looks up the family for a key', () => expect(map.getByKey('web-dl')).toBe('web'))
    it('returns all keys sharing the same value', () => expect(map.getByValue('web')).toEqual(['web-dl', 'webrip', 'hdtv']))
    it('returns a single-element array for a unique value', () => expect(map.getByValue('remux')).toEqual(['remux']))
    it('returns empty array for an unknown value', () => expect(map.getByValue('unknown')).toEqual([]))
})
