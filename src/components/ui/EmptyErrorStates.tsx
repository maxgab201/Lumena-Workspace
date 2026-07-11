import * as React from "react"
import { cn } from "../../lib/utils"
import { AlertCircle } from "lucide-react"

export function EmptyState({ title, description, icon, className }: { title: string, description: string, icon?: React.ReactNode, className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
      <div className="mb-4 text-muted-foreground">
        {icon || <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center" />}
      </div>
      <h3 className="text-lg font-heading font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  )
}

export function ErrorState({ title = "An error occurred", message, retry, className }: { title?: string, message: string, retry?: () => void, className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center text-destructive", className)}>
      <AlertCircle className="h-10 w-10 mb-4 opacity-80" />
      <h3 className="text-lg font-heading font-medium">{title}</h3>
      <p className="mt-1 text-sm opacity-80 max-w-sm">{message}</p>
      {retry && (
        <button onClick={retry} className="mt-4 text-sm underline underline-offset-4 font-medium opacity-90 hover:opacity-100">
          Try again
        </button>
      )}
    </div>
  )
}
