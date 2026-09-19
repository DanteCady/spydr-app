/**
 * Just enough semver to answer "is the release newer than what is running". Pre-release tags are
 * compared as lower than the same release without one, which is the only rule that matters here.
 */
export interface Version {
  parts: [number, number, number]
  pre: string
}

export function parseVersion(raw: string): Version | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(raw.trim())
  if (!m) return null
  return { parts: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? '' }
}

/** Negative when a is older, 0 when equal, positive when a is newer. Unparseable sorts as equal. */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a)
  const vb = parseVersion(b)
  if (!va || !vb) return 0
  for (let i = 0; i < 3; i += 1) {
    if (va.parts[i] !== vb.parts[i]) return va.parts[i] - vb.parts[i]
  }
  if (va.pre === vb.pre) return 0
  if (!va.pre) return 1
  if (!vb.pre) return -1
  return va.pre < vb.pre ? -1 : 1
}

export function isNewer(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0
}
