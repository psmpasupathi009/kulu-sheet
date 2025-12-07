"use client"

export function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[200px] p-4 sm:p-6">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-sm sm:text-base text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

