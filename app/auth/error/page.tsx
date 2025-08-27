"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Suspense } from "react"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const errorMessages: Record<string, string> = {
    Configuration: "Há um problema com a configuração do servidor. Por favor, verifique as credenciais da aplicação.",
    AccessDenied: "Acesso negado. Você não tem permissão para acessar este recurso.",
    Verification: "O link de verificação expirou ou já foi usado.",
    OAuthSignin: "Erro ao construir a URL de autorização.",
    OAuthCallback: "Erro ao processar a resposta do Mercado Livre.",
    OAuthCreateAccount: "Não foi possível criar a conta de usuário.",
    EmailCreateAccount: "Não foi possível criar a conta de usuário.",
    Callback: "Erro no callback do OAuth.",
    OAuthAccountNotLinked: "Para confirmar sua identidade, faça login com a mesma conta usada originalmente.",
    EmailSignin: "Falha ao enviar o email com o link de login.",
    CredentialsSignin: "Login falhou. Verifique se os detalhes fornecidos estão corretos.",
    SessionRequired: "Por favor, faça login para acessar esta página.",
    Default: "Ocorreu um erro inesperado.",
  }

  const errorMessage = errorMessages[error || "Default"] || errorMessages.Default

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">Erro de Autenticação</CardTitle>
          <CardDescription>
            {error && (
              <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                {error}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            {errorMessage}
          </p>
          
          {error === "Configuration" && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Possíveis causas:</strong>
              </p>
              <ul className="mt-2 text-xs text-yellow-700 dark:text-yellow-300 space-y-1 list-disc pl-5">
                <li>APP_ID ou SECRET incorretos</li>
                <li>URL de callback não configurada corretamente no Mercado Livre</li>
                <li>Variáveis de ambiente não carregadas</li>
              </ul>
            </div>
          )}

          <div className="flex flex-col space-y-2">
            <Button asChild className="w-full">
              <Link href="/login">
                Tentar Novamente
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">
                Voltar ao Início
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFE600]"></div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}