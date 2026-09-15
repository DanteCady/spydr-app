export function mapLdapError(err: unknown): string {
  const e = err as { code?: string; name?: string; message?: string; cause?: { code?: string } }
  const code = e.code ?? e.cause?.code ?? ''
  const message = String(e.message ?? err)
  const lower = message.toLowerCase()

  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'EHOSTUNREACH' || code === 'ECONNRESET') {
    return `Can't reach the DC. Is VPN up? Firewall allowing LDAP/LDAPS? (${code})`
  }
  if (
    e.name === 'InvalidCredentialsError' ||
    lower.includes('invalid credentials') ||
    lower.includes('data 52e') ||
    /\b49\b/.test(message)
  ) {
    return 'Bind failed. Check UPN or DOMAIN\\user and password. A normal domain user is enough — do not use Domain Admin.'
  }
  if (
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'CERT_HAS_EXPIRED' ||
    lower.includes('unable to verify') ||
    lower.includes('self signed') ||
    lower.includes('certificate')
  ) {
    return 'TLS trust failed. Enable “Trust this server’s certificate” only if you expect a self-signed DC cert.'
  }

  return message.replace(/password[=:]\s*\S+/gi, 'password=***')
}
