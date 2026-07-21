// Test harness for ColorHunt color science core
// Tests the full pipeline: load → RGB→Lab → k-means → outlier rejection → CIEDE2000

import { loadFullImage } from './imageLoader.js';
import { extractDominantColor, calculateSizeFactor } from './kmeans.js';
import { rejectOutliers } from './outlierRejection.js';
import { rgbToLab, labToRgb } from './colorConversion.js';
import { deltaE2000, deltaEToScore } from './ciede2000.js';
import { RGB, Lab } from './types.js';
import { estimateWhiteBalance, applyCalibration } from './calibration.js';
import { calculateBonusMultiplier, VoteTally } from './bonusVoting.js';
import { calculateConfidence } from './confidence.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

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
      const score = deltaEToScore(deltaE, 15); // Using normalization factor of 15

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
 * Test k-means with synthetic dim-lighting scenario
 */
function testDimLightingKMeans() {
  console.log('\n' + '='.repeat(80));
  console.log('DIM-LIGHTING K-MEANS BUG REPRODUCTION TEST');
  console.log('='.repeat(80));
  console.log('Scenario: 83% dull orange cluster vs 17% saturated violet cluster');
  console.log('Expected: Should pick orange cluster (larger, representative)');
  console.log('Bug (pre-fix): Picks violet cluster (small but high-chroma)');
  console.log('='.repeat(80));

  const totalPixels = 1000;
  const orangeCount = Math.floor(totalPixels * 0.83);
  const violetCount = totalPixels - orangeCount;

  const pixels: Lab[] = [];

  for (let i = 0; i < orangeCount; i++) {
    pixels.push({
      L: 35 + (Math.random() - 0.5) * 5,
      a: 15 + (Math.random() - 0.5) * 5,
      b: 25 + (Math.random() - 0.5) * 5
    });
  }

  for (let i = 0; i < violetCount; i++) {
    pixels.push({
      L: 15 + (Math.random() - 0.5) * 3,
      a: 40 + (Math.random() - 0.5) * 5,
      b: -45 + (Math.random() - 0.5) * 5
    });
  }

  console.log('\nRunning k-means extraction...');
  const result = extractDominantColor(pixels, 3);
  const dominantLab = result.centroid;
  const dominantRgb = labToRgb(dominantLab);

  console.log(`\nDominant Lab: L=${dominantLab.L.toFixed(2)}, a=${dominantLab.a.toFixed(2)}, b=${dominantLab.b.toFixed(2)}`);
  console.log(`Dominant RGB: (${dominantRgb.r}, ${dominantRgb.g}, ${dominantRgb.b})`);
  console.log(`Cluster sizes: ${result.clusterSizes.join(', ')}`);
  console.log(`Dominant cluster index: ${result.dominantIndex}`);

  const isOrangeHue = dominantLab.a > 0 && dominantLab.b > 0 && dominantLab.L > 20;
  const isVioletHue = dominantLab.a > 0 && dominantLab.b < 0 && dominantLab.L < 20;

  console.log('\n' + '-'.repeat(80));
  if (isOrangeHue) {
    console.log('✓ PASS: Picked orange cluster (correct - larger, representative)');
  } else if (isVioletHue) {
    console.log('✗ FAIL: Picked violet cluster (BUG - small high-chroma cluster won)');
  } else {
    console.log('? UNCERTAIN: Picked a cluster that does not match expected hue');
  }
  console.log('-'.repeat(80));
}

/**
 * Test k-means with synthetic same-hue scenario
 */
