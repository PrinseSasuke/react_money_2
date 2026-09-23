import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import EventRepeatRounded from "@mui/icons-material/EventRepeatRounded";
import AttachFileRounded from "@mui/icons-material/AttachFileRounded";
import CategoryAvatar from "../ui/CategoryAvatar";
import TypeChip from "../ui/TypeChip";
import AmountText from "../ui/AmountText";
import EmptyState from "../ui/EmptyState";
import TransactionActionsMenu from "./TransactionActionsMenu";
import { formatDateTime } from "../../utils/format";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function Badges({ transaction }) {
  return (
    <>
      {transaction.is_auto_generated && (
        <Tooltip title="Создано автоматически (регулярный платёж)">
          <EventRepeatRounded sx={{ fontSize: 16, color: "text.secondary" }} aria-label="Регулярный платёж" />
        </Tooltip>
      )}
      {transaction.attachment_count > 0 && (
        <Tooltip title="Есть вложение">
          <AttachFileRounded sx={{ fontSize: 16, color: "text.secondary" }} aria-label="Есть вложение" />
        </Tooltip>
      )}
    </>
  );
}

function Title({ transaction }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <CategoryAvatar source={transaction.source} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Typography variant="subtitle2" noWrap component="span" sx={{ minWidth: 0 }}>
            {transaction.description || transaction.source}
          </Typography>
          <Badges transaction={transaction} />
        </div>
        <Typography variant="caption" color="text.secondary" noWrap component="p">
          {transaction.source}
        </Typography>
      </div>
    </div>
  );
}

function DesktopTable({ rows, readOnly, onOpen }) {
  return (
    <TableContainer>
      <Table sx={{ minWidth: 640 }}>
        <TableHead>
          <TableRow>
            <TableCell>Операция</TableCell>
            <TableCell>Тип</TableCell>
            <TableCell>Дата</TableCell>
            <TableCell align="right">Сумма</TableCell>
            {!readOnly && <TableCell align="right" sx={{ width: 56 }}><span className="sr-only">Действия</span></TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((t, index) => (
            <TableRow
              key={t.id || index}
              hover={!readOnly}
              data-testid="transaction-item"
              onDoubleClick={readOnly ? undefined : () => onOpen(t)}
              sx={{ cursor: readOnly ? "default" : "pointer", "&:last-child td": { borderBottom: 0 } }}
            >
              <TableCell sx={{ maxWidth: 360, py: 1.5 }}>
                <Title transaction={t} />
              </TableCell>
              <TableCell>
                <TypeChip type={t.type} />
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>{formatDateTime(t.date)}</TableCell>
              <TableCell align="right">
                <AmountText summ={t.summ} type={t.type} currency={t.currency} showRub />
              </TableCell>
              {!readOnly && (
                <TableCell align="right">
                  <TransactionActionsMenu transaction={t} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function MobileList({ rows, readOnly, onOpen }) {
  return (
    <Box
      className="flex flex-col"
      sx={{ "& > * + *": { borderTop: 1, borderColor: "divider" } }}
    >
      {rows.map((t, index) => (
        <div
          key={t.id || index}
          data-testid="transaction-item"
          className="flex items-center gap-3 py-3"
          onDoubleClick={readOnly ? undefined : () => onOpen(t)}
        >
          <div className="min-w-0 flex-1">
            <Title transaction={t} />
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5, pl: "52px" }}>
              {formatDateTime(t.date)}
            </Typography>
          </div>
          <div className="flex flex-col items-end gap-1">
            <AmountText summ={t.summ} type={t.type} currency={t.currency} showRub />
            {!readOnly && <TransactionActionsMenu transaction={t} />}
          </div>
        </div>
      ))}
    </Box>
  );
}

export default function TransactionsTable({ transactions, readOnly = false, emptyState }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Если после фильтрации страниц стало меньше — показываем последнюю, а не пустую.
  const lastPage = Math.max(0, Math.ceil(transactions.length / rowsPerPage) - 1);
  const currentPage = Math.min(page, lastPage);
  const rows = transactions.slice(currentPage * rowsPerPage, currentPage * rowsPerPage + rowsPerPage);
  const openDetail = (t) => t.id && navigate(`/transactions/${t.id}`);

  return (
    <Card>
      {transactions.length === 0 ? (
        <CardContent>{emptyState || <EmptyState title="Операций пока нет" />}</CardContent>
      ) : (
        <>
          <CardContent sx={{ p: isMobile ? 2 : 0, "&:last-child": { pb: isMobile ? 1 : 0 } }}>
            {isMobile ? (
              <MobileList rows={rows} readOnly={readOnly} onOpen={openDetail} />
            ) : (
              <DesktopTable rows={rows} readOnly={readOnly} onOpen={openDetail} />
            )}
          </CardContent>
          <TablePagination
            component="div"
            count={transactions.length}
            page={currentPage}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={PAGE_SIZE_OPTIONS}
            labelRowsPerPage={isMobile ? "На странице:" : "Показывать по:"}
            sx={{ borderTop: 1, borderColor: "divider" }}
          />
        </>
      )}
    </Card>
  );
}
