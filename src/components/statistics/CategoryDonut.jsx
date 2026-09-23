import React, { useMemo } from "react";
import { PieChart } from "@mui/x-charts/PieChart";
import { Box, Typography } from "@mui/material";
import SectionCard from "../ui/SectionCard";
import EmptyState from "../ui/EmptyState";
import { CATEGORIES, categoryColor } from "../../utils/categories";
import { formatMoney } from "../../utils/format";
import { amountRub } from "../../utils/currency";

export default function CategoryDonut({ title, transactions, type, rates }) {
  const { data, total } = useMemo(() => {
    const grouped = {};
    transactions
      .filter((t) => t.type === type)
      .forEach((t) => {
        const category = CATEGORIES[type].includes(t.source) ? t.source : "Остальное";
        grouped[category] = (grouped[category] || 0) + amountRub(t, rates);
      });
    const items = Object.entries(grouped)
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ id: label, label, value, color: categoryColor(label) }));
    return { data: items, total: items.reduce((acc, i) => acc + i.value, 0) };
  }, [transactions, type, rates]);

  return (
    <SectionCard title={title}>
      {data.length === 0 ? (
        <EmptyState title="Нет данных за период" />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Box sx={{ position: "relative", width: 200, height: 200, flexShrink: 0 }}>
            <PieChart
              width={200}
              height={200}
              hideLegend
              margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
              series={[
                {
                  data,
                  innerRadius: 62,
                  outerRadius: 96,
                  paddingAngle: 2,
                  cornerRadius: 6,
                  valueFormatter: (item) => formatMoney(item.value, "RUB"),
                },
              ]}
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <Typography variant="caption" color="text.secondary">
                Всего
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {formatMoney(total, "RUB")}
              </Typography>
            </div>
          </Box>
          <ul className="m-0 flex w-full min-w-0 list-none flex-col gap-2 p-0">
            {data.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: item.color }} />
                <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                  {item.label}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  {Math.round((item.value / total) * 100)}%
                </Typography>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
