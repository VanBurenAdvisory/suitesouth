"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import {
  createEvent,
  deleteEvent,
  getEvent,
  setEventPropertyRate,
  updateEvent,
} from "@/lib/db/events";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function optionalAmount(formData: FormData, name: string): number | null {
  const raw = text(formData, name).replace(/[$,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function readInput(formData: FormData) {
  const startDate = text(formData, "start_date");
  const yearRaw = Number(text(formData, "year"));
  return {
    name: text(formData, "name"),
    year: Number.isFinite(yearRaw) && yearRaw > 1900 ? Math.trunc(yearRaw) : Number(startDate.slice(0, 4)),
    startDate,
    endDate: text(formData, "end_date"),
    eventType: text(formData, "event_type") || "recurring",
    suggestedRate: optionalAmount(formData, "suggested_rate"),
    notes: text(formData, "notes") || null,
  };
}

function refresh(id?: string) {
  revalidatePath("/events");
  if (id) revalidatePath(`/events/${id}`);
  revalidatePath("/availability");
  revalidatePath("/calendar");
}

/** Returns an error code rather than failing silently, which looks like success. */
function validate(input: ReturnType<typeof readInput>): string | null {
  if (!input.name) return "name";
  if (!input.startDate || !input.endDate) return "dates";
  if (input.endDate <= input.startDate) return "order";
  return null;
}

export async function addEvent(formData: FormData): Promise<void> {
  await requireAuth();
  const input = readInput(formData);

  const problem = validate(input);
  if (problem) redirect(`/events?error=${problem}`);

  let id: string;
  try {
    id = await createEvent(input);
  } catch (error) {
    // The unique (name, year) constraint is the likely one to hit here.
    console.error("createEvent failed", error);
    redirect("/events?error=duplicate");
  }

  refresh(id);
  redirect(`/events/${id}`);
}

export async function saveEvent(formData: FormData): Promise<void> {
  await requireAuth();
  const id = text(formData, "id");
  if (!id) redirect("/events");

  const input = readInput(formData);
  const problem = validate(input);
  if (problem) redirect(`/events/${id}?error=${problem}`);

  try {
    await updateEvent(id, input);
  } catch (error) {
    console.error("updateEvent failed", error);
    redirect(`/events/${id}?error=duplicate`);
  }

  refresh(id);
  redirect("/events");
}

export async function removeEvent(formData: FormData): Promise<void> {
  await requireAuth();
  const id = text(formData, "id");
  if (!id) return;
  await deleteEvent(id);
  refresh();
  redirect("/events");
}

/** Blank clears the override so the event-level rate applies again. */
export async function savePropertyRate(formData: FormData): Promise<void> {
  await requireAuth();
  const eventId = text(formData, "event_id");
  const propertyId = text(formData, "property_id");
  if (!eventId || !propertyId) return;

  const event = await getEvent(eventId);
  if (!event) return;

  await setEventPropertyRate(eventId, propertyId, optionalAmount(formData, "suggested_rate"), {
    startDate: event.startDate,
    endDate: event.endDate,
  });
  refresh(eventId);
}
