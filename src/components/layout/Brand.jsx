import { Link as RouterLink } from "react-router-dom";
import { Typography } from "@mui/material";

export default function Brand() {
  return (
    <RouterLink to="/" className="flex items-center gap-2.5 no-underline" aria-label="React-Money, на главную">
      <img src="/img/logo.svg" alt="" width={36} height={36} className="block rounded-xl" />
      <Typography
        component="span"
        sx={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.02em", color: "text.primary" }}
      >
        React-Money
      </Typography>
    </RouterLink>
  );
}
