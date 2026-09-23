import SpaceDashboardRounded from "@mui/icons-material/SpaceDashboardRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import InsightsRounded from "@mui/icons-material/InsightsRounded";
import AutoGraphRounded from "@mui/icons-material/AutoGraphRounded";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import EventRepeatRounded from "@mui/icons-material/EventRepeatRounded";
import SpeedRounded from "@mui/icons-material/SpeedRounded";
import UploadFileRounded from "@mui/icons-material/UploadFileRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";

export const MAIN_NAV = [
  { to: "/", label: "Главная", icon: SpaceDashboardRounded, end: true },
  { to: "/transactions", label: "Операции", icon: ReceiptLongRounded },
  { to: "/stats", label: "Статистика", icon: InsightsRounded },
  { to: "/forecast", label: "Прогноз", icon: AutoGraphRounded },
  { to: "/accounts", label: "Счета", icon: AccountBalanceWalletRounded },
  { to: "/recurring", label: "Регулярные", icon: EventRepeatRounded },
  { to: "/limit", label: "Лимит", icon: SpeedRounded },
  { to: "/import", label: "Импорт", icon: UploadFileRounded },
];

export const SECONDARY_NAV = [{ to: "/settings", label: "Настройки", icon: SettingsRounded }];
