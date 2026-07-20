// Test harness for ColorHunt color science core
// Tests the full pipeline: load → RGB→Lab → k-means → outlier rejection → CIEDE2000

import { loadFullImage } from './imageLoader.js';
import { extractDominantColor, calculateSizeFactor } from './kmeans.js';
import { rejectOutliers } from './outlierRejection.js';
import { rgbToLab, labToRgb } from './colorConversion.js';
import { deltaE2000, deltaEToScore } from './ciede2000.js';
import { RGB, Lab } from './types.js';
import { estimateWhiteBalance, applyCalibration } from './calibration.js';

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
 * Test k-means with synthetic dim-lighting scenario
 * This reproduces the bug where a small high-chroma cluster (17%) wins over
 * a larger representative cluster (83%) under low light conditions.
 *
 * Scenario: ~83% dull orange (L≈35, a≈15, b≈25) vs ~17% saturated violet (L≈15, a≈40, b≈-45)
 * Expected: should pick the orange cluster (larger, representative of the object)
 * Bug (pre-fix): picks the violet cluster (small but high-chroma)
 */
function testDimLightingKMeans() {
  console.log('\n' + '='.repeat(80));
  console.log('DIM-LIGHTING K-MEANS BUG REPRODUCTION TEST');
  console.log('='.repeat(80));
  console.log('Scenario: 83% dull orange cluster vs 17% saturated violet cluster');
  console.log('Expected: Should pick orange cluster (larger, representative)');
  console.log('Bug (pre-fix): Picks violet cluster (small but high-chroma)');
  console.log('='.repeat(80));

  // Create synthetic pixel array: 83% dull orange, 17% saturated violet
  const totalPixels = 1000;
  const orangeCount = Math.floor(totalPixels * 0.83);
  const violetCount = totalPixels - orangeCount;

  const pixels: Lab[] = [];

  // Add dull orange pixels (L≈35, a≈15, b≈25) with small variance
  for (let i = 0; i < orangeCount; i++) {
    pixels.push({
      L: 35 + (Math.random() - 0.5) * 5,
      a: 15 + (Math.random() - 0.5) * 5,
      b: 25 + (Math.random() - 0.5) * 5
    });
  }

  // Add saturated violet pixels (L≈15, a≈40, b≈-45) with small variance
  for (let i = 0; i < violetCount; i++) {
    pixels.push({
      L: 15 + (Math.random() - 0.5) * 3,
      a: 40 + (Math.random() - 0.5) * 5,
      b: -45 + (Math.random() - 0.5) * 5
    });
  }

  // Run k-means extraction
  console.log('\nRunning k-means extraction...');
  const result = extractDominantColor(pixels, 3);
  const dominantLab = result.centroid;
  const dominantRgb = labToRgb(dominantLab);

  console.log(`\nDominant Lab: L=${dominantLab.L.toFixed(2)}, a=${dominantLab.a.toFixed(2)}, b=${dominantLab.b.toFixed(2)}`);
  console.log(`Dominant RGB: (${dominantRgb.r}, ${dominantRgb.g}, ${dominantRgb.b})`);
  console.log(`Cluster sizes: ${result.clusterSizes.join(', ')}`);
  console.log(`Dominant cluster index: ${result.dominantIndex}`);

  // Calculate hue angles for all centroids
  const hueAngles = result.allCentroids.map(c => {
    const hue = Math.atan2(c.b, c.a) * (180 / Math.PI);
    return hue < 0 ? hue + 360 : hue;
  });

  console.log(`\nHue angles (degrees): ${hueAngles.map(h => h.toFixed(1)).join(', ')}`);

  // Determine which cluster was picked
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
 * This tests the size-penalty fix in isolation (hue check won't fire)
 *
 * Scenario: ~83% dull orange (L≈35, a≈15, b≈25) vs ~17% saturated orange (L≈20, a≈35, b≈40)
 * Both clusters have similar hues (<90° divergence), so hue-consistency check won't override
 * Expected: should pick the large orange cluster (size penalty alone should flip the winner)
 * This proves the size penalty works independently of the hue check
 */
function testSameHueKMeans() {
  console.log('\n' + '='.repeat(80));
  console.log('SAME-HUE K-MEANS TEST (Size penalty isolation)');
  console.log('='.repeat(80));
  console.log('Scenario: 83% dull orange cluster vs 17% saturated orange cluster');
  console.log('Both clusters have similar hues (<90° divergence)');
  console.log('Expected: Should pick large orange cluster (size penalty alone flips winner)');
  console.log('='.repeat(80));

  // Create synthetic pixel array: 83% dull orange, 17% saturated orange
  const totalPixels = 1000;
  const dullOrangeCount = Math.floor(totalPixels * 0.83);
  const saturatedOrangeCount = totalPixels - dullOrangeCount;

  const pixels: Lab[] = [];

  // Add dull orange pixels (L≈35, a≈15, b≈25) with small variance
  for (let i = 0; i < dullOrangeCount; i++) {
    pixels.push({
      L: 35 + (Math.random() - 0.5) * 5,
      a: 15 + (Math.random() - 0.5) * 5,
      b: 25 + (Math.random() - 0.5) * 5
    });
  }

  // Add saturated orange pixels (L≈20, a≈35, b≈40) with small variance
  for (let i = 0; i < saturatedOrangeCount; i++) {
    pixels.push({
      L: 20 + (Math.random() - 0.5) * 3,
      a: 35 + (Math.random() - 0.5) * 5,
      b: 40 + (Math.random() - 0.5) * 5
    });
  }

  // Run k-means extraction
  console.log('\nRunning k-means extraction...');
  const result = extractDominantColor(pixels, 3);
  const dominantLab = result.centroid;
  const dominantRgb = labToRgb(dominantLab);

  console.log(`\nDominant Lab: L=${dominantLab.L.toFixed(2)}, a=${dominantLab.a.toFixed(2)}, b=${dominantLab.b.toFixed(2)}`);
  console.log(`Dominant RGB: (${dominantRgb.r}, ${dominantRgb.g}, ${dominantRgb.b})`);
  console.log(`Cluster sizes: ${result.clusterSizes.join(', ')}`);
  console.log(`Dominant cluster index: ${result.dominantIndex}`);

  // Calculate hue angles for all centroids
  const hueAngles = result.allCentroids.map(c => {
    const hue = Math.atan2(c.b, c.a) * (180 / Math.PI);
    return hue < 0 ? hue + 360 : hue;
  });

  console.log(`\nHue angles (degrees): ${hueAngles.map(h => h.toFixed(1)).join(', ')}`);

  // Calculate hue divergence between the two main clusters
  const largestClusterIndex = result.clusterSizes.indexOf(Math.max(...result.clusterSizes));
  const largestHue = hueAngles[largestClusterIndex];
  const dominantHue = hueAngles[result.dominantIndex];
  const hueDivergence = Math.abs(largestHue - dominantHue);
  const adjustedDivergence = Math.min(hueDivergence, 360 - hueDivergence);

  console.log(`\nHue divergence between largest and dominant clusters: ${adjustedDivergence.toFixed(1)}°`);
  console.log(`Hue check threshold: 90°`);
  console.log(`Hue check will fire: ${adjustedDivergence > 90 ? 'YES' : 'NO'}`);

  // Determine which cluster was picked based on size
  const dominantSize = result.clusterSizes[result.dominantIndex];
  const largestSize = result.clusterSizes[largestClusterIndex];
  const pickedLargeCluster = result.dominantIndex === largestClusterIndex;

  console.log('\n' + '-'.repeat(80));
  if (pickedLargeCluster) {
    console.log('✓ PASS: Picked large cluster (size penalty working correctly)');
    console.log(`  Dominant cluster size: ${dominantSize} pixels (${(dominantSize/totalPixels*100).toFixed(1)}%)`);
    console.log(`  Largest cluster size: ${largestSize} pixels (${(largestSize/totalPixels*100).toFixed(1)}%)`);
  } else {
    console.log('✗ FAIL: Picked small cluster (size penalty not working)');
    console.log(`  Dominant cluster size: ${dominantSize} pixels (${(dominantSize/totalPixels*100).toFixed(1)}%)`);
    console.log(`  Largest cluster size: ${largestSize} pixels (${(largestSize/totalPixels*100).toFixed(1)}%)`);
  }
  console.log('-'.repeat(80));
}

/**
 * Test k-means with red-berry/green-leaf scenario (regression test)
 * This tests whether the hue-consistency check breaks the intended use case:
 * a small vivid object against a large dull background.
 *
 * Scenario: ~80% dull green background (L≈50, a≈-30, b≈30) vs ~20% vivid red foreground (L≈35, a≈60, b≈40)
 * Expected: should pick the red berry (small but high-chroma - this is the INTENDED correct behavior)
 * Regression risk: hue check might fire (red vs green >90° divergence) and pick the dull green leaf instead
 */
function testRedBerryGreenLeaf() {
  console.log('\n' + '='.repeat(80));
  console.log('RED-BERRY/GREEN-LEAF REGRESSION TEST');
  console.log('='.repeat(80));
  console.log('Scenario: 80% dull green background vs 20% vivid red foreground');
  console.log('Expected: Should pick red berry (small high-chroma object - INTENDED behavior)');
  console.log('Regression risk: Hue check might fire and pick dull green leaf instead');
  console.log('='.repeat(80));

  // Create synthetic pixel array: 80% dull green, 20% vivid red
  const totalPixels = 1000;
  const greenCount = Math.floor(totalPixels * 0.80);
  const redCount = totalPixels - greenCount;

  const pixels: Lab[] = [];

  // Add dull green background pixels (L≈50, a≈-30, b≈30) with small variance
  // More extreme green to ensure separation from red
  for (let i = 0; i < greenCount; i++) {
    pixels.push({
      L: 50 + (Math.random() - 0.5) * 5,
      a: -30 + (Math.random() - 0.5) * 5,
      b: 30 + (Math.random() - 0.5) * 5
    });
  }

  // Add vivid red foreground pixels (L≈35, a≈60, b≈40) with small variance
  // More extreme red to ensure separation from green
  for (let i = 0; i < redCount; i++) {
    pixels.push({
      L: 35 + (Math.random() - 0.5) * 3,
      a: 60 + (Math.random() - 0.5) * 5,
      b: 40 + (Math.random() - 0.5) * 5
    });
  }

  // Run k-means extraction
  console.log('\nRunning k-means extraction...');
  const result = extractDominantColor(pixels, 3);
  const dominantLab = result.centroid;
  const dominantRgb = labToRgb(dominantLab);

  console.log(`\nDominant Lab: L=${dominantLab.L.toFixed(2)}, a=${dominantLab.a.toFixed(2)}, b=${dominantLab.b.toFixed(2)}`);
  console.log(`Dominant RGB: (${dominantRgb.r}, ${dominantRgb.g}, ${dominantRgb.b})`);
  console.log(`Cluster sizes: ${result.clusterSizes.join(', ')}`);
  console.log(`Dominant cluster index: ${result.dominantIndex}`);

  // Calculate hue angles for all centroids
  const hueAngles = result.allCentroids.map(c => {
    const hue = Math.atan2(c.b, c.a) * (180 / Math.PI);
    return hue < 0 ? hue + 360 : hue;
  });

  console.log(`\nHue angles (degrees): ${hueAngles.map(h => h.toFixed(1)).join(', ')}`);

  // Calculate hue divergence between the two main clusters
  const largestClusterIndex = result.clusterSizes.indexOf(Math.max(...result.clusterSizes));
  const largestHue = hueAngles[largestClusterIndex];
  const dominantHue = hueAngles[result.dominantIndex];
  const hueDivergence = Math.abs(largestHue - dominantHue);
  const adjustedDivergence = Math.min(hueDivergence, 360 - hueDivergence);

  console.log(`\nHue divergence between largest and dominant clusters: ${adjustedDivergence.toFixed(1)}°`);
  console.log(`Hue check threshold: 90°`);
  console.log(`Hue check will fire: ${adjustedDivergence > 90 ? 'YES' : 'NO'}`);

  // Calculate chroma for both clusters
  const largestChroma = Math.sqrt(
    result.allCentroids[largestClusterIndex].a ** 2 +
    result.allCentroids[largestClusterIndex].b ** 2
  );
  const dominantChroma = Math.sqrt(
    dominantLab.a ** 2 + dominantLab.b ** 2
  );

  console.log(`\nLargest cluster chroma: ${largestChroma.toFixed(2)}`);
  console.log(`Dominant cluster chroma: ${dominantChroma.toFixed(2)}`);

  // Determine which cluster was picked
  const isRedHue = dominantLab.a > 30 && dominantLab.b > 0;
  const isGreenHue = dominantLab.a < 0 && dominantLab.b > 0;

  console.log('\n' + '-'.repeat(80));
  if (isRedHue) {
    console.log('✓ PASS: Picked red berry (correct - small high-chroma object)');
  } else if (isGreenHue) {
    console.log('✗ FAIL: Picked green leaf (REGRESSION - hue check broke intended behavior)');
    console.log('  The original heuristic correctly favored small high-chroma objects.');
    console.log('  The hue-consistency check is incorrectly overriding this.');
  } else {
    console.log('? UNCERTAIN: Picked a cluster that does not match expected hue');
  }
  console.log('-'.repeat(80));
}

/**
 * Test calculateSizeFactor pure function
 * Unit test for the size-ramp logic without clustering
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

  // Verify the graduated ramp logic
  console.log('\nVerification of graduated ramp logic:');
  console.log('  At 0.20 threshold (exact): sizeFactor should be sqrt(0.20) = 0.447 (no ramp, condition is < not <=)');
  const thresholdFactor = calculateSizeFactor(0.20);
  console.log(`  Actual: ${thresholdFactor.toFixed(4)}`);
  console.log(`  ${Math.abs(thresholdFactor - 0.447) < 0.01 ? '✓ PASS' : '✗ FAIL'}: Threshold logic correct`);

  console.log('\n  At 0.19 (just below threshold): sizeFactor should be sqrt(0.19) * (0.19/0.20) * 0.5 = 0.436 * 0.475 = 0.207');
  const belowThresholdFactor = calculateSizeFactor(0.19);
  console.log(`  Actual: ${belowThresholdFactor.toFixed(4)}`);
  console.log(`  ${Math.abs(belowThresholdFactor - 0.207) < 0.01 ? '✓ PASS' : '✗ FAIL'}: Below-threshold ramp correct`);

  // Verify that 0.25 (above threshold) doesn't get the ramp penalty
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

  // Test case 1: Warm-tinted white card (simulating indoor tungsten lighting)
  console.log('\nTest 1: Warm-tinted white card (255, 230, 200)');
  const warmWhiteCard = { r: 255, g: 230, b: 200 };
  const warmCalibration = estimateWhiteBalance(warmWhiteCard);
  console.log(`  Estimated calibration matrix:`);
  console.log(`    rScale: ${warmCalibration.rScale.toFixed(3)}`);
  console.log(`    gScale: ${warmCalibration.gScale.toFixed(3)}`);
  console.log(`    bScale: ${warmCalibration.bScale.toFixed(3)}`);
  console.log(`  Expected: gScale > 1, bScale > 1, rScale ≈ 1`);
  const warmTest = warmCalibration.gScale > 1 && warmCalibration.bScale > 1 && Math.abs(warmCalibration.rScale - 1) < 0.1;
  console.log(`  ${warmTest ? '✓ PASS' : '✗ FAIL'}: ${warmTest ? 'Warm tint correctly identified' : 'Warm tint not correctly identified'}`);

  // Test case 2: Apply calibration to neutral gray
  console.log('\nTest 2: Apply calibration to neutral gray (128, 128, 128)');
  const neutralGray = { r: 128, g: 128, b: 128 };
  const correctedGray = applyCalibration(neutralGray, warmCalibration);
  console.log(`  Original: (${neutralGray.r}, ${neutralGray.g}, ${neutralGray.b})`);
  console.log(`  Corrected: (${correctedGray.r}, ${correctedGray.g}, ${correctedGray.b})`);
  console.log(`  Expected: Should pull toward neutral (closer to 128, 128, 128)`);
  const grayTest = correctedGray.g > neutralGray.g && correctedGray.b > neutralGray.b;
  console.log(`  ${grayTest ? '✓ PASS' : '✗ FAIL'}: ${grayTest ? 'Gray correctly warmed' : 'Gray not correctly warmed'}`);

  // Test case 3: Pathological case (badly-lit calibration photo)
  console.log('\nTest 3: Pathological case (10, 10, 10) - badly-lit calibration');
  const darkCard = { r: 10, g: 10, b: 10 };
  const darkCalibration = estimateWhiteBalance(darkCard);
  console.log(`  Estimated calibration matrix:`);
  console.log(`    rScale: ${darkCalibration.rScale.toFixed(3)}`);
  console.log(`    gScale: ${darkCalibration.gScale.toFixed(3)}`);
  console.log(`    bScale: ${darkCalibration.bScale.toFixed(3)}`);
  console.log(`  Expected: All scales clamped to 3.0 (max)`);
  const darkTest = darkCalibration.rScale === 3 && darkCalibration.gScale === 3 && darkCalibration.bScale === 3;
  console.log(`  ${darkTest ? '✓ PASS' : '✗ FAIL'}: ${darkTest ? 'Clamp correctly applied' : 'Clamp not correctly applied'}`);

  // Test case 4: Perfect white card (no correction needed)
  console.log('\nTest 4: Perfect white card (255, 255, 255)');
  const perfectWhite = { r: 255, g: 255, b: 255 };
  const perfectCalibration = estimateWhiteBalance(perfectWhite);
  console.log(`  Estimated calibration matrix:`);
  console.log(`    rScale: ${perfectCalibration.rScale.toFixed(3)}`);
  console.log(`    gScale: ${perfectCalibration.gScale.toFixed(3)}`);
  console.log(`    bScale: ${perfectCalibration.bScale.toFixed(3)}`);
  console.log(`  Expected: All scales ≈ 1.0`);
  const perfectTest = Math.abs(perfectCalibration.rScale - 1) < 0.01 &&
                      Math.abs(perfectCalibration.gScale - 1) < 0.01 &&
                      Math.abs(perfectCalibration.bScale - 1) < 0.01;
  console.log(`  ${perfectTest ? '✓ PASS' : '✗ FAIL'}: ${perfectTest ? 'No correction needed' : 'Unexpected correction'}`);

  console.log('\n' + '-'.repeat(80));
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

  // Run dim-lighting k-means bug reproduction test
  testDimLightingKMeans();

  // Run same-hue k-means test (size penalty isolation)
  testSameHueKMeans();

  // Run red-berry/green-leaf regression test
  testRedBerryGreenLeaf();

  // Run calculateSizeFactor unit test
  testCalculateSizeFactor();

  // Run calibration tests
  testCalibration();

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
