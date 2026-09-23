import { useContext } from "react";
import { Typography } from "@mui/material";
import { AppContext } from "../../App";
import { formatMoney, formatSignedMoney } from "../../utils/format";
import { EXPENSE } from "../../utils/categories";
import { hasRate, normalizeCurrency, toRub } from "../../utils/currency";

// showRub: для операций в $/€ показывает под суммой её эквивалент в рублях
// по текущему курсу ЦБ — именно в рублях она учитывается во всех сводках.
export default function AmountText({ summ, type, currency, variant = "subtitle2", sx, showRub = false }) {
  const { rates } = useContext(AppContext);
  const foreign = normalizeCurrency(currency) !== "RUB" && rates && hasRate(currency, rates);

  const amount = (
    <Typography
      variant={variant}
      component="span"
      sx={{
        color: (theme) =>
          type === EXPENSE ? theme.palette.finance.expense.text : theme.palette.finance.income.text,
        fontWeight: 700,
        whiteSpace: "nowrap",
        ...sx,
      }}
    >
      {formatSignedMoney(summ, type, currency)}
    </Typography>
  );

  if (!showRub || !foreign) return amount;

  return (
    <span className="inline-flex flex-col items-end">
      {amount}
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
        ≈ {formatMoney(toRub(summ, currency, rates), "RUB")}
      </Typography>
    </span>
  );
}
