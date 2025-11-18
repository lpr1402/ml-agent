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
          "flex items-center space-x-1 text-sm overflow-x-auto scrollbar-hide",
          className
        )}
      >
        <ol className="flex items-center space-x-1 whitespace-nowrap">
          {showHome && (
            <>
              <li>
                <Link
                  href={homeHref}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                    "text-gray-400 hover:text-gold transition-all duration-200",
                    "hover:bg-white/5 group"
                  )}
                >
                  <Home className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              </li>
              {items.length > 0 && (
                <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
              )}
            </>
          )}

          {items.map((item, index) => {
            const isLast = index === items.length - 1
            const isActive = item.active || isLast

            return (
              <React.Fragment key={`${item.label}-${index}`}>
                <li>
                  {item.href && !isActive ? (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                        "text-gray-400 hover:text-gold transition-all duration-200",
                        "hover:bg-white/5 group"
                      )}
                    >
                      {item.icon && (
                        <span className="group-hover:scale-110 transition-transform">
                          {item.icon}
                        </span>
                      )}
                      <span className="truncate max-w-[150px] sm:max-w-[200px]">
                        {item.label}
                      </span>
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                        isActive
                          ? "text-gold bg-gold/5 border border-gold/20 font-medium"
                          : "text-gray-500"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {item.icon && <span>{item.icon}</span>}
                      <span className="truncate max-w-[150px] sm:max-w-[200px]">
                        {item.label}
                      </span>
                    </span>
                  )}
                </li>
                {!isLast && (
                  <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
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
