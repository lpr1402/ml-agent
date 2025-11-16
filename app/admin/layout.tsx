/**
 * Admin Layout
 * Layout com autenticação obrigatória para SUPER_ADMIN
 */

import { redirect } from 'next/navigation'
import { isAdminSession } from '@/lib/admin/admin-auth'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { prisma } from '@/lib/prisma'

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {
  // 🚀 ENTERPRISE FIX: Verificar autenticação admin
  const adminSession = await isAdminSession()

  if (!adminSession) {
    // ✅ CRITICAL FIX: Redirecionar para /login (não /api/auth/login que é OAuth ML!)
    redirect('/login')
  }

  // Contar alertas ativos
  const alertCount = await prisma.alert.count({
    where: {
      status: 'ACTIVE',
      type: 'CRITICAL'
    }
  })

  return (
    <div className="flex min-h-screen bg-[#000000]">
      {/* Sidebar */}
      <AdminSidebar
        organizationName={adminSession.organizationName}
        alertCount={alertCount}
      />

      {/* Main Content */}
      <main className="flex-1 ml-64 min-h-screen">
        {/* Background effects */}
        <div className="fixed inset-0 ml-64 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A0A0A] via-[#111111] to-[#000000]" />
          <div className="absolute top-0 left-0 w-full h-full opacity-30">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FFE600]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#FFC700]/5 rounded-full blur-3xl" />
          </div>
        </div>

        {/* Content */}
        <div className="relative">
          {children}
        </div>
      </main>
    </div>
  )
}

// Metadata
export const metadata = {
  title: 'AXNEX Admin | ML Agent',
  description: 'Painel administrativo do ML Agent'
}
