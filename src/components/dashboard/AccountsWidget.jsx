import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Avatar, Box, Button, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import SectionCard from "../ui/SectionCard";
import EmptyState from "../ui/EmptyState";
import { accountTypeMeta } from "../accounts/accountMeta";
import { formatMoney } from "../../utils/format";

export default function AccountsWidget({ accounts }) {
  return (
    <SectionCard
      title="Мои счета"
      action={
        <Button component={RouterLink} to="/accounts" size="small">
          Управлять
        </Button>
      }
    >
      {accounts.length === 0 ? (
        <EmptyState title="Счетов пока нет" />
      ) : (
        <Box className="flex flex-col" sx={{ "& > * + *": { borderTop: 1, borderColor: "divider" } }}>
          {accounts.map((account) => {
            const meta = accountTypeMeta(account.type);
            const Icon = meta.icon;
            return (
              <div key={account.id} className="flex items-center gap-3 py-3">
                <Avatar
                  variant="rounded"
                  sx={{ width: 36, height: 36, borderRadius: 3, bgcolor: alpha(meta.color, 0.14), color: meta.color }}
                >
                  <Icon fontSize="small" />
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                    {account.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {meta.label} · {account.currency}
                  </Typography>
                </div>
                <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  {formatMoney(account.balance, account.currency)}
                </Typography>
              </div>
            );
          })}
        </Box>
      )}
    </SectionCard>
  );
}
