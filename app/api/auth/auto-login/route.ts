import { NextResponse } from "next/server"

// AUTO-LOGIN DESABILITADO
// Conforme solicitado: "jamais deve ser feito autologin"
// Usuários devem fazer login manualmente clicando no botão de login

export async function GET() {
  // Redirecionar para página de login
  // Auto-login foi completamente removido do sistema
  return NextResponse.redirect('https://gugaleo.axnexlabs.com.br/login')
}