function testSameHueKMeans() {
  console.log('\n' + '='.repeat(80));
  console.log('SAME-HUE K-MEANS TEST (Size penalty isolation)');
  console.log('='.repeat(80));
  console.log('Scenario: 83% dull orange cluster vs 17% saturated orange cluster');
  console.log('Both clusters have similar hues (<90° divergence)');
  console.log('Expected: Should pick large orange cluster (size penalty alone flips winner)');
  console.log('='.repeat(80));

  const totalPixels = 1000;
  const dullOrangeCount = Math.floor(totalPixels * 0.83);
  const saturatedOrangeCount = totalPixels - dullOrangeCount;

  const pixels: Lab[] = [];

  for (let i = 0; i < dullOrangeCount; i++) {
    pixels.push({
      L: 35 + (Math.random() - 0.5) * 5,
      a: 15 + (Math.random() - 0.5) * 5,
      b: 25 + (Math.random() - 0.5) * 5
    });
  }

  for (let i = 0; i < saturatedOrangeCount; i++) {
    pixels.push({
      L: 20 + (Math.random() - 0.5) * 3,
      a: 35 + (Math.random() - 0.5) * 5,
      b: 40 + (Math.random() - 0.5) * 5
    });
  }

  console.log('\nRunning k-means extraction...');
  const result = extractDominantColor(pixels, 3);
  const dominantLab = result.centroid;
  const dominantRgb = labToRgb(dominantLab);

  console.log(`\nDominant Lab: L=${dominantLab.L.toFixed(2)}, a=${dominantLab.a.toFixed(2)}, b=${dominantLab.b.toFixed(2)}`);
  console.log(`Dominant RGB: (${dominantRgb.r}, ${dominantRgb.g}, ${dominantRgb.b})`);
  console.log(`Cluster sizes: ${result.clusterSizes.join(', ')}`);
  console.log(`Dominant cluster index: ${result.dominantIndex}`);

  const largestClusterIndex = result.clusterSizes.indexOf(Math.max(...result.clusterSizes));
  const pickedLargeCluster = result.dominantIndex === largestClusterIndex;

  console.log('\n' + '-'.repeat(80));
  if (pickedLargeCluster) {
    console.log('✓ PASS: Picked large cluster (size penalty working correctly)');
  } else {
    console.log('✗ FAIL: Picked small cluster (size penalty not working)');
  }
  console.log('-'.repeat(80));
}

/**
 * Test k-means with red-berry/green-leaf scenario (regression test)
 */
function testRedBerryGreenLeaf() {
  console.log('\n' + '='.repeat(80));
  console.log('RED-BERRY/GREEN-LEAF REGRESSION TEST');
  console.log('='.repeat(80));
  console.log('Scenario: 80% dull green background vs 20% vivid red foreground');
  console.log('Expected: Should pick red berry (small high-chroma object - INTENDED behavior)');
  console.log('Regression risk: Hue check might fire and pick dull green leaf instead');
  console.log('='.repeat(80));

  const totalPixels = 1000;
  const greenCount = Math.floor(totalPixels * 0.80);
  const redCount = totalPixels - greenCount;

  const pixels: Lab[] = [];

  for (let i = 0; i < greenCount; i++) {
    pixels.push({
      L: 45 + (Math.random() - 0.5) * 8,
      a: -20 + (Math.random() - 0.5) * 8,
      b: 25 + (Math.random() - 0.5) * 8
    });
  }

  for (let i = 0; i < redCount; i++) {
    pixels.push({
      L: 40 + (Math.random() - 0.5) * 8,
      a: 55 + (Math.random() - 0.5) * 8,
      b: 35 + (Math.random() - 0.5) * 8
    });
  }

  console.log('\nRunning k-means extraction...');
  const result = extractDominantColor(pixels, 3);
  
  // DIAGNOSTIC: Print all clusters
  console.log('\nAll clusters found:');
  result.allCentroids.forEach((c, i) => {
    const chroma = Math.sqrt(c.a * c.a + c.b * c.b);
    const size = result.clusterSizes[i];
    console.log(`  Cluster ${i}: L=${c.L.toFixed(1)}, a=${c.a.toFixed(1)}, b=${c.b.toFixed(1)}, Chroma=${chroma.toFixed(1)}, Size=${size}`);
  });

  const dominantLab = result.centroid;
  const dominantRgb = labToRgb(dominantLab);

  console.log(`\nDominant Lab: L=${dominantLab.L.toFixed(2)}, a=${dominantLab.a.toFixed(2)}, b=${dominantLab.b.toFixed(2)}`);
  console.log(`Dominant RGB: (${dominantRgb.r}, ${dominantRgb.g}, ${dominantRgb.b})`);
  console.log(`Cluster sizes: ${result.clusterSizes.join(', ')}`);
  console.log(`Dominant cluster index: ${result.dominantIndex}`);

  const isRedHue = dominantLab.a > 20;
  const isGreenHue = dominantLab.a < 0;

  console.log('\n' + '-'.repeat(80));
  if (isRedHue) {
    console.log('✓ PASS: Picked red berry (correct - small high-chroma object)');
  } else if (isGreenHue) {
    console.log('✗ FAIL: Picked green leaf (REGRESSION - hue check broke intended behavior)');
  } else {
    console.log('? UNCERTAIN: Picked a cluster that does not match expected hue');
  }
  console.log('-'.repeat(80));
}

