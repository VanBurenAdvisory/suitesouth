"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import {
  countBookingsForCustomer,
  createCustomer,
  deleteCustomer,
  findPossibleDuplicates,
  updateCustomer,
} from "@/lib/db/customers";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function readInput(formData: FormData) {
  return {
    firstName: text(formData, "first_name") || null,
    lastName: text(formData, "last_name"),
    phone: text(formData, "phone") || null,
    email: text(formData, "email") || null,
    address: text(formData, "address") || null,
    notes: text(formData, "notes") || null,
    hasStandingContract: formData.get("has_standing_contract") === "on",
  };
}

export type CustomerFormState = { error: string | null; duplicates: string[] };

export async function addCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireAuth();
  const input = readInput(formData);
  if (!input.lastName) return { error: "Last name is required.", duplicates: [] };

  // Advisory only: a matching phone or last name is worth flagging once, but
  // pressing save again goes through.
  if (!text(formData, "acknowledge_duplicate")) {
    const dupes = await findPossibleDuplicates(input);
    if (dupes.length > 0) {
      return {
        error: null,
        duplicates: dupes.map(
          (d) =>
            `${d.firstName ? `${d.firstName} ${d.lastName}` : d.lastName}${d.phone ? `, ${d.phone}` : ""}`,
        ),
      };
    }
  }

  await createCustomer(input);
  revalidatePath("/customers");
  revalidatePath("/");
  return { error: null, duplicates: [] };
}

/**
 * Only for customers who should not exist, such as a duplicate or a typo.
 * Anyone with booking history stays: their name is on those records, and
 * removing them would orphan the history rather than tidy it.
 */
export async function removeCustomer(formData: FormData): Promise<void> {
  await requireAuth();
  const id = text(formData, "id");
  if (!id) return;

  // Re-checked here rather than trusting the page, which may be stale.
  if ((await countBookingsForCustomer(id)) > 0) {
    redirect(`/customers/${id}?error=has_bookings`);
  }

  await deleteCustomer(id);
  revalidatePath("/customers");
  revalidatePath("/");
  redirect("/customers");
}

export async function saveCustomer(formData: FormData): Promise<void> {
  await requireAuth();
  const id = text(formData, "id");
  const input = readInput(formData);
  if (!id || !input.lastName) return;

  await updateCustomer(id, input);
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  revalidatePath("/stays");
  revalidatePath("/");
  redirect(`/customers/${id}`);
}
