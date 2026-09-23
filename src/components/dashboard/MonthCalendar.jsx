import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, ButtonBase, IconButton, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import SectionCard from "../ui/SectionCard";
import { formatCompact, formatNumber, toDayKey } from "../../utils/format";
import { EXPENSE } from "../../utils/categories";
import { amountRub } from "../../utils/currency";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const monthTitle = (date) => {
  const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1).replace(" г.", "");
};

// Сетка месяца с понедельника: пустые ячейки до 1-го числа + дни месяца.
function buildCells(month) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const offset = (new Date(year, m, 1).getDay() + 6) % 7;
  const days = new Date(year, m + 1, 0).getDate();
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(year, m, i + 1)),
  ];
}

function DayCell({ date, net, isToday, onOpen, compact }) {
  const hasOps = net !== undefined;
  const isExpense = hasOps && net < 0;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const sign = net > 0 ? "+" : net < 0 ? "−" : "";

  const content = (
    <>
      <Typography
        variant="caption"
        sx={{ fontWeight: isToday ? 700 : 500, color: isToday ? "primary.main" : "text.secondary", lineHeight: 1.2 }}
      >
        {compact ? date.getDate() : `${dd}.${mm}`}
      </Typography>
      {hasOps && (
        <Typography
          variant="caption"
          noWrap
          sx={{
            width: "100%",
            fontWeight: 700,
            fontSize: { xs: "0.625rem", sm: "0.75rem" },
            letterSpacing: { xs: "-0.02em", sm: 0 },
            color: (t) => (isExpense ? t.palette.finance.expense.text : t.palette.finance.income.text),
          }}
        >
          {sign}
          {compact ? formatCompact(net) : formatNumber(Math.abs(net))}
        </Typography>
      )}
    </>
  );

  const baseSx = {
    width: "100%",
    minHeight: { xs: 48, sm: 64 },
    borderRadius: 2.5,
    p: { xs: 0.5, sm: 1 },
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 0.5,
    overflow: "hidden",
    border: 1,
    borderColor: isToday ? "primary.main" : "divider",
  };

  if (!hasOps) return <Box sx={baseSx}>{content}</Box>;

  return (
    <Tooltip title={`Итого за ${dd}.${mm}: ${net > 0 ? "+" : ""}${formatNumber(net)}`}>
      <ButtonBase
        onClick={onOpen}
        aria-label={`Операции за ${dd}.${mm}`}
        sx={{
          ...baseSx,
          bgcolor: (t) => (isExpense ? t.palette.finance.expense.soft : t.palette.finance.income.soft),
          borderColor: (t) =>
            isToday ? t.palette.primary.main : alpha(isExpense ? t.palette.finance.expense.main : t.palette.finance.income.main, 0.35),
          transition: "transform .15s ease, box-shadow .15s ease",
          "&:hover": { transform: "translateY(-1px)", boxShadow: 2 },
        }}
      >
        {content}
      </ButtonBase>
    </Tooltip>
  );
}

export default function MonthCalendar({ transactions, rates }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Чистая сумма за день (доходы − расходы), считается один раз на весь месяц.
  const netByDay = useMemo(() => {
    const map = new Map();
    transactions.forEach((t) => {
      const key = toDayKey(t.date);
      const amount = amountRub(t, rates);
      map.set(key, (map.get(key) || 0) + (t.type === EXPENSE ? -amount : amount));
    });
    return map;
  }, [transactions, rates]);

  const cells = useMemo(() => buildCells(month), [month]);
  const todayKey = toDayKey(new Date());
  const shift = (delta) => setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  return (
    <SectionCard
      title="Календарь операций"
      subtitle="Нажмите на день, чтобы увидеть операции"
      action={
        <div className="flex items-center gap-1">
          <IconButton size="small" onClick={() => shift(-1)} aria-label="Предыдущий месяц">
            <ChevronLeftRounded />
          </IconButton>
          <Typography variant="subtitle2" sx={{ minWidth: { xs: 110, sm: 130 }, textAlign: "center" }}>
            {monthTitle(month)}
          </Typography>
          <IconButton size="small" onClick={() => shift(1)} aria-label="Следующий месяц">
            <ChevronRightRounded />
          </IconButton>
        </div>
      }
    >
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {WEEKDAYS.map((d) => (
          <Typography key={d} variant="caption" color="text.secondary" sx={{ textAlign: "center", fontWeight: 600 }}>
            {d}
          </Typography>
        ))}
        {cells.map((date, index) =>
          date ? (
            <DayCell
              key={toDayKey(date)}
              date={date}
              net={netByDay.get(toDayKey(date))}
              isToday={toDayKey(date) === todayKey}
              compact={compact}
              onOpen={() => navigate(`/transactions/date/${toDayKey(date)}`)}
            />
          ) : (
            <div key={`empty-${index}`} aria-hidden />
          )
        )}
      </div>
    </SectionCard>
  );
}
