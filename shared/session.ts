import type { DirectorySnapshot } from './types'

/**
 * Whether a snapshot may be written to the session slot.
 *
 * There is exactly one slot, which makes this a destructive decision rather than an additive one:
 * anything saved replaces whatever was there. Two rules follow, and both matter.
 *
 * A real directory needs consent, because it is somebody's organisation on disk.
 *
 * The sample is never saved at all — not because it is sensitive, but because it is not. It costs
 * nothing to rebuild from the fixture, and saving it would spend a real read's slot, along with
 * the profile needed to reconnect, on data nobody needs kept. Opening the sample to see what SPYDIR
 * does must not be able to cost someone the directory they already read.
 */
export function mayPersist(source: DirectorySnapshot['source'], consent: 'unset' | 'yes' | 'no'): boolean {
  if (source === 'fixture') return false
  return consent === 'yes'
}
