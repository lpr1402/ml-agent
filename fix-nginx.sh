#!/bin/bash

echo "🔧 Corrigindo configuração do Nginx"

# Remover configuração conflitante
sudo rm -f /etc/nginx/sites-enabled/ml-agent-platform

# Testar configuração
echo "✅ Testando configuração..."
sudo nginx -t

# Recarregar Nginx
echo "🔄 Recarregando Nginx..."
sudo systemctl reload nginx

echo "✨ Pronto! Tente acessar: http://gugaleo.axnexlabs.com.br"