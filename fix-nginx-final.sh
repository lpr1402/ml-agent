#!/bin/bash

echo "🔧 Corrigindo configuração final do Nginx"

# Copiar nova configuração
echo "📝 Copiando configuração corrigida..."
sudo cp /mnt/c/Users/ti/Documents/ml-agent-platform/nginx.conf /etc/nginx/sites-available/gugaleo.axnexlabs.com.br

# Testar configuração
echo "✅ Testando configuração..."
sudo nginx -t

# Recarregar Nginx
echo "🔄 Recarregando Nginx..."
sudo systemctl reload nginx

echo "✨ Pronto!"
echo ""
echo "🌐 Acesse: http://gugaleo.axnexlabs.com.br"
echo ""
echo "📌 IMPORTANTE: Configure o DNS para apontar para seu IP público:"
echo "   IP Público: 187.101.62.32"
echo ""