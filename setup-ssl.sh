#!/bin/bash

echo "🔒 Configurando SSL com Certbot para gugaleo.axnexlabs.com.br"

# Instalar Certbot
echo "📦 Instalando Certbot..."
apt update
apt install -y certbot python3-certbot-nginx

# Obter certificado SSL
echo "🔐 Obtendo certificado SSL..."
certbot --nginx -d gugaleo.axnexlabs.com.br \
  --non-interactive \
  --agree-tos \
  --email nandoroliveira@gmail.com \
  --redirect

# Configurar renovação automática
echo "🔄 Configurando renovação automática..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

echo "✅ SSL configurado com sucesso!"