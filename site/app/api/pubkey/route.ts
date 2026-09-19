import { NextResponse } from 'next/server'
import { signingKey } from '@/lib/server/keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The public half of the signing key, so a build of the desktop app can be given the right one.
 * Publishing it is the point: signatures are verified with it, never made with it.
 */
export async function GET() {
  const { publicPem, ephemeral } = signingKey()
  return NextResponse.json({
    publicKey: publicPem,
    ephemeral,
    note: ephemeral
      ? 'Generated at boot because LICENSE_PRIVATE_KEY is unset. Restarting the server invalidates every signature it has made.'
      : undefined
  })
}
