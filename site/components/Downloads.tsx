import { latestRelease } from '@/lib/releases'

export async function Downloads() {
  const release = await latestRelease()
  return (
    <>
      <h2 className="dl-head">Version {release.version}</h2>
      <div className="dl-grid">
        {release.assets.map((asset) => (
          <a className="dl" key={asset.file} href={asset.url}>
            <p className="mono os">{asset.os}</p>
            <p className="file">{asset.file}</p>
            <p className="meta">{asset.note}</p>
          </a>
        ))}
      </div>
      <div className="callout">
        <p className="mono label">Before you run it</p>
        <p>
          These builds are not code-signed yet. Windows will show SmartScreen&rsquo;s &ldquo;Windows protected your
          PC&rdquo; — choose <em>More info → Run anyway</em>. macOS will say the app &ldquo;is damaged&rdquo;, which is
          Gatekeeper&rsquo;s unhelpful wording for unsigned: right-click → Open, or{' '}
          <span className="mono">xattr -dr com.apple.quarantine /Applications/SPYDR.app</span>. We would rather tell you
          that here than have you discover it.
        </p>
      </div>
      {!release.live ? (
        <p className="dl-note mono">
          Release feed not configured — set GITHUB_REPO and these cards describe whatever is actually published.
        </p>
      ) : null}
    </>
  )
}
