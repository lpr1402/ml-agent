#!/bin/bash

# Teste de Real-Time SSE
echo "🚀 Testando sistema real-time..."
echo ""

# Gerar ID único da pergunta
QUESTION_ID="TEST-REALTIME-$(date +%s)"

echo "📦 Question ID: $QUESTION_ID"
echo "🔄 Enviando webhook simulado..."

# Enviar webhook simulado
curl -X POST https://gugaleo.axnexlabs.com.br/api/ml-webhook/handler \
  -H "Content-Type: application/json" \
  -H "X-Real-IP: 54.88.218.97" \
  -H "X-Forwarded-For: 54.88.218.97" \
  -d '{
    "_id": "'$(uuidgen)'",
    "topic": "questions",
    "resource": "/questions/'$QUESTION_ID'",
    "user_id": 1377558007,
    "application_id": 8077330788571096,
    "sent": "'$(date -Iseconds)'",
    "received": "'$(date -Iseconds)'"
  }' -s -o /dev/null -w "%{http_code}\n"

echo ""
echo "✅ Webhook enviado!"
echo ""
echo "🔴 AGORA VERIFIQUE A CENTRAL DE ATENDIMENTO:"
echo "   A pergunta deve aparecer SEM precisar recarregar a página!"
echo "   🔗 https://gugaleo.axnexlabs.com.br/agente"
echo ""
echo "   Question ID: $QUESTION_ID"