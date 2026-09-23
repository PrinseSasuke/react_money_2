import { Typography } from "@mui/material";
import { formatSignedMoney } from "../../utils/format";
import { EXPENSE } from "../../utils/categories";

export default function AmountText({ summ, type, currency, variant = "subtitle2", sx }) {
  return (
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
}
