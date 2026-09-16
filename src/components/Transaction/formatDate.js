export function formatDate(date) {
  if (!date) return "Некорректная дата";

  const dateObj = new Date(date);

  if (isNaN(dateObj)) return "Некорректная дата";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(dateObj);
}
