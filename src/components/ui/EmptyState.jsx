import { Typography } from "@mui/material";
import InboxRounded from "@mui/icons-material/InboxRounded";

export default function EmptyState({ title, description, action, icon: Icon = InboxRounded }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <Icon sx={{ fontSize: 40, color: "text.secondary", opacity: 0.6 }} />
      <Typography variant="subtitle1">{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
