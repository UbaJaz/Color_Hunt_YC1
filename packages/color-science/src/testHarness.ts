// Test harness for ColorHunt color science core
// Tests the full pipeline: load → RGB→Lab → k-means → outlier rejection → CIEDE2000

import { loadFullImage } from './imageLoader.js';
import { extractDominantColor } from './kmeans.js';
import { rejectOutliers } from './outlierRejection.js';
import { rgbToLab, labToRgb } from './colorConversion.js';
import { deltaE2000, deltaEToScore } from './ciede2000.js';
import { RGB, Lab } from './types.js';

// Sample target colors to test against
const targetColors: { name: string; rgb: RGB }[] = [
  { name: 'Crimson', rgb: { r: 220, g: 20, b: 60 } },
  { name: 'CadetBlue', rgb: { r: 95, g: 158, b: 160 } },
  { name: 'RoyalBlue', rgb: { r: 65, g: 105, b: 225 } },
  { name: 'Bright Orange', rgb: { r: 255, g: 165, b: 0 } },
  { name: 'Purple', rgb: { r: 128, g: 0, b: 128 } },
  { name: 'Yellow', rgb: { r: 255, g: 255, b: 0 } },
  { name: 'White', rgb: { r: 255, g: 255, b: 255 } },
  { name: 'Black', rgb: { r: 0, g: 0, b: 0 } }
];

/**
 * Process a single image through the full pipeline
 */
