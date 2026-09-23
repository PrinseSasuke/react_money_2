import { Card, CardContent, Typography } from "@mui/material";

export default function SectionCard({ title, subtitle, action, children, contentSx, sx }) {
  return (
    <Card sx={{ height: "100%", ...sx }}>
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", ...contentSx }}>
        {(title || action) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && (
                <Typography variant="h6" component="h2">
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </div>
            {action}
          </div>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </CardContent>
    </Card>
  );
}
