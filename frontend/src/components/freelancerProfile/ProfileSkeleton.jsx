export default function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="card overflow-hidden">
        <div className="skeleton h-24" />
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
          <div className="skeleton h-20 w-20 shrink-0 rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="skeleton h-5 w-48 rounded" />
            <div className="skeleton h-4 w-72 max-w-full rounded" />
            <div className="skeleton h-3 w-40 rounded" />
          </div>
          <div className="space-y-2">
            <div className="skeleton h-10 w-32 rounded-lg" />
            <div className="skeleton h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-12 lg:items-start">
        <div className="space-y-5 lg:col-span-8">
          <div className="card h-44" />
          <div className="card h-56" />
          <div className="card h-48" />
        </div>
        <div className="space-y-5 lg:col-span-4">
          <div className="card h-48" />
          <div className="card h-64" />
        </div>
      </div>
    </div>
  );
}
