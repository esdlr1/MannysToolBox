// The trust gate — stage 3 of the pipeline.
//
// A parse is only trusted when the extracted line items add up to the totals
// the PDF itself printed. A failed gate means the parse (or the document) is
// not understood, and the tool must say so instead of rendering a
// plausible-looking wrong report.
import {
  ParsedDocument,
  ReconciliationResult,
  RoomReconciliation,
} from './types'

/** Allowed rounding drift per room and for the grand total, in cents. */
const ROOM_TOLERANCE_CENTS = 2
const GRAND_TOLERANCE_CENTS = 5

export function reconcile(doc: ParsedDocument): ReconciliationResult {
  const rooms = doc.rooms.map((room) => reconcileRoom(doc, room.name, room.printedTotalRcvCents))
  const computedGrandRcvCents = doc.lineItems.reduce((sum, item) => sum + item.rcvCents, 0)

  const printedGrandRcvCents = doc.printedTotals.grandRcvCents
  const grandDeltaCents =
    printedGrandRcvCents === null ? null : computedGrandRcvCents - printedGrandRcvCents

  const messages: string[] = []
  const checkedRooms = rooms.filter((r) => r.printedRcvCents !== null)
  if (checkedRooms.length === 0) {
    messages.push('No printed room totals found — room-level reconciliation impossible')
  }
  if (printedGrandRcvCents === null) {
    messages.push('No printed grand total found — grand reconciliation impossible')
  } else if (grandDeltaCents !== null && Math.abs(grandDeltaCents) > GRAND_TOLERANCE_CENTS) {
    messages.push(
      `Grand total mismatch: parsed ${formatCents(computedGrandRcvCents)} vs printed ${formatCents(printedGrandRcvCents)}`
    )
  }
  for (const room of checkedRooms.filter((r) => !r.ok)) {
    messages.push(
      `Room "${room.room}" mismatch: parsed ${formatCents(room.computedRcvCents)} vs printed ${formatCents(room.printedRcvCents ?? 0)}`
    )
  }

  // The gate requires a verifiable grand total AND every verifiable room to match.
  const ok =
    printedGrandRcvCents !== null &&
    grandDeltaCents !== null &&
    Math.abs(grandDeltaCents) <= GRAND_TOLERANCE_CENTS &&
    checkedRooms.every((r) => r.ok)

  return {
    ok,
    rooms,
    computedGrandRcvCents,
    printedGrandRcvCents,
    grandDeltaCents,
    messages,
  }
}

function reconcileRoom(
  doc: ParsedDocument,
  roomName: string,
  printedRcvCents: number | null
): RoomReconciliation {
  const computedRcvCents = doc.lineItems
    .filter((item) => item.room === roomName)
    .reduce((sum, item) => sum + item.rcvCents, 0)
  const deltaCents = printedRcvCents === null ? null : computedRcvCents - printedRcvCents
  return {
    room: roomName,
    computedRcvCents,
    printedRcvCents,
    deltaCents,
    ok: deltaCents === null || Math.abs(deltaCents) <= ROOM_TOLERANCE_CENTS,
  }
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}
