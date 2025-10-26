/**
 * Shuffle numbers inside <text> nodes in an SVG, preserving the distribution
 * (i.e., same multiset of numbers, different positions).
 *
 * Usage:
 *   node scripts/shuffle-svg-texts.js path/to/file.svg [--seed <number>] [--dry]
 *
 * Notes:
 * - Makes a backup next to the file (file.svg.bak or file.svg.bak.<timestamp>).
 * - Only replaces <text>...</text> nodes whose inner text is a single number
 *   (integer or decimal). All other text nodes are left unchanged.
 */

const fs = require('fs');
const path = require('path');

function usageAndExit() {
  console.log('Usage: node scripts/shuffle-svg-texts.js <svg-file> [--seed <number>] [--dry]');
  process.exit(1);
}

// Simple seeded PRNG (Mulberry32)
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor((rng ? rng() : Math.random()) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function countMap(values) {
  const m = new Map();
  for (const v of values) m.set(v, (m.get(v) || 0) + 1);
  return m;
}

function mapsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

function makeBackup(filePath) {
  const bakBase = filePath + '.bak';
  if (!fs.existsSync(bakBase)) {
    fs.writeFileSync(bakBase, fs.readFileSync(filePath));
    return bakBase;
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bakTs = `${bakBase}.${ts}`;
  fs.writeFileSync(bakTs, fs.readFileSync(filePath));
  return bakTs;
}

(function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) usageAndExit();

  const filePath = path.resolve(process.cwd(), args[0]);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  let seed = null;
  let dry = false;
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--seed') {
      const s = args[i + 1];
      if (!s || isNaN(Number(s))) {
        console.error('Invalid or missing seed after --seed');
        process.exit(1);
      }
      seed = Number(s);
      i++;
    } else if (a === '--dry') {
      dry = true;
    }
  }

  const original = fs.readFileSync(filePath, 'utf8');

  // Match <text ...>inner</text> (dotAll to allow newlines)
  const textTagRegex = /<text\b[^>]*>([\s\S]*?)<\/text>/g;
  // Accept integers or decimals with optional sign, surrounded by whitespace
  const numericOnly = /^\s*[-+]?\d+(?:\.\d+)?\s*$/;

  const texts = [];
  const matches = [];

  let m;
  while ((m = textTagRegex.exec(original)) !== null) {
    const fullMatch = m[0];
    const inner = m[1];
    if (numericOnly.test(inner)) {
      const value = inner.trim(); // keep numeric as string
      texts.push(value);
      matches.push({ index: m.index, length: fullMatch.length, innerStart: m.index + fullMatch.indexOf(inner), innerLength: inner.length });
    }
  }

  console.log('Original count:', texts.length);
  if (texts.length === 0) {
    console.log('No numeric-only <text> nodes found. Nothing to do.');
    process.exit(0);
  }

  const beforeCounts = countMap(texts);

  // Create shuffled copy
  const shuffled = texts.slice();
  const rng = seed == null ? null : mulberry32(seed >>> 0);
  shuffleInPlace(shuffled, rng);

  // Perform replacements sequentially
  let out = original;
  let cursor = 0;
  let replaced = 0;
  // Build output by iterating through matches to avoid nested match index drift
  const parts = [];
  for (let i = 0; i < matches.length; i++) {
    const { index, length, innerStart, innerLength } = matches[i];
    // up to the start of this <text> tag
    parts.push(out.slice(cursor, innerStart));
    // write shuffled numeric content
    parts.push(String(shuffled[i]));
    cursor = innerStart + innerLength; // move past the inner text
    replaced++;
  }
  parts.push(out.slice(cursor));
  out = parts.join('');

  // Validate counts
  const afterTexts = [];
  let m2;
  while ((m2 = textTagRegex.exec(out)) !== null) {
    const inner = m2[1];
    if (numericOnly.test(inner)) afterTexts.push(inner.trim());
  }
  const afterCounts = countMap(afterTexts);
  const equal = mapsEqual(beforeCounts, afterCounts);

  console.log('Counts equal:', equal);
  if (!equal) {
    console.error('Error: number distribution changed unexpectedly. Aborting.');
    process.exit(1);
  }

  if (dry) {
    console.log('[dry] No changes written.');
    process.exit(0);
  }

  const bakPath = makeBackup(filePath);
  fs.writeFileSync(filePath, out, 'utf8');
  console.log('Backup saved to:', bakPath);
  console.log('SVG updated:', filePath);
})();
