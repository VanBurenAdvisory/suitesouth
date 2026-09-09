const MESSAGES: Record<string, string> = {
  name: "Give the event a name.",
  dates: "Both a check-in and a check-out date are required.",
  order: "Check-out has to be after check-in.",
  duplicate: "An event with that name and year already exists. Change the name or the year.",
  has_bookings: "That customer has stays logged, so they cannot be deleted.",
};

/** Renders nothing when there is no error code, so it is safe to always mount. */
export default function FormError({ code }: { code?: string }) {
  const message = code ? MESSAGES[code] : undefined;
  if (!message) return null;

  return (
    <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
      {message}
    </p>
  );
}
