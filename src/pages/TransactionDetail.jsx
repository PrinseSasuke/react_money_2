import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, CardContent, Divider, Skeleton, Typography } from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import * as api from "../services/api";
import { AppContext } from "../App";
import CategoryAvatar from "../components/ui/CategoryAvatar";
import TypeChip from "../components/ui/TypeChip";
import AmountText from "../components/ui/AmountText";
import AttachmentsPanel from "../components/transactions/AttachmentsPanel";
import TransactionDialog from "../components/transactions/TransactionDialog";
import { useTransactionActions } from "../components/transactions/useTransactionActions";
import { currencySymbol, formatDateTime } from "../utils/format";

function DetailRow({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" component="div" sx={{ fontWeight: 500 }}>
        {children}
      </Typography>
    </div>
  );
}

function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { transactions } = useContext(AppContext);
  const [transaction, setTransaction] = useState(null);
  const [loadError, setLoadError] = useState("");
  const { editOpen, openEdit, closeEdit, handleDelete, error } = useTransactionActions({ id });

  useEffect(() => {
    api
      .getTransaction(id)
      .then(setTransaction)
      .catch((err) => setLoadError(err.message));
  }, [id]);

  // После правки в диалоге общий список обновляется — подхватываем изменения.
  useEffect(() => {
    const fresh = transactions.find((t) => t.id === id);
    if (fresh) setTransaction((prev) => (prev ? { ...prev, ...fresh } : prev));
  }, [transactions, id]);

  const onDelete = async () => {
    if (await handleDelete()) navigate("/transactions");
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/transactions")} color="inherit">
          К операциям
        </Button>
      </div>

      {loadError && <Alert severity="error">{loadError}</Alert>}

      <Card>
        <CardContent>
          {!transaction ? (
            <div className="flex flex-col gap-3">
              <Skeleton variant="rounded" height={56} width={56} />
              <Skeleton width="40%" />
              <Skeleton width="25%" />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <CategoryAvatar source={transaction.source} size={56} />
                  <div className="min-w-0">
                    <Typography variant="h5" component="h1" sx={{ overflowWrap: "anywhere" }}>
                      {transaction.description || transaction.source}
                    </Typography>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <TypeChip type={transaction.type} />
                      <Typography variant="body2" color="text.secondary">
                        {formatDateTime(transaction.date)}
                      </Typography>
                    </div>
                  </div>
                </div>
                <AmountText
                  summ={transaction.summ}
                  type={transaction.type}
                  currency={transaction.currency}
                  variant="h5"
                  showRub
                />
              </div>

              <Divider sx={{ my: 3 }} />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <DetailRow label="Категория">{transaction.source}</DetailRow>
                <DetailRow label="Тип">{transaction.type}</DetailRow>
                <DetailRow label="Валюта">
                  {transaction.currency} ({currencySymbol(transaction.currency)})
                </DetailRow>
                <DetailRow label="Источник записи">
                  {transaction.is_auto_generated ? "Регулярный платёж" : "Вручную"}
                </DetailRow>
              </div>

              {error && (
                <Alert severity="error" sx={{ mt: 3 }}>
                  {error}
                </Alert>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="contained" startIcon={<EditRounded />} onClick={openEdit}>
                  Изменить
                </Button>
                <Button variant="outlined" color="error" startIcon={<DeleteOutlineRounded />} onClick={onDelete}>
                  Удалить
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <AttachmentsPanel transactionId={id} />
        </CardContent>
      </Card>

      {editOpen && transaction && (
        <TransactionDialog
          open={editOpen}
          onClose={closeEdit}
          mode="edit"
          initialData={transaction}
          onSaved={(updated) => setTransaction((prev) => ({ ...prev, ...updated }))}
        />
      )}
    </div>
  );
}

export default TransactionDetail;
