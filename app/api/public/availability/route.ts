import { NextResponse } from "next/server";
import { availabilityByDay } from "@/lib/availability";
import { addDays, isValidDate, todayLocal } from "@/lib/dates";

export const dynamic = "force-dynamic";

const MAX_DAYS = 180;

/**
 * Public and unauthenticated. Returns nothing but {property, date, available}.
 * There is no richer payload behind this to filter down from, so inspecting it
 * reveals no guest names, rates, financials, statuses, or turnaround reasoning.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const today = todayLocal();

  const fromParam = url.searchParams.get("from") ?? "";
  const toParam = url.searchParams.get("to") ?? "";

  const from = isValidDate(fromParam) ? fromParam : today;
  const requested = isValidDate(toParam) && toParam >= from ? toParam : addDays(from, 30);
  const cap = addDays(from, MAX_DAYS);
  const through = requested > cap ? cap : requested;

  try {
    const days = await availabilityByDay(from, through);
    return NextResponse.json(
      { from, through, days },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}
