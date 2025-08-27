#!/bin/bash

echo "🚀 Configurando Nginx para ML Agent Platform"

# Copiar configuração do Nginx
echo "📝 Copiando configuração do Nginx..."
cp nginx.conf /etc/nginx/sites-available/gugaleo.axnexlabs.com.br

# Criar link simbólico
echo "🔗 Criando link simbólico..."
ln -sf /etc/nginx/sites-available/gugaleo.axnexlabs.com.br /etc/nginx/sites-enabled/

# Remover configuração padrão se existir
echo "🗑️ Removendo configuração padrão..."
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
echo "✅ Testando configuração do Nginx..."
nginx -t

# Recarregar Nginx
echo "🔄 Recarregando Nginx..."
systemctl reload nginx

echo "✨ Nginx configurado com sucesso!"