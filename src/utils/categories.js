import ShoppingCartRounded from "@mui/icons-material/ShoppingCartRounded";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";
import FastfoodRounded from "@mui/icons-material/FastfoodRounded";
import CheckroomRounded from "@mui/icons-material/CheckroomRounded";
import PhoneIphoneRounded from "@mui/icons-material/PhoneIphoneRounded";
import LocalPharmacyRounded from "@mui/icons-material/LocalPharmacyRounded";
import DirectionsBusRounded from "@mui/icons-material/DirectionsBusRounded";
import CategoryRounded from "@mui/icons-material/CategoryRounded";
import WorkRounded from "@mui/icons-material/WorkRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import AccountBalanceRounded from "@mui/icons-material/AccountBalanceRounded";

export const INCOME = "Доход";
export const EXPENSE = "Расход";

export const CATEGORIES = {
  [EXPENSE]: [
    "Супермаркеты",
    "Переводы",
    "Фастфуд",
    "Одежда и обувь",
    "Мобильная связь",
    "Аптеки",
    "Транспорт",
    "Остальное",
  ],
  [INCOME]: ["Зарплата", "Доп. зарабаток", "Соц. выплата", "Остальное"],
};

const CATEGORY_META = {
  Супермаркеты: { icon: ShoppingCartRounded, color: "#F59E0B" },
  Переводы: { icon: SwapHorizRounded, color: "#3B82F6" },
  Фастфуд: { icon: FastfoodRounded, color: "#F97316" },
  "Одежда и обувь": { icon: CheckroomRounded, color: "#A855F7" },
  "Мобильная связь": { icon: PhoneIphoneRounded, color: "#06B6D4" },
  Аптеки: { icon: LocalPharmacyRounded, color: "#EC4899" },
  Транспорт: { icon: DirectionsBusRounded, color: "#14B8A6" },
  Зарплата: { icon: WorkRounded, color: "#22C55E" },
  "Доп. зарабаток": { icon: TrendingUpRounded, color: "#84CC16" },
  "Соц. выплата": { icon: AccountBalanceRounded, color: "#0EA5E9" },
};

const FALLBACK = { icon: CategoryRounded, color: "#8B7DFF" };

export function getCategoryMeta(source) {
  return CATEGORY_META[source] || FALLBACK;
}

// Палитры для донат-графиков — те же цвета, что у иконок категорий.
export function categoryColor(source) {
  return getCategoryMeta(source).color;
}
