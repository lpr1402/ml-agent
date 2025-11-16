/**
 * Admin Sidebar Navigation
 * Menu lateral premium com cores preto/dourado
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  AlertTriangle,
  BarChart3,
  FileText,
  Webhook,
  Settings,
  LogOut,
  ChevronRight,
  Crown
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
}

interface AdminSidebarProps {
  organizationName: string
  alertCount?: number
}

export function AdminSidebar({ organizationName, alertCount = 0 }: AdminSidebarProps) {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/admin/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />
    },
    {
      label: 'Organizações',
      href: '/admin/organizations',
      icon: <Building2 className="w-5 h-5" />
    },
    {
      label: 'Alertas',
      href: '/admin/alerts',
      icon: <AlertTriangle className="w-5 h-5" />,
      badge: alertCount
    },
    {
      label: 'Métricas',
      href: '/admin/metrics',
      icon: <BarChart3 className="w-5 h-5" />
    },
    {
      label: 'Logs',
      href: '/admin/logs',
      icon: <FileText className="w-5 h-5" />
    },
    {
      label: 'Webhooks',
      href: '/admin/webhooks',
      icon: <Webhook className="w-5 h-5" />
    },
    {
      label: 'Sistema',
      href: '/admin/system',
      icon: <Settings className="w-5 h-5" />
    }
  ]

  const isActive = (href: string) => {
    if (href === '/admin/dashboard') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <aside className="
      fixed left-0 top-0 bottom-0
      w-64
      bg-gradient-to-b from-[#0A0A0A] to-[#000000]
      border-r border-[#FFE600]/10
      flex flex-col
      z-50
    ">
      {/* Header */}
      <div className="p-6 border-b border-[#FFE600]/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-[#FFE600] to-[#FFC700]">
            <Crown className="w-5 h-5 text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-[#FFE600] tracking-wide">
              SUPER ADMIN
            </h2>
            <p className="text-xs text-white/60 truncate">
              {organizationName}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-all duration-200
                ${active
                  ? 'bg-[#FFE600]/10 text-[#FFE600] font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }
              `}
            >
              {/* Active indicator */}
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#FFE600] rounded-r-full" />
              )}

              {/* Icon */}
              <div className={`
                transition-transform duration-200
                ${active ? 'scale-110' : 'group-hover:scale-105'}
              `}>
                {item.icon}
              </div>

              {/* Label */}
              <span className="flex-1 text-sm">
                {item.label}
              </span>

              {/* Badge */}
              {item.badge && item.badge > 0 && (
                <span className="
                  px-2 py-0.5 text-[10px] font-bold
                  bg-red-500 text-white
                  rounded-full
                  animate-pulse
                ">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}

              {/* Chevron on hover */}
              <ChevronRight className={`
                w-4 h-4 transition-all duration-200
                ${active
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-2 group-hover:opacity-50 group-hover:translate-x-0'
                }
              `} />
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#FFE600]/10">
        <Link
          href="/api/auth/logout"
          className="
            flex items-center gap-3 px-3 py-2.5 rounded-lg
            text-white/60 hover:text-red-400 hover:bg-red-500/5
            transition-all duration-200
            group
          "
        >
          <LogOut className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span className="flex-1 text-sm">
            Sair
          </span>
        </Link>
      </div>
    </aside>
  )
}
