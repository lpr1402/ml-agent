#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n========================================');
console.log('CONFIGURAÇÃO DO MCP MERCADO LIVRE PARA CLAUDE CODE');
console.log('========================================\n');

// Procurar pelo token mais recente nos logs do PM2
console.log('Buscando access token nos logs...\n');

try {
  // Buscar nos logs do PM2
  const logs = execSync('pm2 logs ml-agent-platform --lines 500 --nostream 2>/dev/null || true', { encoding: 'utf-8' });
  
  // Procurar pelo padrão ACCESS_TOKEN
  const tokenMatch = logs.match(/ACCESS_TOKEN:\s*(APP_USR-[\w-]+)/);
  
  if (!tokenMatch) {
    console.error('❌ Não foi possível encontrar o access token nos logs.');
    console.error('Por favor, faça login no sistema primeiro e tente novamente.\n');
    process.exit(1);
  }
  
  const accessToken = tokenMatch[1];
  console.log('✅ Access Token encontrado:', accessToken);
  console.log('\n========================================');
  console.log('CONFIGURANDO CLAUDE CODE...');
  console.log('========================================\n');
  
  // Remover configuração anterior se existir
  try {
    console.log('Removendo configuração anterior...');
    execSync('claude mcp remove mercadolibre 2>/dev/null', { stdio: 'ignore' });
  } catch (e) {
    // Ignorar erro se não existir
  }
  
  // Adicionar nova configuração usando npx mcp-remote
  console.log('Adicionando servidor MCP do Mercado Livre...\n');
  
  const command = `claude mcp add mercadolibre "npx -y mcp-remote https://mcp.mercadolibre.com/mcp --header 'Authorization:Bearer ${accessToken}'"`;
  
  try {
    execSync(command, { stdio: 'inherit' });
    console.log('\n✅ Servidor MCP configurado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao configurar MCP:', error.message);
    process.exit(1);
  }
  
  // Verificar status
  console.log('\n========================================');
  console.log('VERIFICANDO CONEXÃO...');
  console.log('========================================\n');
  
  execSync('claude mcp list', { stdio: 'inherit' });
  
  console.log('\n========================================');
  console.log('CONFIGURAÇÃO CONCLUÍDA!');
  console.log('========================================');
  console.log('\nO MCP do Mercado Livre foi configurado no Claude Code.');
  console.log('Se a conexão aparecer como "Failed", pode ser necessário:');
  console.log('1. Reiniciar o Claude Code');
  console.log('2. Verificar se o token está válido');
  console.log('3. Fazer login novamente no sistema\n');
  
} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}