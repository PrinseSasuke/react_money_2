import { CircularProgress } from "@mui/material";

export default function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Загрузка">
      <CircularProgress />
    </div>
  );
}
