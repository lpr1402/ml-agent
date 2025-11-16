import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import LoginClient from "./page-client"

export default async function LoginPage() {
  // Verificar sessão no servidor ANTES de renderizar
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get("ml-agent-session")?.value
  // Removido: explicitLogout não é mais usado após remover auto-login
  // const explicitLogout = cookieStore.get("ml-explicit-logout")?.value

  if (sessionToken) {
    // Verificar se a sessão é válida no banco
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        organization: true
      }
    })

    if (session && session.expiresAt > new Date()) {
      // 🚀 ENTERPRISE FIX: Redirecionar baseado em role
      if (session.organization.role === 'SUPER_ADMIN') {
        redirect("/admin/dashboard") // Admin vai para painel administrativo
      } else {
        redirect("/agente") // Cliente vai para painel normal
      }
    }

    // Sessão expirada - limpar cookie
    if (session) {
      await prisma.session.delete({
        where: { sessionToken }
      }).catch(() => {})
    }
  }

  // AUTO-LOGIN REMOVIDO - Usuários devem fazer login manualmente
  // Conforme solicitado: "jamais deve ser feito autologin"

  // Se chegou aqui, não tem sessão válida nem tokens - mostrar tela de login
  return <LoginClient />
}