'use client'

import * as React from "react"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

export interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ReactNode
  active?: boolean
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
  showHome?: boolean
  homeHref?: string
}

const Breadcrumbs = React.forwardRef<HTMLElement, BreadcrumbsProps>(
  ({ items, className, showHome = true, homeHref = "/agente" }, ref) => {
    return (
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        className={cn(
          "relative w-full overflow-x-auto scrollbar-hide",
          "[-webkit-overflow-scrolling:touch] [scroll-behavior:smooth]",
          // Scroll indicators profissionais
          "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-8 before:bg-gradient-to-r before:from-black/80 before:to-transparent before:pointer-events-none before:z-10 md:before:hidden",
          "after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-8 after:bg-gradient-to-l after:from-black/80 after:to-transparent after:pointer-events-none after:z-10 md:after:hidden",
          className
        )}
      >
        <ol className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap min-w-min px-3 sm:px-1 py-0.5">
          {showHome && (
            <>
              <li className="flex-shrink-0">
                <Link
                  href={homeHref}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2",
                    "px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg",
                    "text-gray-400 hover:text-gold transition-all duration-200",
                    "hover:bg-white/5 active:scale-95 group",
                    "border border-transparent hover:border-white/5"
                  )}
                >
                  <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform flex-shrink-0" />
                  <span className="hidden sm:inline text-sm font-medium">Dashboard</span>
                </Link>
              </li>
              {items.length > 0 && (
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600/40 sm:text-gray-600/60 flex-shrink-0" />
              )}
            </>
          )}

          {items.map((item, index) => {
            const isLast = index === items.length - 1
            const isActive = item.active || isLast

            return (
              <React.Fragment key={`${item.label}-${index}`}>
                <li className="flex-shrink-0">
                  {item.href && !isActive ? (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-1.5 sm:gap-2",
                        "px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg",
                        "text-gray-400 hover:text-gold transition-all duration-200",
                        "hover:bg-white/5 active:scale-95 group",
                        "text-xs sm:text-sm font-medium",
                        "border border-transparent hover:border-white/5"
                      )}
                    >
                      {item.icon && (
                        <span className="group-hover:scale-110 transition-transform flex-shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5 sm:[&>svg]:w-4 sm:[&>svg]:h-4">
                          {item.icon}
                        </span>
                      )}
                      <span className="truncate max-w-[80px] xs:max-w-[100px] sm:max-w-[160px] md:max-w-[200px] lg:max-w-none">
                        {item.label}
                      </span>
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 sm:gap-2",
                        "px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg",
                        "text-xs sm:text-sm font-medium",
                        isActive
                          ? "text-gold bg-gold/10 border border-gold/30 font-semibold shadow-sm shadow-gold/10"
                          : "text-gray-500 border border-transparent"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {item.icon && (
                        <span className="flex-shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5 sm:[&>svg]:w-4 sm:[&>svg]:h-4">
                          {item.icon}
                        </span>
                      )}
                      <span className="truncate max-w-[80px] xs:max-w-[100px] sm:max-w-[160px] md:max-w-[200px] lg:max-w-none">
                        {item.label}
                      </span>
                    </span>
                  )}
                </li>
                {!isLast && (
                  <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600/40 sm:text-gray-600/60 flex-shrink-0" />
                )}
              </React.Fragment>
            )
          })}
        </ol>
      </nav>
    )
  }
)

Breadcrumbs.displayName = "Breadcrumbs"

export { Breadcrumbs }
