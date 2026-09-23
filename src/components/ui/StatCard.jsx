import { Avatar, Card, CardContent, Chip, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import { formatPercent } from "../../utils/format";

// Карточка-виджет сводки. highlighted — акцентная (залитая) карточка, как
// первый виджет в дашборде. positiveIsGood=false для расходов: их рост — плохо.
export default function StatCard({
  label,
  value,
  icon: Icon,
  change,
  changeLabel = "к прошлому периоду",
  highlighted = false,
  positiveIsGood = true,
  className = "",
}) {
  const theme = useTheme();
  const hasChange = change !== undefined;
  const isUp = change > 0;
  const good = change === 0 || change === null ? null : isUp === positiveIsGood;

  const onAccent = "#FFFFFF";
  const chipColor = highlighted
    ? onAccent
    : good === null
      ? theme.palette.text.secondary
      : good
        ? theme.palette.finance.income.text
        : theme.palette.finance.expense.text;
  const chipBg = highlighted
    ? alpha("#FFFFFF", 0.18)
    : good === null
      ? theme.palette.action.hover
      : good
        ? theme.palette.finance.income.soft
        : theme.palette.finance.expense.soft;

  return (
    <Card
      className={className}
      sx={
        highlighted
          ? {
              color: onAccent,
              border: "none",
              background: `linear-gradient(135deg, ${theme.palette.mode === "dark" ? "#5B47FF" : "#4E36FC"} 0%, #2A1B9E 100%)`,
            }
          : undefined
      }
    >
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <Typography
            variant="body2"
            sx={{ color: highlighted ? alpha(onAccent, 0.85) : "text.secondary", fontWeight: 500 }}
          >
            {label}
          </Typography>
          {Icon && (
            <Avatar
              variant="rounded"
              sx={{
                width: 40,
                height: 40,
                borderRadius: 3,
                bgcolor: highlighted ? alpha("#FFFFFF", 0.16) : alpha(theme.palette.primary.main, 0.1),
                color: highlighted ? onAccent : "primary.main",
              }}
            >
              <Icon fontSize="small" />
            </Avatar>
          )}
        </div>
        <Typography
          component="p"
          sx={{
            mt: 1.5,
            fontSize: { xs: "1.5rem", sm: "1.75rem" },
            fontWeight: 700,
            letterSpacing: "-0.02em",
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </Typography>
        {hasChange && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip
              size="small"
              icon={
                change > 0 ? (
                  <ArrowUpwardRounded />
                ) : change < 0 ? (
                  <ArrowDownwardRounded />
                ) : undefined
              }
              label={formatPercent(change)}
              sx={{
                height: 24,
                bgcolor: chipBg,
                color: chipColor,
                "& .MuiChip-icon": { color: "inherit", fontSize: 16 },
              }}
            />
            <Typography
              variant="caption"
              sx={{ color: highlighted ? alpha(onAccent, 0.85) : "text.secondary" }}
            >
              {changeLabel}
            </Typography>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
