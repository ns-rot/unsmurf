// fetchNationStates.js

import { promises as fs } from 'fs'; // Node.js filesystem module
import fetch from 'node-fetch'; // Use node-fetch for HTTP requests

import { createReadStream } from 'fs';
import { createBrotliCompress, createBrotliDecompress, constants } from 'zlib'; // For Brotli compression

const nationStatesApi = "https://www.nationstates.net/cgi-bin/api.cgi?q=nations";
const userAgent = "script=ns-unsmurf-github by=rotenaple";

// Paths for data files
const dataWorktreePath = '.data'; // Worktree path for data branch
const mainFilePath = `${dataWorktreePath}/static/currentNations.txt`; // Path in data branch
const allNationsCompressedPath = `${dataWorktreePath}/static/allNations.txt.br`; // Final compressed path
// Removed ghPagesFilePath as we no longer sync to gh-pages



// Helper function to read and decompress the Brotli file
async function readBrotliFile(filePath) {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    const brotli = createBrotliDecompress();
    const chunks = [];

    stream.on('error', (err) => {
      // If the file doesn't exist (e.g., first run), resolve with an empty string.
      if (err.code === 'ENOENT') {
        resolve('');
      } else {
        reject(err);
      }
    });

    brotli.on('data', (chunk) => chunks.push(chunk));
    brotli.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    brotli.on('error', (err) => reject(err));

    stream.pipe(brotli);
  });
}


// Merge two sorted arrays into one sorted, deduplicated array in O(n)
function mergeSortedDedup(a, b) {
  const result = new Array(a.length + b.length);
  let i = 0, j = 0, k = 0;
  while (i < a.length || j < b.length) {
    const val = (j >= b.length || (i < a.length && a[i] <= b[j])) ? a[i++] : b[j++];
    if (k === 0 || val !== result[k - 1]) result[k++] = val;
  }
  result.length = k;
  return result;
}

async function fetchNationStatesData() {
  try {
    console.log('Fetching data from NationStates API...');
    const response = await fetch(nationStatesApi, {
      headers: {
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch NationStates API: ${response.statusText}`);
      return [];
    }

    const data = await response.text();

    // Extract nations from XML
    const match = data.match(/<NATIONS>(.*?)<\/NATIONS>/s);
    if (!match) {
      console.error('No nations found in NationStates API response.');
      return [];
    }

    const currentNations = match[1].split(',').map((nation) => {
      return nation.trim().toLowerCase().replace(/\s+/g, '_');
    }).sort();

    // Validate response completeness before overwriting files
    const responseBytes = Buffer.byteLength(data, 'utf8');
    const hasY = currentNations.some(n => n.startsWith('y'));
    const hasZ = currentNations.some(n => n.startsWith('z'));
    console.log(`Response: ${(responseBytes / 1024 / 1024).toFixed(2)} MB, ${currentNations.length} nations`);
    if (currentNations.length < 250000 || !hasY || !hasZ) {
      console.error(`Response appears truncated (${currentNations.length} nations, y=${hasY}, z=${hasZ}). Aborting to preserve existing data.`);
      return [];
    }

    // Step 0: Worktree setup is now handled by GitHub Actions


    // Step 1A: Write NationStates data to data branch
    await fs.writeFile(mainFilePath, currentNations.join('\n'), { encoding: 'utf8', flag: 'w' });

    // Write JSON version for optimized fetching
    const jsonPath = mainFilePath.replace('.txt', '.json');
    await fs.writeFile(jsonPath, JSON.stringify(currentNations), { encoding: 'utf8', flag: 'w' });
    console.log(`✅ Written ${jsonPath}`);

    // Step 1B: Merge current with historical and compress
    console.log(`Reading existing nations from ${allNationsCompressedPath}...`);
    const existingData = await readBrotliFile(allNationsCompressedPath);
    const existingAllNations = existingData.split('\n').map(n => n.trim()).filter(n => n !== '');
    if (existingAllNations.length > 0) {
      console.log(`Loaded ${existingAllNations.length} historical nations.`);
    }

    // Merge sorted arrays (O(n)) instead of Set + sort (O(n log n))
    const allNations = mergeSortedDedup(existingAllNations, currentNations);

    // Compress in memory at quality 4 (2x faster than default 11, ~15% larger)
    const input = Buffer.from(allNations.join('\n'), 'utf8');
    const compressed = await new Promise((resolve, reject) => {
      const brotli = createBrotliCompress({
        params: { [constants.BROTLI_PARAM_QUALITY]: 4 }
      });
      const chunks = [];
      brotli.on('data', c => chunks.push(c));
      brotli.on('end', () => resolve(Buffer.concat(chunks)));
      brotli.on('error', reject);
      brotli.end(input);
    });
    await fs.writeFile(allNationsCompressedPath, compressed);
    console.log(`✅ Compressed updated list of ${allNations.length} nations to ${allNationsCompressedPath}`);

    // Step 2: Commit & push logic removed. This is now handled by the GitHub Action workflow.
    console.log('File updates completed.');

    return currentNations;
  } catch (error) {
    console.error('Error processing NationStates API data:', error);
    process.exit(1);
    return [];
  }
}

// Run the function
fetchNationStatesData().catch((error) => {
  console.error('Error processing NationStates API data:', error);
  process.exit(1);
});