import { Avatar } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { getCategoryMeta } from "../../utils/categories";

export default function CategoryAvatar({ source, size = 40 }) {
  const { icon: Icon, color } = getCategoryMeta(source);
  return (
    <Avatar
      variant="rounded"
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: 3,
        bgcolor: alpha(color, 0.14),
        color,
        flexShrink: 0,
      }}
    >
      <Icon sx={{ fontSize: size * 0.5 }} />
    </Avatar>
  );
}
