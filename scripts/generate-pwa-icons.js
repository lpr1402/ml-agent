#!/usr/bin/env node

/**
 * Gerador de ícones PWA para iOS/Android
 * Cria todos os tamanhos necessários a partir do logo principal
 */

const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Tamanhos necessários para PWA (iOS e Android)
const sizes = [
  72, 96, 120, 128, 144, 152, 180, 192, 384, 512, 1024
];

// Tamanhos para splash screens iOS
const splashSizes = [
  { width: 640, height: 1136, name: 'splash-640x1136.png' },   // iPhone 5
  { width: 750, height: 1334, name: 'splash-750x1334.png' },   // iPhone 6/7/8
  { width: 828, height: 1792, name: 'splash-828x1792.png' },   // iPhone 11/XR
  { width: 1125, height: 2436, name: 'splash-1125x2436.png' }, // iPhone X/XS/11 Pro
  { width: 1170, height: 2532, name: 'splash-1170x2532.png' }, // iPhone 12/13/14 Pro
  { width: 1179, height: 2556, name: 'splash-1179x2556.png' }, // iPhone 14 Pro Max
  { width: 1242, height: 2208, name: 'splash-1242x2208.png' }, // iPhone 6/7/8 Plus
  { width: 1242, height: 2688, name: 'splash-1242x2688.png' }, // iPhone XS Max
  { width: 1284, height: 2778, name: 'splash-1284x2778.png' }, // iPhone 12/13/14 Pro Max
  { width: 1290, height: 2796, name: 'splash-1290x2796.png' }, // iPhone 15 Pro Max
  { width: 1536, height: 2048, name: 'splash-1536x2048.png' }, // iPad
  { width: 1668, height: 2224, name: 'splash-1668x2224.png' }, // iPad Pro 10.5"
  { width: 1668, height: 2388, name: 'splash-1668x2388.png' }, // iPad Pro 11"
  { width: 2048, height: 2732, name: 'splash-2048x2732.png' }, // iPad Pro 12.9"
];

async function generateIcons() {
  try {
    // Usar o logo PNG existente como fonte
    const sourcePath = path.join(__dirname, '../public/ml-agent-icon.png');
    const iconsDir = path.join(__dirname, '../public/icons');

    console.log('🎨 Gerando ícones PWA...');

    // Verificar se o arquivo fonte existe
    await fs.access(sourcePath);

    // Gerar ícones quadrados
    for (const size of sizes) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);

      await sharp(sourcePath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 230, b: 0, alpha: 1 } // Amarelo ML
        })
        .png({
          compressionLevel: 9,
          quality: 100
        })
        .toFile(outputPath);

      console.log(`✅ Gerado: icon-${size}x${size}.png`);
    }

    // Gerar ícones para shortcuts
    const shortcutIcons = [
      { name: 'questions.png', color: { r: 52, g: 211, b: 153 } }, // Verde
      { name: 'dashboard.png', color: { r: 59, g: 130, b: 246 } }, // Azul
      { name: 'accounts.png', color: { r: 251, g: 146, b: 60 } }   // Laranja
    ];

    for (const icon of shortcutIcons) {
      const outputPath = path.join(iconsDir, 'shortcuts', icon.name);

      await sharp(sourcePath)
        .resize(96, 96)
        .flatten({ background: icon.color })
        .png()
        .toFile(outputPath);

      console.log(`✅ Gerado shortcut: ${icon.name}`);
    }

    // Gerar apple-touch-icon principal
    await sharp(sourcePath)
      .resize(180, 180)
      .png()
      .toFile(path.join(__dirname, '../public/apple-touch-icon.png'));
    console.log('✅ Gerado: apple-touch-icon.png');

    // Gerar favicon.ico com múltiplas resoluções
    await sharp(sourcePath)
      .resize(32, 32)
      .png()
      .toFile(path.join(__dirname, '../public/favicon-32x32.png'));

    await sharp(sourcePath)
      .resize(16, 16)
      .png()
      .toFile(path.join(__dirname, '../public/favicon-16x16.png'));

    console.log('✅ Gerados favicons');

    console.log('\n🎉 Todos os ícones foram gerados com sucesso!');
    console.log('📱 Próximo passo: Gerar splash screens para iOS');

  } catch (error) {
    console.error('❌ Erro ao gerar ícones:', error);
    process.exit(1);
  }
}

async function generateSplashScreens() {
  try {
    const sourcePath = path.join(__dirname, '../public/ml-agent-icon.png');
    const splashDir = path.join(__dirname, '../public/splash');

    // Criar diretório se não existir
    await fs.mkdir(splashDir, { recursive: true });

    console.log('\n🖼️ Gerando splash screens para iOS...');

    for (const splash of splashSizes) {
      const outputPath = path.join(splashDir, splash.name);

      // Criar splash screen com logo centralizado
      await sharp({
        create: {
          width: splash.width,
          height: splash.height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 } // Fundo preto
        }
      })
      .composite([
        {
          input: await sharp(sourcePath)
            .resize(Math.floor(Math.min(splash.width, splash.height) * 0.3))
            .toBuffer(),
          gravity: 'center'
        }
      ])
      .png()
      .toFile(outputPath);

      console.log(`✅ Gerado splash: ${splash.name}`);
    }

    console.log('\n🎉 Todas as splash screens foram geradas!');

  } catch (error) {
    console.error('❌ Erro ao gerar splash screens:', error);
    process.exit(1);
  }
}

// Executar
(async () => {
  await generateIcons();
  await generateSplashScreens();
})();