/**
 * Image optimization script
 * Run with: node scripts/optimize-image.js
 * 
 * This script compresses the landing page image for faster loading.
 * Requires sharp: npm install sharp --save-dev
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../public/landing.JPG');
const outputPath = path.join(__dirname, '../public/landing-optimized.jpg');
const outputWebPPath = path.join(__dirname, '../public/landing-optimized.webp');

async function optimizeImage() {
  try {
    console.log('Optimizing landing page image...');
    
    // Create optimized JPEG (85% quality, progressive)
    await sharp(inputPath)
      .resize(1920, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true,
      })
      .toFile(outputPath);
    
    console.log(`✓ Created optimized JPEG: ${outputPath}`);
    
    // Create WebP version (smaller file size)
    await sharp(inputPath)
      .resize(1920, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .webp({
        quality: 80,
      })
      .toFile(outputWebPPath);
    
    console.log(`✓ Created optimized WebP: ${outputWebPPath}`);
    
    // Get file sizes
    const originalSize = fs.statSync(inputPath).size / (1024 * 1024);
    const jpegSize = fs.statSync(outputPath).size / (1024 * 1024);
    const webpSize = fs.statSync(outputWebPPath).size / (1024 * 1024);
    
    console.log('\nFile sizes:');
    console.log(`Original: ${originalSize.toFixed(2)} MB`);
    console.log(`Optimized JPEG: ${jpegSize.toFixed(2)} MB (${((1 - jpegSize/originalSize) * 100).toFixed(1)}% reduction)`);
    console.log(`Optimized WebP: ${webpSize.toFixed(2)} MB (${((1 - webpSize/originalSize) * 100).toFixed(1)}% reduction)`);
    
    console.log('\n✓ Image optimization complete!');
    console.log('You can now use landing-optimized.jpg or landing-optimized.webp in your components.');
    
  } catch (error) {
    console.error('Error optimizing image:', error);
    process.exit(1);
  }
}

optimizeImage();

