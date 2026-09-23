import { Chip } from "@mui/material";
import { EXPENSE } from "../../utils/categories";

export default function TypeChip({ type, size = "small" }) {
  const key = type === EXPENSE ? "expense" : "income";
  return (
    <Chip
      size={size}
      label={type}
      sx={{
        bgcolor: (theme) => theme.palette.finance[key].soft,
        color: (theme) => theme.palette.finance[key].text,
      }}
    />
  );
}
