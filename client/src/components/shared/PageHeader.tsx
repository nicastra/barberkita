import { Badge } from '@/components/ui/badge';

export function PageHeader() {
  return (
    <div className="space-y-4">
      <Badge variant="outline">Foundation workspace</Badge>
      <div className="max-w-2xl space-y-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          A calm start for every day at the shop.
        </h1>
        <p className="text-muted-foreground text-base leading-7 sm:text-lg">
          CukurPro is being built as one reliable place for appointments, daily
          operations, checkout, and shop insights.
        </p>
      </div>
    </div>
  );
}