/**
 * Test calculateSizeFactor pure function
 */
function testCalculateSizeFactor() {
  console.log('\n' + '='.repeat(80));
  console.log('CALCULATESIZEFACTOR UNIT TEST');
  console.log('='.repeat(80));

  const testCases = [
    { sizeRatio: 0.17, description: '17% cluster (dim-lighting scenario)' },
    { sizeRatio: 0.10, description: '10% cluster (small cluster)' },
    { sizeRatio: 0.05, description: '5% cluster (very small cluster)' },
    { sizeRatio: 0.25, description: '25% cluster (above threshold)' }
  ];

  console.log('\n' + '-'.repeat(80));
  console.log(`| ${'Size Ratio'.padEnd(15)} | ${'Description'.padEnd(35)} | ${'Size Factor'.padEnd(15)} |`);
  console.log('-'.repeat(80));

  for (const testCase of testCases) {
    const sizeFactor = calculateSizeFactor(testCase.sizeRatio);
    console.log(`| ${testCase.sizeRatio.toFixed(2).padEnd(15)} | ${testCase.description.padEnd(35)} | ${sizeFactor.toFixed(4).padEnd(15)} |`);
  }

  console.log('-'.repeat(80));

  console.log('\nVerification of graduated ramp logic:');
  console.log('  At 0.20 threshold (exact): sizeFactor should be sqrt(0.20) = 0.447 (no ramp, condition is < not <=)');
  const thresholdFactor = calculateSizeFactor(0.20);
  console.log(`  Actual: ${thresholdFactor.toFixed(4)}`);
  console.log(`  ${Math.abs(thresholdFactor - 0.447) < 0.01 ? '✓ PASS' : '✗ FAIL'}: Threshold logic correct`);

  console.log('\n  At 0.19 (just below threshold): sizeFactor should be sqrt(0.19) * (0.19/0.20)^2 * 0.5 = 0.436 * 0.451 = 0.197');
  const belowThresholdFactor = calculateSizeFactor(0.19);
  console.log(`  Actual: ${belowThresholdFactor.toFixed(4)}`);
  console.log(`  ${Math.abs(belowThresholdFactor - 0.197) < 0.01 ? '✓ PASS' : '✗ FAIL'}: Below-threshold ramp correct`);

  console.log('\nVerification of above-threshold behavior:');
  console.log('  At 0.25 (above 0.20 threshold): sizeFactor should be sqrt(0.25) = 0.5');
  const aboveThresholdFactor = calculateSizeFactor(0.25);
  console.log(`  Actual: ${aboveThresholdFactor.toFixed(4)}`);
  console.log(`  ${Math.abs(aboveThresholdFactor - 0.5) < 0.01 ? '✓ PASS' : '✗ FAIL'}: Above-threshold logic correct`);

  console.log('-'.repeat(80));
}

/**
 * Test white-balance calibration functions
 */
function testCalibration() {
  console.log('\n' + '='.repeat(80));
  console.log('WHITE-BALANCE CALIBRATION TEST');
  console.log('='.repeat(80));

  console.log('\nTest 1: Warm-tinted white card (255, 230, 200)');
  const warmWhiteCard = { r: 255, g: 230, b: 200 };
  const warmCalibration = estimateWhiteBalance(warmWhiteCard);
  console.log(`  Estimated calibration matrix:`);
  console.log(`    rScale: ${warmCalibration.rScale.toFixed(3)}`);
  console.log(`    gScale: ${warmCalibration.gScale.toFixed(3)}`);
  console.log(`    bScale: ${warmCalibration.bScale.toFixed(3)}`);
  const warmTest = warmCalibration.gScale > 1 && warmCalibration.bScale > 1 && Math.abs(warmCalibration.rScale - 1) < 0.1;
  console.log(`  ${warmTest ? '✓ PASS' : '✗ FAIL'}: Warm tint correctly identified`);

  console.log('\nTest 2: Apply calibration to neutral gray (128, 128, 128)');
  const neutralGray = { r: 128, g: 128, b: 128 };
  const correctedGray = applyCalibration(neutralGray, warmCalibration);
  console.log(`  Original: (${neutralGray.r}, ${neutralGray.g}, ${neutralGray.b})`);
  console.log(`  Corrected: (${correctedGray.r}, ${correctedGray.g}, ${correctedGray.b})`);
  const grayTest = correctedGray.g > neutralGray.g && correctedGray.b > neutralGray.b;
  console.log(`  ${grayTest ? '✓ PASS' : '✗ FAIL'}: Gray correctly warmed`);

  console.log('\nTest 3: Pathological case (10, 10, 10) - badly-lit calibration');
  const darkCard = { r: 10, g: 10, b: 10 };
  const darkCalibration = estimateWhiteBalance(darkCard);
  console.log(`  Estimated calibration matrix:`);
  console.log(`    rScale: ${darkCalibration.rScale.toFixed(3)}`);
  console.log(`    gScale: ${darkCalibration.gScale.toFixed(3)}`);
  console.log(`    bScale: ${darkCalibration.bScale.toFixed(3)}`);
  const darkTest = darkCalibration.rScale === 3 && darkCalibration.gScale === 3 && darkCalibration.bScale === 3;
  console.log(`  ${darkTest ? '✓ PASS' : '✗ FAIL'}: Clamp correctly applied`);

  console.log('\nTest 4: Perfect white card (255, 255, 255)');
  const perfectWhite = { r: 255, g: 255, b: 255 };
  const perfectCalibration = estimateWhiteBalance(perfectWhite);
  console.log(`  Estimated calibration matrix:`);
  console.log(`    rScale: ${perfectCalibration.rScale.toFixed(3)}`);
  console.log(`    gScale: ${perfectCalibration.gScale.toFixed(3)}`);
  console.log(`    bScale: ${perfectCalibration.bScale.toFixed(3)}`);
  const perfectTest = Math.abs(perfectCalibration.rScale - 1) < 0.01 &&
                      Math.abs(perfectCalibration.gScale - 1) < 0.01 &&
                      Math.abs(perfectCalibration.bScale - 1) < 0.01;
  console.log(`  ${perfectTest ? '✓ PASS' : '✗ FAIL'}: No correction needed`);

  console.log('\n' + '-'.repeat(80));
}

/**
 * Test bonus voting multiplier calculation
 */
function testBonusVoting() {
  console.log('\n' + '='.repeat(80));
  console.log('BONUS VOTING MULTIPLIER TEST');
  console.log('='.repeat(80));

  const testCases: { votes: VoteTally; expected: number; description: string }[] = [
    { votes: { thumbsUp: 0, thumbsDown: 0 }, expected: 1.0, description: '0 votes → 1.0' },
    { votes: { thumbsUp: 5, thumbsDown: 5 }, expected: 1.0, description: '5 up, 5 down (50%) → 1.0' },
    { votes: { thumbsUp: 10, thumbsDown: 0 }, expected: 2.0, description: '10 up, 0 down (100%) → 2.0' },
    { votes: { thumbsUp: 7, thumbsDown: 3 }, expected: 1.4, description: '7 up, 3 down (70%) → 1.4' },
    { votes: { thumbsUp: 2, thumbsDown: 8 }, expected: 1.0, description: '2 up, 8 down (20%) → 1.0 (floor)' }
  ];

  console.log('\n' + '-'.repeat(80));
  console.log(`| ${'Description'.padEnd(35)} | ${'Up'.padEnd(5)} | ${'Down'.padEnd(5)} | ${'Expected'.padEnd(10)} | ${'Actual'.padEnd(10)} | ${'Result'.padEnd(10)} |`);
  console.log('-'.repeat(80));

  let passCount = 0;
  for (const testCase of testCases) {
    const actual = calculateBonusMultiplier(testCase.votes);
    const passed = Math.abs(actual - testCase.expected) < 0.01;
    if (passed) passCount++;
    console.log(`| ${testCase.description.padEnd(35)} | ${testCase.votes.thumbsUp.toString().padEnd(5)} | ${testCase.votes.thumbsDown.toString().padEnd(5)} | ${testCase.expected.toFixed(1).padEnd(10)} | ${actual.toFixed(1).padEnd(10)} | ${passed ? '✓ PASS' : '✗ FAIL'}${''.padEnd(6)} |`);
  }

  console.log('-'.repeat(80));
  console.log(`Summary: ${passCount}/${testCases.length} tests passed`);
  console.log('-'.repeat(80));
}

