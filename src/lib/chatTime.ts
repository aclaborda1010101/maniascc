// Helpers de fecha/hora para el chat de AVA. Todo en es-ES.

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isSameDay(a: number | Date, b: number | Date): boolean {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}

/** "18:42" */
export function formatMessageTime(ts: number | Date): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/** "7 jul 2026, 18:42" */
export function formatMessageTooltip(ts: number | Date): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${formatMessageTime(d)}`;
}

/** "Hoy" / "Ayer" / "lunes, 3 de julio de 2026" */
export function formatDaySeparator(ts: number | Date): string {
  const d = new Date(ts);
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  const weekday = d.toLocaleDateString("es-ES", { weekday: "long" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`;
}

/** "ahora" · "hace 5 min" · "hace 2 h" · "ayer" · "3 jul" · "3 jul 2024" */
export function formatRelativeShort(ts: number | Date): string {
  const d = new Date(ts);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24 && isSameDay(d, now)) return `hace ${diffH} h`;
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (isSameDay(d, yest)) return "ayer";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return sameYear
    ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
    : `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
