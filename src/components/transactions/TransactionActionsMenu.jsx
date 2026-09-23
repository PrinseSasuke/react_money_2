import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconButton, ListItemIcon, Menu, MenuItem, Snackbar, Alert } from "@mui/material";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import TransactionDialog from "./TransactionDialog";
import { useTransactionActions } from "./useTransactionActions";

export default function TransactionActionsMenu({ transaction }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const { editOpen, openEdit, closeEdit, handleDelete, error } = useTransactionActions(transaction);
  const [showError, setShowError] = useState(false);

  const close = () => setAnchorEl(null);

  return (
    // Двойной клик по строке открывает детали — не даём ему срабатывать
    // от кликов по меню (события из портала всплывают по React-дереву).
    <span onDoubleClick={(e) => e.stopPropagation()}>
      <IconButton
        aria-label="Действия с операцией"
        aria-haspopup="menu"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        size="small"
      >
        <MoreVertRounded fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            close();
            openEdit();
          }}
        >
          <ListItemIcon>
            <EditRounded fontSize="small" />
          </ListItemIcon>
          Изменить
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            navigate(`/transactions/${transaction.id}`);
          }}
        >
          <ListItemIcon>
            <VisibilityRounded fontSize="small" />
          </ListItemIcon>
          Посмотреть
        </MenuItem>
        <MenuItem
          onClick={async () => {
            close();
            const ok = await handleDelete();
            if (!ok) setShowError(true);
          }}
          sx={{ color: (t) => t.palette.finance.expense.text }}
        >
          <ListItemIcon sx={{ color: "inherit" }}>
            <DeleteOutlineRounded fontSize="small" />
          </ListItemIcon>
          Удалить
        </MenuItem>
      </Menu>

      {editOpen && (
        <TransactionDialog open={editOpen} onClose={closeEdit} mode="edit" initialData={transaction} />
      )}

      <Snackbar open={showError} autoHideDuration={5000} onClose={() => setShowError(false)}>
        <Alert severity="error" onClose={() => setShowError(false)}>
          {error || "Не удалось удалить операцию"}
        </Alert>
      </Snackbar>
    </span>
  );
}
