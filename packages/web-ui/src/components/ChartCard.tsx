import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./Card.js";
import { EmptyState, LoadingSpinner } from "./StateViews.js";

export interface ChartCardProps {
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
  loading?: boolean | undefined;
  empty?: boolean | undefined;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}

export function ChartCard({
  title,
  description,
  action,
  loading = false,
  empty = false,
  emptyTitle = "Not enough data yet",
  emptyDescription = "Data will appear here once transactions are recorded.",
  children,
  className,
}: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSpinner label="Loading chart..." className="py-8" />
        ) : empty ? (
          <EmptyState title={emptyTitle} description={emptyDescription} className="py-8" />
        ) : (
          <div className="w-full">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
