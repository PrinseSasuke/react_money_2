import React, { useCallback, useContext, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Button, Card, CardContent, Chip, Link, Skeleton, Tooltip, Typography } from "@mui/material";
import QrCodeScannerRounded from "@mui/icons-material/QrCodeScannerRounded";
import { AppContext } from "../App";
import * as receiptsApi from "../services/receipts";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import { formatDateTime, formatMoney } from "../utils/format";
import { RETRYABLE, SOURCE_LABEL, STATUS_LABEL, receiptErrorText } from "../utils/receipts";

const STATUS_COLOR = { parsed: "success", duplicate: "default", error: "error", accepted: "info", processing: "info" };

// Раздел «Чеки»: то же, что история в телефоне — статус каждого чека, ссылка на трату, повтор для ошибок.
export default function ReceiptsPage() {
  const { receiptsVersion, receiptsLive } = useContext(AppContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await receiptsApi.listReceipts();
      setItems(data.items);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // первый показ и каждое событие из потока (новый чек, чек разобран)
  useEffect(() => {
    load();
  }, [load, receiptsVersion]);

  const retry = async (receipt) => {
    setRetrying(receipt.id);
    try {
      await receiptsApi.retryReceipt(receipt.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Чеки"
        subtitle={
          receiptsLive
            ? "Чеки из мобильного приложения. Список и операции обновляются сами"
            : "Чеки из мобильного приложения"
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={76} sx={{ borderRadius: 5 }} />
          ))}
        </div>
      ) : items.length === 0 && !error ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={QrCodeScannerRounded}
              title="Чеков пока нет"
              description="Отсканируйте QR-код кассового чека в приложении «Чеки» — трата появится здесь и в операциях."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((r) => (
            <Card key={r.id}>
              <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {r.amount === null ? "Сумма неизвестна" : formatMoney(r.amount, "RUB")}
                      </Typography>
                      <Chip size="small" label={STATUS_LABEL[r.status] || r.status} color={STATUS_COLOR[r.status] || "default"} />
                      <Chip size="small" variant="outlined" label={SOURCE_LABEL[r.source] || r.source} />
                      {r.category && <Chip size="small" variant="outlined" label={r.category} />}
                    </div>
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
                      {r.purchasedAt ? `Покупка ${formatDateTime(r.purchasedAt)} · ` : ""}отсканирован {formatDateTime(r.createdAt)}
                    </Typography>
                    {r.status === "error" && (
                      <Typography variant="body2" sx={{ mt: 0.5, color: "error.main" }}>
                        {receiptErrorText(r.error?.code)}
                      </Typography>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.transactionId && (
                      <Link component={RouterLink} to={`/transactions/${r.transactionId}`} underline="hover">
                        Открыть трату
                      </Link>
                    )}
                    {r.status === "error" && RETRYABLE.has(r.error?.code) && (
                      <Tooltip title="Отправить чек в обработку ещё раз">
                        <span>
                          <Button size="small" variant="outlined" disabled={retrying === r.id} onClick={() => retry(r)}>
                            Повторить
                          </Button>
                        </span>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
