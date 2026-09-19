import { describe, expect, it } from 'vitest'
import {
  fileTimeMs,
  first,
  generalizedTime,
  guidFrom,
  memberAttrNames,
  parentDn,
  ridFrom,
  strings
} from '../electron/directory/parse'

describe('first / strings', () => {
  it('unwraps the shapes ldapts returns', () => {
    expect(first('x')).toBe('x')
    expect(first(['a', 'b'])).toBe('a')
    expect(first(Buffer.from('buf'))).toBe('buf')
    expect(first(undefined)).toBe('')
    expect(first(null)).toBe('')
    expect(first(42)).toBe('42')
  })

  it('collects multi-valued attributes and drops blanks', () => {
    expect(strings(['a', '', 'b'])).toEqual(['a', 'b'])
    expect(strings('solo')).toEqual(['solo'])
    expect(strings(undefined)).toEqual([])
  })
})

describe('guidFrom', () => {
  // objectGUID is a little-endian mixed-endian GUID: the first three groups are byte-swapped.
  it('reorders the mixed-endian bytes the way Windows displays them', () => {
    const buf = Buffer.from([
      0x78, 0x56, 0x34, 0x12, 0x34, 0x12, 0x78, 0x56,
      0x9a, 0xbc, 0xde, 0xf0, 0x11, 0x22, 0x33, 0x44
    ])
    expect(guidFrom({ objectGUID: buf })).toBe('12345678-1234-5678-9abc-def011223344')
  })

  it('accepts the array-wrapped form', () => {
    const buf = Buffer.alloc(16, 0)
    expect(guidFrom({ objectGUID: [buf] })).toBe('00000000-0000-0000-0000-000000000000')
  })

  it('falls back to the DN when the GUID is missing or malformed', () => {
    expect(guidFrom({ distinguishedName: 'CN=a,DC=x' })).toBe('CN=a,DC=x')
    expect(guidFrom({ objectGUID: Buffer.alloc(4), distinguishedName: 'CN=b,DC=x' })).toBe('CN=b,DC=x')
  })
})

describe('ridFrom', () => {
  // S-1-5-21-<3 subauths>-513 (Domain Users). RID is the last 4-byte LE sub-authority.
  const sid = (rid: number): Buffer => {
    const b = Buffer.alloc(8 + 5 * 4)
    b[0] = 1
    b[1] = 5
    b.writeUIntBE(5, 2, 6)
    b.writeUInt32LE(21, 8)
    b.writeUInt32LE(0x11111111, 12)
    b.writeUInt32LE(0x22222222, 16)
    b.writeUInt32LE(0x33333333, 20)
    b.writeUInt32LE(rid, 24)
    return b
  }

  it('reads the relative identifier', () => {
    expect(ridFrom(sid(513))).toBe(513)
    expect(ridFrom(sid(512))).toBe(512)
    expect(ridFrom([sid(1104)])).toBe(1104)
  })

  it('returns null for anything that is not a usable SID', () => {
    // ldapts hands back a lossy string unless the attribute is in explicitBufferAttributes;
    // that silently produced no primary-group edges at all, so it must not parse.
    expect(ridFrom('S-1-5-21-1-2-3-513')).toBeNull()
    expect(ridFrom(undefined)).toBeNull()
    expect(ridFrom(Buffer.alloc(4))).toBeNull()
    const truncated = sid(513).subarray(0, 20)
    expect(ridFrom(truncated)).toBeNull()
  })
})

describe('fileTimeMs', () => {
  it('converts Windows FILETIME to a unix millisecond timestamp', () => {
    // 1601-01-01 epoch, 100ns ticks. 2021-01-01T00:00:00Z.
    expect(fileTimeMs('132539328000000000')).toBe(Date.UTC(2021, 0, 1))
  })

  it('treats never-logged-on as null rather than 1601', () => {
    expect(fileTimeMs('0')).toBeNull()
    expect(fileTimeMs(undefined)).toBeNull()
    expect(fileTimeMs('not a number')).toBeNull()
  })
})

describe('generalizedTime', () => {
  it('parses AD generalized time to ISO', () => {
    expect(generalizedTime('20240115103000.0Z')).toBe('2024-01-15T10:30:00.000Z')
  })

  it('hands back a well-shaped but impossible date instead of throwing', () => {
    // A single bad attribute must not take down the whole ingest.
    expect(() => generalizedTime('20241945103000.0Z')).not.toThrow()
    expect(generalizedTime('20241945103000.0Z')).toBe('20241945103000.0Z')
  })

  it('passes through anything it cannot parse, and drops empties', () => {
    expect(generalizedTime('whenever')).toBe('whenever')
    expect(generalizedTime(undefined)).toBeUndefined()
  })
})

describe('parentDn', () => {
  it('drops the leftmost RDN', () => {
    expect(parentDn('CN=Jason Chen,OU=IT,DC=harborview,DC=local')).toBe('OU=IT,DC=harborview,DC=local')
  })

  it('respects escaped commas inside an RDN', () => {
    expect(parentDn('CN=Chen\\, Jason,OU=IT,DC=x')).toBe('OU=IT,DC=x')
  })

  it('returns null at the root', () => {
    expect(parentDn('DC=local')).toBeNull()
  })
})

describe('memberAttrNames', () => {
  it('finds ranged member attributes, which AD uses past 1500 members', () => {
    expect(memberAttrNames({ 'member;range=0-1499': [], cn: 'x', member: [] }).sort())
      .toEqual(['member', 'member;range=0-1499'])
  })
})
