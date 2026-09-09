import { requireAuth } from "@/lib/auth";
import { listProperties, updateTurnaroundDays } from "@/lib/db/properties";
import { loadSettings, saveSetting } from "@/lib/db/settings";
import { FEE_TREATMENTS } from "@/lib/calc";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const FEE_LABELS: Record<string, string> = {
  manager: "Manager keeps it, to cover a cost",
  owner: "Passed through to the owners",
  commissionable: "Commission is charged on it",
};

async function saveSettings(formData: FormData): Promise<void> {
  "use server";
  await requireAuth();

  const num = (name: string, fallback: number) => {
    const n = Number(String(formData.get(name) ?? "").trim());
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
  };

  await saveSetting("defaultTurnaroundDays", num("default_turnaround_days", 1));
  await saveSetting("holdExpiryDays", num("hold_expiry_days", 7));
  await saveSetting("includeCancelledInTotals", formData.get("include_cancelled") === "on");
  await saveSetting("requireSignatureForBooked", formData.get("require_signature") === "on");

  const fee = String(formData.get("default_fee_treatment") ?? "manager");
  if (FEE_TREATMENTS.includes(fee as never)) await saveSetting("defaultFeeTreatment", fee);

  revalidatePath("/settings");
  revalidatePath("/stays");
  revalidatePath("/calendar");
  revalidatePath("/availability");
}

async function savePropertyTurnaround(formData: FormData): Promise<void> {
  "use server";
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  const n = Number(String(formData.get("turnaround_days") ?? ""));
  if (!id || !Number.isFinite(n)) return;

  await updateTurnaroundDays(id, n);
  revalidatePath("/settings");
  revalidatePath("/availability");
  revalidatePath("/calendar");
}

export default async function SettingsPage() {
  const [properties, settings] = await Promise.all([listProperties(), loadSettings()]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Settings</h2>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Turnaround by condo
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Days blocked after a checkout. 0 allows a same-day turn. 1 blocks the checkout day and
          the day after, so a stay ending 10/1 reopens on 10/3.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Copied onto each booking when it is logged, so changing this never moves dates on stays
          already in the book.
        </p>

        <div className="mt-3 space-y-3">
          {properties.map((p) => (
            <form key={p.id} action={savePropertyTurnaround} className="flex items-end gap-2">
              <input type="hidden" name="id" value={p.id} />
              <div className="min-w-0 flex-1">
                <label className="label" htmlFor={`turnaround-${p.id}`}>
                  {p.name}
                </label>
                <input
                  id={`turnaround-${p.id}`}
                  name="turnaround_days"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={p.turnaroundDays}
                  className="field"
                />
              </div>
              <button type="submit" className="btn-quiet shrink-0 py-3">
                Save
              </button>
            </form>
          ))}
        </div>
      </section>

      <form
        action={saveSettings}
        className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rules</h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="default_turnaround_days">
              Default turnaround for new condos
            </label>
            <input
              id="default_turnaround_days"
              name="default_turnaround_days"
              type="number"
              min={0}
              step={1}
              defaultValue={settings.defaultTurnaroundDays}
              className="field"
            />
          </div>

          <div>
            <label className="label" htmlFor="hold_expiry_days">
              Hold expires after, in days
            </label>
            <input
              id="hold_expiry_days"
              name="hold_expiry_days"
              type="number"
              min={0}
              step={1}
              defaultValue={settings.holdExpiryDays}
              className="field"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="default_fee_treatment">
              Default fee treatment
            </label>
            <select
              id="default_fee_treatment"
              name="default_fee_treatment"
              defaultValue={settings.defaultFeeTreatment}
              className="field"
            >
              {FEE_TREATMENTS.map((f) => (
                <option key={f} value={f}>
                  {FEE_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="require_signature"
              defaultChecked={settings.requireSignatureForBooked}
              className="mt-1 size-5 shrink-0 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">
              A signed contract is required before a booking shows as Booked or Confirmed.
              <span className="block text-xs text-slate-500">
                Turn this off to let a deposit or full payment advance the status on its own.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="include_cancelled"
              defaultChecked={settings.includeCancelledInTotals}
              className="mt-1 size-5 shrink-0 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">
              Include cancelled bookings in revenue totals.
              <span className="block text-xs text-slate-500">
                Cancelled stays never block dates regardless of this setting.
              </span>
            </span>
          </label>
        </div>

        <button type="submit" className="btn-primary mt-4">
          Save rules
        </button>
      </form>
    </main>
  );
}
