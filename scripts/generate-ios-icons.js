const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const sizes = [
  { size: 120, name: 'icon-120x120.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 180, name: 'icon-180x180.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 1024, name: 'icon-1024x1024.png' }
];

async function generateIcons() {
  const inputPath = path.join(__dirname, '../public/mlagent-logo-3d.png');
  const outputDir = path.join(__dirname, '../public/icons');

  for (const { size, name } of sizes) {
    const outputPath = path.join(outputDir, name);

    await sharp(inputPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 230, b: 0, alpha: 1 } // Yellow background
      })
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated ${name}`);
  }

  console.log('✅ All iOS icons updated with 3D logo!');
}

generateIcons().catch(console.error);