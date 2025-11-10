import { Skeleton } from "@/components/ui/skeleton";

export function FeedPostSkeleton() {
  return (
    <div className="bg-card border-b border-border pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      {/* Image */}
      <Skeleton className="w-full h-80" />

      {/* Actions */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-4 mb-3">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
