import React from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Box, Button, ButtonBase, Typography } from "@mui/material";
import SectionCard from "../ui/SectionCard";
import CategoryAvatar from "../ui/CategoryAvatar";
import AmountText from "../ui/AmountText";
import EmptyState from "../ui/EmptyState";
import { formatDateTime } from "../../utils/format";
import { sortByDateDesc } from "../../utils/stats";

export default function RecentTransactions({ transactions, limit = 5 }) {
  const navigate = useNavigate();
  const recent = sortByDateDesc(transactions).slice(0, limit);

  return (
    <SectionCard
      title="Последние операции"
      action={
        <Button component={RouterLink} to="/transactions" size="small">
          Все
        </Button>
      }
    >
      {recent.length === 0 ? (
        <EmptyState title="Операций пока нет" />
      ) : (
        <Box className="flex flex-col" sx={{ "& > * + *": { borderTop: 1, borderColor: "divider" } }}>
          {recent.map((t) => (
            <ButtonBase
              key={t.id}
              onClick={() => navigate(`/transactions/${t.id}`)}
              className="flex w-full items-center gap-3 py-3 text-left"
              sx={{ justifyContent: "flex-start", borderRadius: 2 }}
            >
              <CategoryAvatar source={t.source} size={36} />
              <div className="min-w-0 flex-1">
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {t.description || t.source}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="p">
                  {formatDateTime(t.date)}
                </Typography>
              </div>
              <AmountText summ={t.summ} type={t.type} currency={t.currency} variant="body2" />
            </ButtonBase>
          ))}
        </Box>
      )}
    </SectionCard>
  );
}
