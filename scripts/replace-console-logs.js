#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Arquivos para processar
const patterns = [
  'app/**/*.{ts,tsx}',
  'lib/**/*.{ts,tsx}',
  'components/**/*.{ts,tsx}'
];

// Substituições
const replacements = [
  { from: /console\.log\(/g, to: 'logger.info(' },
  { from: /console\.error\(/g, to: 'logger.error(' },
  { from: /console\.warn\(/g, to: 'logger.warn(' },
  { from: /console\.debug\(/g, to: 'logger.debug(' },
  { from: /console\.info\(/g, to: 'logger.info(' },
  { from: /console\.trace\(/g, to: 'logger.debug(' }
];

let filesProcessed = 0;
let totalReplacements = 0;

patterns.forEach(pattern => {
  const files = glob.sync(pattern, { 
    cwd: '/root/ml-agent',
    absolute: true,
    ignore: ['**/node_modules/**', '**/*.d.ts']
  });

  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    let fileReplacements = 0;

    // Check if file has console statements
    if (!/console\.(log|error|warn|debug|info|trace)/.test(content)) {
      return;
    }

    // Check if logger is already imported
    const hasLoggerImport = /import.*\{.*logger.*\}.*from.*['"].*logger['"]/.test(content);
    
    // Apply replacements
    replacements.forEach(({ from, to }) => {
      const matches = content.match(from);
      if (matches) {
        content = content.replace(from, to);
        modified = true;
        fileReplacements += matches.length;
      }
    });

    if (modified) {
      // Add logger import if not present
      if (!hasLoggerImport && fileReplacements > 0) {
        // Find the right place to add import
        const firstImport = content.match(/^import .* from/m);
        if (firstImport) {
          const importStatement = "import { logger } from '@/lib/logger'\n";
          const insertPosition = content.indexOf(firstImport[0]);
          content = content.slice(0, insertPosition) + importStatement + content.slice(insertPosition);
        }
      }

      fs.writeFileSync(file, content);
      filesProcessed++;
      totalReplacements += fileReplacements;
      console.log(`✓ ${path.relative('/root/ml-agent', file)} - ${fileReplacements} replacements`);
    }
  });
});

console.log(`\n✅ Processed ${filesProcessed} files with ${totalReplacements} total replacements`);