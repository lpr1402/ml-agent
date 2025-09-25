#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files
const files = glob.sync('**/*.{ts,tsx}', {
  ignore: ['node_modules/**', '.next/**', 'dist/**', 'build/**']
});

let totalFixed = 0;

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;

    // Fix all references to error when catch is using _error
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      // If line has catch (_error), _e, or _err
      if (lines[i].match(/catch\s*\((_\w+)\)/)) {
        const catchMatch = lines[i].match(/catch\s*\((_\w+)\)/);
        const varName = catchMatch[1];
        const varWithoutUnderscore = varName.substring(1);
        
        // Look ahead in the next 20 lines for references to the non-underscore version
        for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
          // Skip if it's another catch block
          if (lines[j].match(/catch\s*\(/)) break;
          
          // Replace references to non-underscore version
          // Pattern: word boundary + varWithoutUnderscore + not followed by colon
          const regex = new RegExp(`\\b${varWithoutUnderscore}\\b(?!:)`, 'g');
          
          if (regex.test(lines[j])) {
            lines[j] = lines[j].replace(regex, varName);
          }
        }
      }
    }
    
    content = lines.join('\n');

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`✅ Fixed: ${file}`);
      totalFixed++;
    }
  } catch (e) {
    // Ignore errors
  }
});

console.log(`\n✨ Total fixed: ${totalFixed} files`);
