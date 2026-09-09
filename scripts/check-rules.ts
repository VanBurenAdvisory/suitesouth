// Assertions for turnaround blocking and derived booking state.
// Run with: npm run check:rules
import { blockedWindow, conflictsWith, turnaroundOnlyDays } from "../lib/turnaround.ts";
import { deriveState, isStaleHold } from "../lib/booking-state.ts";

let failures = 0;

function eq(label: string, actual: unknown, want: unknown) {
  const a = JSON.stringify(actual);
  const w = JSON.stringify(want);
  const ok = a === w;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}: got ${a}, want ${w}`);
}

// Stay: check in 9/28, last night 9/30, checkout 10/1.
const stay = (turnaroundDays: number) => ({
  checkIn: "2026-09-28",
  checkOut: "2026-10-01",
  turnaroundDays,
});

console.log("\nTurnaround blocking");
{
  eq("t=0 blocks through the last night", blockedWindow(stay(0)).through, "2026-09-30");
  eq("t=1 blocks through 10/2", blockedWindow(stay(1)).through, "2026-10-02");
  eq("t=2 blocks through 10/3", blockedWindow(stay(2)).through, "2026-10-03");
  eq("window starts at check-in", blockedWindow(stay(1)).from, "2026-09-28");
  eq("t=1 turnaround days", turnaroundOnlyDays(stay(1)), ["2026-10-01", "2026-10-02"]);
  eq("t=0 has no turnaround days", turnaroundOnlyDays(stay(0)), []);
}

console.log("\nConflicts against an existing 9/28 to 10/1 stay, t=1");
{
  const existing = [stay(1)];
  const proposed = (checkIn: string, checkOut: string) => ({
    checkIn,
    checkOut,
    turnaroundDays: 1,
  });
  eq(
    "10/3 check-in is clear",
    conflictsWith(proposed("2026-10-03", "2026-10-05"), existing).length,
    0,
  );
  eq(
    "10/2 check-in hits the turnaround day",
    conflictsWith(proposed("2026-10-02", "2026-10-04"), existing).length,
    1,
  );
  eq(
    "10/1 check-in hits the checkout day",
    conflictsWith(proposed("2026-10-01", "2026-10-03"), existing).length,
    1,
  );
  eq(
    "a stay ending 9/26 leaves room",
    conflictsWith(proposed("2026-09-24", "2026-09-26"), existing).length,
    0,
  );
  eq(
    "a stay ending 9/27 collides via its own turnaround",
    conflictsWith(proposed("2026-09-24", "2026-09-27"), existing).length,
    1,
  );
}

console.log("\nDerived state");
{
  const b = (
    lifecycle: "hold" | "active" | "cancelled",
    contractStatus: "not_sent" | "sent" | "signed",
    invoiceStatus: "not_sent" | "sent" | "deposit_received" | "paid_in_full",
  ) => ({ lifecycle, contractStatus, invoiceStatus });

  eq("cancelled wins over everything", deriveState(b("cancelled", "signed", "paid_in_full")), "cancelled");
  eq("signed + paid in full", deriveState(b("active", "signed", "paid_in_full")), "confirmed");
  eq("signed + deposit", deriveState(b("active", "signed", "deposit_received")), "booked");
  eq("signed, no money yet", deriveState(b("active", "signed", "sent")), "committed");
  eq("sent, not signed", deriveState(b("active", "sent", "not_sent")), "committed");
  eq("nothing sent", deriveState(b("hold", "not_sent", "not_sent")), "hold");

  console.log("  gap cases, money ahead of paperwork");
  eq("deposit but contract only sent", deriveState(b("active", "sent", "deposit_received")), "committed");
  eq("paid in full but nothing sent", deriveState(b("active", "not_sent", "paid_in_full")), "hold");

  console.log("  with require_signature_for_booked turned off");
  const loose = { requireSignatureForBooked: false };
  eq("deposit promotes", deriveState(b("active", "sent", "deposit_received"), loose), "booked");
  eq("paid in full promotes", deriveState(b("active", "not_sent", "paid_in_full"), loose), "confirmed");
  eq("cancelled still wins", deriveState(b("cancelled", "signed", "paid_in_full"), loose), "cancelled");
}

console.log("\nStale holds");
{
  const today = "2026-09-09";
  eq(
    "expired hold is stale",
    isStaleHold({ lifecycle: "hold", holdExpiresAt: "2026-09-08" }, today),
    true,
  );
  eq(
    "future hold is not",
    isStaleHold({ lifecycle: "hold", holdExpiresAt: "2026-09-10" }, today),
    false,
  );
  eq(
    "active booking is never stale",
    isStaleHold({ lifecycle: "active", holdExpiresAt: "2026-09-01" }, today),
    false,
  );
  eq(
    "hold with no expiry is not stale",
    isStaleHold({ lifecycle: "hold", holdExpiresAt: null }, today),
    false,
  );
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
