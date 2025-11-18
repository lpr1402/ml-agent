import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, alt = "", src, onError, width, height, ...props }, ref) => {
  const [error, setError] = React.useState(false)

  if (!src || error) return null

  // Convert Blob to string if needed
  const imageSrc = typeof src === 'string' ? src : ''

  return (
    <div ref={ref as any} className={cn("aspect-square h-full w-full", className)}>
      <Image
        src={imageSrc}
        alt={alt}
        width={width as number || 40}
        height={height as number || 40}
        className="h-full w-full object-cover"
        unoptimized
        onError={(e) => {
          setError(true)
          if (onError) {
            onError(e as any)
          }
        }}
        {...props}
      />
    </div>
  )
})
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }