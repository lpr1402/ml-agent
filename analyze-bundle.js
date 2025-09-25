const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Analisando bundle do Next.js...\n');

// Verificar tamanho da pasta .next
function getDirectorySize(dir) {
  let totalSize = 0;
  
  function walkDir(currentPath) {
    if (!fs.existsSync(currentPath)) return;
    
    const files = fs.readdirSync(currentPath);
    
    for (const file of files) {
      const filePath = path.join(currentPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else {
        totalSize += stat.size;
      }
    }
  }
  
  walkDir(dir);
  return totalSize;
}

// Analisar .next directory
const nextDir = path.join(__dirname, '.next');
if (fs.existsSync(nextDir)) {
  const size = getDirectorySize(nextDir);
  console.log(`📦 Tamanho total do .next: ${(size / 1024 / 1024).toFixed(2)} MB\n`);
  
  // Analisar subpastas
  const subdirs = ['server', 'static', 'cache'];
  subdirs.forEach(subdir => {
    const subdirPath = path.join(nextDir, subdir);
    if (fs.existsSync(subdirPath)) {
      const subdirSize = getDirectorySize(subdirPath);
      console.log(`  └─ ${subdir}: ${(subdirSize / 1024 / 1024).toFixed(2)} MB`);
    }
  });
  
  console.log('\n📊 Analisando chunks maiores...\n');
  
  // Encontrar arquivos grandes
  const largeFiles = [];
  
  function findLargeFiles(dir, minSize = 1024 * 1024) { // 1MB+
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        findLargeFiles(filePath, minSize);
      } else if (stat.size > minSize) {
        largeFiles.push({
          path: filePath.replace(__dirname, '.'),
          size: stat.size
        });
      }
    }
  }
  
  findLargeFiles(nextDir);
  
  // Ordenar por tamanho
  largeFiles.sort((a, b) => b.size - a.size);
  
  // Mostrar top 10
  console.log('Top 10 arquivos maiores:');
  largeFiles.slice(0, 10).forEach((file, index) => {
    console.log(`  ${index + 1}. ${file.path} - ${(file.size / 1024 / 1024).toFixed(2)} MB`);
  });
  
  // Análise de dependências em node_modules
  console.log('\n📚 Analisando node_modules...\n');
  
  const nodeModulesDir = path.join(__dirname, 'node_modules');
  const packages = {};
  
  if (fs.existsSync(nodeModulesDir)) {
    const dirs = fs.readdirSync(nodeModulesDir);
    
    dirs.forEach(dir => {
      if (dir.startsWith('.') || dir.startsWith('@')) return;
      
      const pkgPath = path.join(nodeModulesDir, dir);
      if (fs.statSync(pkgPath).isDirectory()) {
        const size = getDirectorySize(pkgPath);
        if (size > 1024 * 1024) { // Apenas pacotes > 1MB
          packages[dir] = size;
        }
      }
    });
    
    // Verificar @scope packages
    const scopeDirs = dirs.filter(d => d.startsWith('@'));
    scopeDirs.forEach(scope => {
      const scopePath = path.join(nodeModulesDir, scope);
      if (fs.statSync(scopePath).isDirectory()) {
        const scopePackages = fs.readdirSync(scopePath);
        scopePackages.forEach(pkg => {
          const pkgPath = path.join(scopePath, pkg);
          const size = getDirectorySize(pkgPath);
          if (size > 1024 * 1024) {
            packages[`${scope}/${pkg}`] = size;
          }
        });
      }
    });
    
    // Ordenar e mostrar top 15
    const sortedPackages = Object.entries(packages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    
    console.log('Top 15 pacotes maiores em node_modules:');
    sortedPackages.forEach(([name, size], index) => {
      console.log(`  ${index + 1}. ${name}: ${(size / 1024 / 1024).toFixed(2)} MB`);
    });
  }
  
  // Sugestões de otimização
  console.log('\n✨ Sugestões de Otimização:\n');
  
  const suggestions = [];
  
  // Verificar Prisma
  if (packages['@prisma/client'] && packages['@prisma/client'] > 10 * 1024 * 1024) {
    suggestions.push('- Prisma Client muito grande. Considere usar output filtering no schema');
  }
  
  // Verificar moment
  if (packages['moment']) {
    suggestions.push('- Moment.js detectado. Migre para date-fns ou dayjs (90% menor)');
  }
  
  // Verificar lodash
  if (packages['lodash']) {
    suggestions.push('- Lodash completo detectado. Use lodash-es com tree shaking');
  }
  
  // Bundle size geral
  const totalSize = getDirectorySize(nextDir);
  if (totalSize > 100 * 1024 * 1024) {
    suggestions.push('- Bundle muito grande (>100MB). Ative code splitting agressivo');
    suggestions.push('- Configure dynamic imports para páginas pesadas');
    suggestions.push('- Implemente lazy loading de componentes');
  }
  
  if (suggestions.length > 0) {
    suggestions.forEach(s => console.log(s));
  } else {
    console.log('✅ Bundle razoavelmente otimizado!');
  }
  
} else {
  console.log('⚠️  Pasta .next não encontrada. Execute "npm run build" primeiro.');
}

console.log('\n📈 Para análise visual detalhada, instale:');
console.log('   npm install --save-dev @next/bundle-analyzer');
console.log('   E configure no next.config.js');