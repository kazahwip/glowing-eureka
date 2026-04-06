const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
});

export function formatDate(date: string | Date) {
  return dateFormatter.format(new Date(date));
}

export function formatDateTime(date: string | Date) {
  return dateTimeFormatter.format(new Date(date));
}

export function daysBetween(startDate: string | Date, endDate = new Date()) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}
