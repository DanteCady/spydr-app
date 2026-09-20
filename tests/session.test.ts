import { describe, expect, it } from 'vitest'
import { mayPersist } from '../shared/session'

/**
 * The session slot holds one snapshot. These rules are what stop the cheapest action in the app —
 * opening the sample to see what it does — from spending somebody's real directory read.
 */
describe('mayPersist', () => {
  it('never saves the sample, whatever consent says', () => {
    expect(mayPersist('fixture', 'yes')).toBe(false)
    expect(mayPersist('fixture', 'no')).toBe(false)
    expect(mayPersist('fixture', 'unset')).toBe(false)
  })

  it('saves a real directory only once it has been allowed', () => {
    expect(mayPersist('ldap', 'yes')).toBe(true)
    expect(mayPersist('ldap', 'no')).toBe(false)
    expect(mayPersist('ldap', 'unset')).toBe(false)
  })

  /**
   * The regression this file exists for: a real read is on disk, the licence is removed, and the
   * activation screen offers the sample right below a promise that nothing was deleted. Opening it
   * must not write over the read that promise refers to.
   */
  it('leaves a consented real read alone when the sample is opened next', () => {
    expect(mayPersist('ldap', 'yes')).toBe(true)
    expect(mayPersist('fixture', 'yes')).toBe(false)
  })
})
