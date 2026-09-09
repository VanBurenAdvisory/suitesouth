// Assertions for the booking math. Run with: npm run check:calc
//
// The rate terms below are placeholders, not the deployment's real ones. They
// are chosen to exercise every branch: a 100% property with no co-owner, and a
// split property whose remainder divides unevenly enough to test the rounding.
import { calculate, nightsBetween } from "../lib/calc.ts";

let failures = 0;

function expect(label: string, actual: number, want: number) {
  const ok = Math.abs(actual - want) < 0.0001;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}: got ${actual}, want ${want}`);
}

const WHOLLY_OWNED = { ownerSharePct: 100, commissionPct: 50, feeTreatment: "manager" } as const;
const SPLIT = { ownerSharePct: 80, commissionPct: 50, feeTreatment: "manager" } as const;

console.log("\nWholly owned, $2,000 total over 4 nights");
{
  const c = calculate({ ...WHOLLY_OWNED, roomRevenue: 2000, nights: 4, fees: 0, taxAmount: null });
  expect("derived nightly rate", c.nightlyRate, 500);
  expect("subtotal", c.subtotal, 2000);
  expect("manager commission", c.managerCommission, 1000);
  expect("left to owners", c.ownerPool, 1000);
  expect("owner due", c.ownerDue, 1000);
  expect("co-owner due", c.coownerDue, 0);
  expect("amount due", c.amountDue, 2000);
}

console.log("\nSplit ownership, $2,000 total over 4 nights");
{
  const c = calculate({ ...SPLIT, roomRevenue: 2000, nights: 4, fees: 0, taxAmount: null });
  expect("manager commission", c.managerCommission, 800);
  expect("left to owners", c.ownerPool, 1200);
  expect("majority owner, 80% of the remainder", c.ownerDue, 960);
  expect("minority owner, 20% of the remainder", c.coownerDue, 240);
  expect("owner + co-owner === pool", c.ownerDue + c.coownerDue, c.ownerPool);
  expect("commission + pool === subtotal", c.managerCommission + c.ownerPool, c.subtotal);
  expect("amount due", c.amountDue, 2000);
}

console.log("\nSplit ownership, same stay with $150 tax");
{
  const c = calculate({ ...SPLIT, roomRevenue: 2000, nights: 4, fees: 0, taxAmount: 150 });
  expect("amount due", c.amountDue, 2150);
  expect("commission unaffected by tax", c.managerCommission, 800);
  expect("owner due unaffected by tax", c.ownerDue, 960);
}

console.log("\nFee treatment: manager keeps a $200 card fee");
{
  const c = calculate({ ...SPLIT, roomRevenue: 2000, nights: 4, fees: 200, taxAmount: null });
  expect("subtotal excludes the fee", c.subtotal, 2000);
  expect("commission unchanged", c.managerCommission, 800);
  expect("fee retained by manager", c.managerFees, 200);
  expect("manager total", c.managerTotal, 1000);
  expect("owners unaffected", c.ownerPool, 1200);
  expect("majority owner", c.ownerDue, 960);
  expect("guest still pays the fee", c.amountDue, 2200);
}

console.log("\nFee treatment: $200 passed through to owners");
{
  const c = calculate({
    ownerSharePct: 80,
    commissionPct: 50,
    feeTreatment: "owner",
    roomRevenue: 2000,
    nights: 4,
    fees: 200,
    taxAmount: null,
  });
  expect("commission unchanged", c.managerCommission, 800);
  expect("manager keeps nothing extra", c.managerFees, 0);
  expect("pool includes the fee", c.ownerPool, 1400);
  expect("majority owner", c.ownerDue, 1120);
  expect("minority owner", c.coownerDue, 280);
  expect("amount due", c.amountDue, 2200);
}

console.log("\nFee treatment: $200 commissionable");
{
  const c = calculate({
    ownerSharePct: 80,
    commissionPct: 50,
    feeTreatment: "commissionable",
    roomRevenue: 2000,
    nights: 4,
    fees: 200,
    taxAmount: null,
  });
  expect("subtotal includes the fee", c.subtotal, 2200);
  expect("commission is charged on it", c.managerCommission, 880);
  expect("left to owners", c.ownerPool, 1320);
  expect("owner + co-owner === pool", c.ownerDue + c.coownerDue, c.ownerPool);
  expect("amount due not double counted", c.amountDue, 2200);
}

console.log("\nRounding: split ownership, $999.99 over 3 nights");
{
  const c = calculate({ ...SPLIT, roomRevenue: 999.99, nights: 3, fees: 0, taxAmount: null });
  expect("derived nightly rate", c.nightlyRate, 333.33);
  expect("commission", c.managerCommission, 400);
  expect("left to owners", c.ownerPool, 599.99);
  expect("majority owner", c.ownerDue, 479.99);
  expect("minority owner takes the odd cent", c.coownerDue, 120);
  expect("commission + pool === subtotal", c.managerCommission + c.ownerPool, c.subtotal);
  expect("owner + co-owner === pool", c.ownerDue + c.coownerDue, c.ownerPool);
}

console.log("\nNights");
{
  expect("Mar 1 to Mar 5", nightsBetween("2026-03-01", "2026-03-05"), 4);
  expect("across DST", nightsBetween("2026-03-07", "2026-03-09"), 2);
  expect("same day", nightsBetween("2026-03-07", "2026-03-07"), 0);
  expect("reversed", nightsBetween("2026-03-09", "2026-03-07"), 0);
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
