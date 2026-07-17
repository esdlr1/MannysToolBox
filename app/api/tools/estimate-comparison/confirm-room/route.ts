// Confirm a suggested room pairing — stored as a RoomAlias so this
// carrier's room naming auto-merges in every future comparison.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeRoom } from '@/lib/estimate-engine/match'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { mineRoom, carrierRoom } = await request.json()
    if (!mineRoom || !carrierRoom) {
      return NextResponse.json({ error: 'Missing mineRoom or carrierRoom' }, { status: 400 })
    }
    const a = normalizeRoom(mineRoom)
    const b = normalizeRoom(carrierRoom)
    if (a === b) return NextResponse.json({ ok: true })
    const [first, second] = a < b ? [a, b] : [b, a]
    await prisma.roomAlias
      .create({ data: { a: first, b: second } })
      .catch(() => undefined) // duplicate = already learned
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Compare v2] Confirm room failed:', error)
    return NextResponse.json({ error: 'Could not save room pairing' }, { status: 500 })
  }
}