async function processImage(imagePath: string, objectName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Processing: ${objectName}`);
  console.log(`Image: ${imagePath}`);
  console.log('='.repeat(80));

  try {
    // Step 1: Load pixels
    console.log('Step 1: Loading pixels...');
    const rgbPixels = await loadFullImage(imagePath);
    console.log(`  Loaded ${rgbPixels.length} pixels`);

    // Step 2: Convert RGB to Lab (for perceptually uniform clustering)
    console.log('\nStep 2: Converting RGB to Lab...');
    const labPixels = rgbPixels.map(rgb => rgbToLab(rgb));
    console.log(`  Converted ${labPixels.length} pixels to Lab`);

    // Step 3: K-means extraction in Lab space
    console.log('\nStep 3: K-means color extraction in Lab space (k=3)...');
    const kmeansResult = extractDominantColor(labPixels, 3);
    const dominantLab = kmeansResult.centroid;
    const dominantRgb = labToRgb(dominantLab);
    console.log(`  Dominant Lab: L=${dominantLab.L.toFixed(2)}, a=${dominantLab.a.toFixed(2)}, b=${dominantLab.b.toFixed(2)}`);
    console.log(`  Dominant RGB: (${dominantRgb.r}, ${dominantRgb.g}, ${dominantRgb.b})`);
    console.log(`  Cluster sizes: ${kmeansResult.clusterSizes.join(', ')}`);

    // Step 4: Outlier rejection in Lab space
    // IMPORTANT: only pass pixels belonging to the DOMINANT cluster, not the
    // whole image. Passing all pixels makes the std-dev threshold huge (since
    // it spans background + object + shadows), so nothing gets rejected and
    // the centroid drifts toward the whole photo's average color.
    console.log('\nStep 4: Outlier rejection in Lab space (2 std devs)...');
    const dominantClusterPixels = labPixels.filter(
      (_, i) => kmeansResult.assignments[i] === kmeansResult.dominantIndex
    );
    const outlierResult = rejectOutliers(dominantClusterPixels, dominantLab, 2);
    console.log(`  Pixels in dominant cluster: ${dominantClusterPixels.length} (of ${labPixels.length} total)`);
    console.log(`  Pixels before rejection: ${dominantClusterPixels.length}`);
    console.log(`  Pixels after rejection: ${outlierResult.filteredPixels.length}`);
    console.log(`  New centroid Lab: L=${outlierResult.newCentroid.L.toFixed(2)}, a=${outlierResult.newCentroid.a.toFixed(2)}, b=${outlierResult.newCentroid.b.toFixed(2)}`);

    // Use the outlier-rejected centroid for scoring
    const finalCentroid = outlierResult.newCentroid;
    const finalRgb = labToRgb(finalCentroid);

    // Step 5: Compare against target colors
    console.log('\nStep 5: Color matching scores:');
    console.log('\n' + '-'.repeat(80));
    console.log(`| ${'Target Color'.padEnd(20)} | ${'Target RGB'.padEnd(18)} | ${'Delta E'.padEnd(10)} | ${'Score'.padEnd(10)} |`);
    console.log('-'.repeat(80));

    for (const target of targetColors) {
      const targetLab = rgbToLab(target.rgb);
      const deltaE = deltaE2000(finalCentroid, targetLab);
      const score = deltaEToScore(deltaE, 15); // Using normalization factor of 10

      const targetRgbStr = `(${target.rgb.r},${target.rgb.g},${target.rgb.b})`;
      console.log(`| ${target.name.padEnd(20)} | ${targetRgbStr.padEnd(18)} | ${deltaE.toFixed(2).padEnd(10)} | ${score.toFixed(1).padEnd(10)} |`);
    }

    console.log('-'.repeat(80));

    // Return the extracted color for summary
    return {
      objectName,
      extractedRgb: finalRgb,
      extractedLab: finalCentroid
    };

  } catch (error) {
    console.error(`Error processing ${imagePath}:`, error);
    return null;
  }
}

/**
 * Test with synthetic colors (no image files needed)
 * Useful for verifying the math works correctly
 */
function testWithSyntheticColors() {
  console.log('\n' + '='.repeat(80));
  console.log('SYNTHETIC COLOR TEST (No images - testing math only)');
  console.log('='.repeat(80));

  const testCases: { name: string; rgb: RGB }[] = [
    { name: 'Red object', rgb: { r: 240, g: 20, b: 20 } },
    { name: 'Green object', rgb: { r: 30, g: 200, b: 40 } },
    { name: 'Blue object', rgb: { r: 20, g: 30, b: 220 } },
    { name: 'Orange object', rgb: { r: 255, g: 140, b: 10 } },
    { name: 'Purple object', rgb: { r: 140, g: 20, b: 150 } }
  ];

  console.log('\n' + '-'.repeat(80));
  console.log(`| ${'Object'.padEnd(20)} | ${'Extracted RGB'.padEnd(18)} | ${'Target'.padEnd(20)} | ${'Target RGB'.padEnd(18)} | ${'Delta E'.padEnd(10)} | ${'Score'.padEnd(10)} |`);
  console.log('-'.repeat(80));

  for (const testCase of testCases) {
    const extractedLab = rgbToLab(testCase.rgb);

    for (const target of targetColors) {
      const targetLab = rgbToLab(target.rgb);
      const deltaE = deltaE2000(extractedLab, targetLab);
      const score = deltaEToScore(deltaE, 15);

      const extractedRgbStr = `(${testCase.rgb.r},${testCase.rgb.g},${testCase.rgb.b})`;
      const targetRgbStr = `(${target.rgb.r},${target.rgb.g},${target.rgb.b})`;

      console.log(`| ${testCase.name.padEnd(20)} | ${extractedRgbStr.padEnd(18)} | ${target.name.padEnd(20)} | ${targetRgbStr.padEnd(18)} | ${deltaE.toFixed(2).padEnd(10)} | ${score.toFixed(1).padEnd(10)} |`);
    }
  }

  console.log('-'.repeat(80));
}

/**
 * Main test function
 * Add your image paths to the imagePaths array to test with real images
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('COLORHUNT COLOR SCIENCE TEST HARNESS');
  console.log('='.repeat(80));

  // First, run synthetic test to verify math
  testWithSyntheticColors();

  // Then test with real images (if provided)
  // Add your image paths here in the format: { path: 'path/to/image.jpg', name: 'Object Name' }
  const imagePaths: { path: string; name: string }[] = [
    { path: './test-images/real-red.jpeg', name: 'Real Red Object' },
    { path: './test-images/real-green.jpeg', name: 'Real Green Object' },
    { path: './test-images/real-blue.jpeg', name: 'Real Blue Object' },
  ];

  if (imagePaths.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('REAL IMAGE TEST');
    console.log('='.repeat(80));

    const results = [];
    for (const image of imagePaths) {
      const result = await processImage(image.path, image.name);
      if (result) results.push(result);
    }

    // Print summary
    if (results.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('SUMMARY');
      console.log('='.repeat(80));
      console.log('\n' + '-'.repeat(80));
      console.log(`| ${'Object'.padEnd(20)} | ${'Extracted RGB'.padEnd(18)} |`);
      console.log('-'.repeat(80));
      for (const result of results) {
        const rgbStr = `(${result.extractedRgb.r},${result.extractedRgb.g},${result.extractedRgb.b})`;
        console.log(`| ${result.objectName.padEnd(20)} | ${rgbStr.padEnd(18)} |`);
      }
      console.log('-'.repeat(80));
    }
  } else {
    console.log('\nNo image paths provided. Add image paths to the imagePaths array in testHarness.ts to test with real images.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80) + '\n');
}

// Run the test
main().catch(console.error);
