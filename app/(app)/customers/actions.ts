"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createCustomer, findPossibleDuplicates, updateCustomer } from "@/lib/db/customers";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function readInput(formData: FormData) {
  return {
    firstName: text(formData, "first_name") || null,
    lastName: text(formData, "last_name"),
    phone: text(formData, "phone") || null,
    email: text(formData, "email") || null,
    address: text(formData, "address") || null,
    notes: text(formData, "notes") || null,
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
