#!/usr/bin/env node
/**
 * Generate PWA Screenshot Placeholders
 * Creates placeholder screenshots for PWA manifest
 * Production: Replace with actual app screenshots
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'public', 'screenshots');

// Ensure directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const screenshots = [
  {
    name: 'desktop-dashboard.png',
    width: 1920,
    height: 1080,
    text: 'ML Agent\nDashboard de Vendas'
  },
  {
    name: 'desktop-questions.png',
    width: 1920,
    height: 1080,
    text: 'ML Agent\nGerenciamento de Perguntas'
  },
  {
    name: 'mobile-dashboard.png',
    width: 390,
    height: 844,
    text: 'ML Agent\nDashboard Mobile'
  },
  {
    name: 'mobile-notifications.png',
    width: 390,
    height: 844,
    text: 'ML Agent\nNotificações Push'
  }
];

async function generateScreenshot({ name, width, height, text }) {
  const outputPath = path.join(SCREENSHOTS_DIR, name);

  // Create gradient background (black to dark gray)
  const svg = `
    <svg width="${width}" height="${height}">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#000000;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)" />
      <text x="50%" y="40%" font-family="Arial, sans-serif" font-size="${width > 500 ? 64 : 32}" font-weight="bold" fill="#FFD700" text-anchor="middle">ML Agent</text>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${width > 500 ? 48 : 24}" fill="#FFFFFF" text-anchor="middle">${text.split('\n')[1] || ''}</text>
      <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="${width > 500 ? 24 : 16}" fill="#888888" text-anchor="middle">Automação para Mercado Livre</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`✅ Created: ${name} (${width}x${height})`);
}

async function main() {
  console.log('🎨 Generating PWA screenshot placeholders...\n');

  for (const screenshot of screenshots) {
    try {
      await generateScreenshot(screenshot);
    } catch (error) {
      console.error(`❌ Error creating ${screenshot.name}:`, error.message);
    }
  }

  console.log('\n✨ Done! Screenshots created in public/screenshots/');
  console.log('⚠️  IMPORTANT: Replace these placeholders with actual app screenshots for production!');
}

main().catch(console.error);