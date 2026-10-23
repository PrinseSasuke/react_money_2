// Russian formats for money and dates (ТЗ: «суммы и даты в формате ru-RU»).
const moneyFmt = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });
const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const shortFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const money = (rub: number) => moneyFmt.format(rub);
export const dateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
export const shortDateTime = (iso: string) => shortFmt.format(new Date(iso));
