import { useApp } from '../state'

export function Connect() {
  const { openSample } = useApp()

  return (
    <div className="connect">
      <div className="connect-card">
        <h1>Spydr</h1>
        <p className="lede">Read-only explorer for messy on-prem Active Directory. Open the sample forest to learn the four workspaces before you bind to a DC.</p>
        <button className="primary" type="button" onClick={openSample}>
          Open sample directory
        </button>
        <p className="note">contoso.lab — nested groups, a membership cycle, stale and disabled users, a path into Domain Admins.</p>
        <fieldset>
          <legend>Connect to Active Directory</legend>
          <div className="row">
            <label>
              Domain FQDN
              <input disabled placeholder="corp.example.com" />
            </label>
            <label>
              Domain controller
              <input disabled placeholder="dc01.corp.example.com" />
            </label>
          </div>
          <div className="row">
            <label>
              User (UPN or DOMAIN\user)
              <input disabled placeholder="lee@corp.example.com" />
            </label>
            <label>
              Password
              <input disabled type="password" />
            </label>
          </div>
          <button className="ghost" type="button" disabled>
            Test connection — coming next
          </button>
        </fieldset>
      </div>
    </div>
  )
}
