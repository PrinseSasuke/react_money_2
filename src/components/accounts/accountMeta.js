import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import SavingsRounded from "@mui/icons-material/SavingsRounded";

export const ACCOUNT_TYPES = {
  cash: { label: "Наличные", icon: PaymentsRounded, color: "#16A34A" },
  card: { label: "Карта", icon: CreditCardRounded, color: "#4E36FC" },
  savings: { label: "Накопительный", icon: SavingsRounded, color: "#F59E0B" },
};

export const ACCOUNT_CURRENCIES = ["RUB", "USD", "EUR"];

export function accountTypeMeta(type) {
  return ACCOUNT_TYPES[type] || ACCOUNT_TYPES.card;
}
