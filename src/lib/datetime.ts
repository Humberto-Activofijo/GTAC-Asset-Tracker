export const APP_TIME_ZONE = "America/Mexico_City";

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: APP_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: APP_TIME_ZONE,
  dateStyle: "medium",
});

/** Fechas se guardan en UTC y se muestran en horario de Ciudad de México. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}
