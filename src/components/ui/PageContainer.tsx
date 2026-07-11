import * as React from "react"
import { cn } from "../../lib/utils"

export const PageContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Animated Background Blobs for all internal pages */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none animate-blob" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[150px] pointer-events-none animate-blob" style={{ animationDelay: '2s' }} />
        
        <div
          ref={ref}
          className={cn("w-full max-w-7xl mx-auto h-full flex flex-col space-y-6 relative z-10", className)}
          {...props}
        >
          {children}
        </div>
      </div>
    )
  }
)
PageContainer.displayName = "PageContainer"