/**
 * Stress-test the pipeline against varied lighting scenarios
 * This is a "start, catch problems early" task - not meant to fix everything found
 */
function testLightingScenarios() {
  console.log('\n' + '='.repeat(80));
  console.log('LIGHTING STRESS-TEST SCENARIOS');
  console.log('='.repeat(80));
  console.log('Purpose: Identify edge cases for Day 8 hardening. Log findings, do not fix.');

  const scenarios: { name: string; pixels: Lab[]; expected: string }[] = [];

  // Scenario 1: Very dark object on slightly-less-dark background
  const darkObjectPixels: Lab[] = [];
  for (let i = 0; i < 800; i++) {
    darkObjectPixels.push({ L: 25 + (Math.random() - 0.5) * 4, a: 10 + (Math.random() - 0.5) * 4, b: 15 + (Math.random() - 0.5) * 4 });
  }
  for (let i = 0; i < 200; i++) {
    darkObjectPixels.push({ L: 18 + (Math.random() - 0.5) * 3, a: 25 + (Math.random() - 0.5) * 3, b: 30 + (Math.random() - 0.5) * 3 });
  }
  scenarios.push({
    name: 'Scenario 1: Very dark object (L=18) on dark background (L=25)',
    pixels: darkObjectPixels,
    expected: 'Should extract the dark object color (smaller but distinct)'
  });

  // Scenario 2: Very bright/overexposed object on mid-tone background
  const brightObjectPixels: Lab[] = [];
  for (let i = 0; i < 800; i++) {
    brightObjectPixels.push({ L: 50 + (Math.random() - 0.5) * 5, a: 5 + (Math.random() - 0.5) * 5, b: 5 + (Math.random() - 0.5) * 5 });
  }
  for (let i = 0; i < 200; i++) {
    brightObjectPixels.push({ L: 92 + (Math.random() - 0.5) * 3, a: 2 + (Math.random() - 0.5) * 2, b: 2 + (Math.random() - 0.5) * 2 });
  }
  scenarios.push({
    name: 'Scenario 2: Overexposed object (L=92, low chroma) on mid-tone background',
    pixels: brightObjectPixels,
    expected: 'Should extract the bright object despite low chroma'
  });

  // Scenario 3: Mixed lighting / color cast (same hue split across two sub-clusters)
  const mixedLightingPixels: Lab[] = [];
  for (let i = 0; i < 500; i++) {
    mixedLightingPixels.push({ L: 35 + (Math.random() - 0.5) * 4, a: 40 + (Math.random() - 0.5) * 4, b: 30 + (Math.random() - 0.5) * 4 });
  }
  for (let i = 0; i < 500; i++) {
    mixedLightingPixels.push({ L: 50 + (Math.random() - 0.5) * 4, a: 35 + (Math.random() - 0.5) * 4, b: 25 + (Math.random() - 0.5) * 4 });
  }
  scenarios.push({
    name: 'Scenario 3: Mixed lighting (same hue, different L between shadow/light)',
    pixels: mixedLightingPixels,
    expected: 'Should pick one of the clusters or average them'
  });

  // Scenario 4: Low-saturation object (beige on tan)
  const lowSaturationPixels: Lab[] = [];
  for (let i = 0; i < 800; i++) {
    lowSaturationPixels.push({ L: 70 + (Math.random() - 0.5) * 3, a: 5 + (Math.random() - 0.5) * 3, b: 15 + (Math.random() - 0.5) * 3 });
  }
  for (let i = 0; i < 200; i++) {
    lowSaturationPixels.push({ L: 75 + (Math.random() - 0.5) * 3, a: 8 + (Math.random() - 0.5) * 3, b: 18 + (Math.random() - 0.5) * 3 });
  }
  scenarios.push({
    name: 'Scenario 4: Low-saturation object (beige on tan background)',
    pixels: lowSaturationPixels,
    expected: 'Should flag as low-confidence or extract usable color'
  });

  // Scenario 5: Specular highlight simulation
  const specularPixels: Lab[] = [];
  for (let i = 0; i < 950; i++) {
    specularPixels.push({ L: 40 + (Math.random() - 0.5) * 5, a: 30 + (Math.random() - 0.5) * 5, b: 20 + (Math.random() - 0.5) * 5 });
  }
  for (let i = 0; i < 50; i++) {
    specularPixels.push({ L: 95 + (Math.random() - 0.5) * 2, a: 1 + (Math.random() - 0.5) * 1, b: 1 + (Math.random() - 0.5) * 1 });
  }
  scenarios.push({
    name: 'Scenario 5: Specular highlight (5% bright low-chroma cluster)',
    pixels: specularPixels,
    expected: 'Should ignore the highlight cluster via outlier rejection or size penalty'
  });

  console.log('\n' + '-'.repeat(80));
  console.log(`| ${'Scenario'.padEnd(50)} | ${'Extracted L'.padEnd(12)} | ${'Chroma'.padEnd(10)} | ${'Confidence'.padEnd(12)} | ${'Result'.padEnd(10)} |`);
  console.log('-'.repeat(80));

  const findings: string[] = [];

  for (const scenario of scenarios) {
    const result = extractDominantColor(scenario.pixels, 3);
    const dominantLab = result.centroid;
    const chroma = Math.sqrt(dominantLab.a * dominantLab.a + dominantLab.b * dominantLab.b);
    
    // Convert Lab pixels to RGB for confidence calculation
    const rgbPixels = scenario.pixels.map(lab => labToRgb(lab));
    const dominantRgb = labToRgb(dominantLab);
    const confidence = calculateConfidence(dominantRgb, rgbPixels);

    const isCloseEnough = chroma > 10 || confidence.level !== 'low';
    const resultStr = isCloseEnough ? 'PASS' : 'FLAG';

    console.log(`| ${scenario.name.padEnd(50)} | ${dominantLab.L.toFixed(1).padEnd(12)} | ${chroma.toFixed(1).padEnd(10)} | ${confidence.level.padEnd(12)} | ${resultStr.padEnd(10)} |`);

    if (!isCloseEnough) {
      findings.push(`${scenario.name}: Extracted chroma=${chroma.toFixed(1)}, confidence=${confidence.level} - ${scenario.expected}`);
    }
  }

  console.log('-'.repeat(80));

  if (findings.length > 0) {
    console.log('\nFINDINGS FOR DAY 8:');
    for (const finding of findings) {
      console.log(`  - ${finding}`);
    }
  } else {
    console.log('\nNo issues flagged - all scenarios handled reasonably.');
  }

  console.log('-'.repeat(80));
}

/**
 * Main test function
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('COLORHUNT COLOR SCIENCE TEST HARNESS');
  console.log('='.repeat(80));

  testWithSyntheticColors();
  testDimLightingKMeans();
  testSameHueKMeans();
  testRedBerryGreenLeaf();
  testCalculateSizeFactor();
  testCalibration();
  testBonusVoting();
  testLightingScenarios();

  const imagePaths: { path: string; name: string }[] = [
    { path: path.resolve(projectRoot, 'test-images/real-red.jpeg'), name: 'Real Red Object' },
    { path: path.resolve(projectRoot, 'test-images/real-green.jpeg'), name: 'Real Green Object' },
    { path: path.resolve(projectRoot, 'test-images/real-blue.jpeg'), name: 'Real Blue Object' },
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
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
