#!/usr/bin/env node
/**
 * Script para remover todos os console.log statements do código
 * Mantém apenas logs usando o logger estruturado
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Padrões de arquivos para processar
const patterns = [
  'app/**/*.{ts,tsx,js,jsx}',
  'lib/**/*.{ts,tsx,js,jsx}',
  'components/**/*.{ts,tsx,js,jsx}',
  'hooks/**/*.{ts,tsx,js,jsx}',
  'contexts/**/*.{ts,tsx,js,jsx}'
];

// Regex para detectar console.log, console.error, console.warn, etc
const consoleRegex = /console\.(log|error|warn|info|debug|trace)\s*\([^)]*\);?/g;

let totalRemoved = 0;
let filesModified = 0;

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Contar quantos console.* existem
  const matches = content.match(consoleRegex);
  if (!matches || matches.length === 0) return;
  
  // Substituir todos os console.* por comentários ou remover
  let newContent = content.replace(consoleRegex, (match) => {
    // Se for um console crítico (error), converter para logger
    if (match.includes('console.error')) {
      return match.replace('console.error', 'logger.error');
    }
    // Se for warning, converter para logger
    if (match.includes('console.warn')) {
      return match.replace('console.warn', 'logger.warn');
    }
    // Remover completamente console.log, info, debug, trace
    return '// Removed console statement';
  });
  
  // Limpar linhas com apenas comentários de remoção
  newContent = newContent.replace(/^\s*\/\/ Removed console statement\s*$/gm, '');
  
  // Adicionar import do logger se necessário e não existir
  if (newContent.includes('logger.') && !newContent.includes("from '@/lib/logger'")) {
    // Adicionar import no topo do arquivo após outros imports
    const importStatement = "import { logger } from '@/lib/logger';\n";
    
    // Encontrar onde inserir (após último import ou no início)
    const lastImportIndex = newContent.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfLine = newContent.indexOf('\n', lastImportIndex);
      newContent = newContent.slice(0, endOfLine + 1) + importStatement + newContent.slice(endOfLine + 1);
    } else {
      newContent = importStatement + newContent;
    }
  }
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    totalRemoved += matches.length;
    filesModified++;
    console.log(`✓ Processado: ${filePath} (${matches.length} removidos)`);
  }
}

console.log('🔍 Iniciando remoção de console.log statements...\n');

patterns.forEach(pattern => {
  const files = glob.sync(pattern, { 
    cwd: path.join(__dirname, '..'),
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**']
  });
  
  files.forEach(processFile);
});

console.log('\n✅ Remoção concluída!');
console.log(`📊 Total removido: ${totalRemoved} statements`);
console.log(`📁 Arquivos modificados: ${filesModified}`);
console.log('\n⚠️  Lembre-se de executar: npm run lint && npm run typecheck');