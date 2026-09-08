import { promises as fs, createReadStream } from 'fs';
import { gunzipSync, inflateRawSync, createBrotliCompress, createBrotliDecompress, constants } from 'zlib';

const nationStatesApi = "https://www.nationstates.net/cgi-bin/api.cgi?q=nations";
const nationStatesWaApi = "https://www.nationstates.net/cgi-bin/api.cgi?wa=1&q=members";
const userAgent = "script=ns-unsmurf-github by=rotenaple";

// Paths for data files
const dataWorktreePath = '.data'; // Worktree path for data branch
const mainFilePath = `${dataWorktreePath}/static/currentNations.txt`; // Path in data branch
const waFilePath = `${dataWorktreePath}/static/currentWANations.txt`; // Path in data branch
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

function tryDecompress(raw) {
  if (raw.length < 2) {
    return { ok: false, raw };
  }
  if (raw[0] !== 0x1f || raw[1] !== 0x8b) {
    console.warn(`  response is not gzip (first bytes: 0x${raw[0].toString(16)} 0x${raw[1].toString(16)}), treating as plaintext`);
    return { ok: true, data: raw };
  }
  try {
    return { ok: true, data: gunzipSync(raw) };
  } catch (err) {
    const label = err.code === 'Z_DATA_ERROR' ? 'Z_DATA_ERROR (corrupt/truncated)' : err.code;
    console.warn(`  gzip full decompress failed: ${label} (${raw.length} raw bytes)`);
    try {
      const partial = inflateRawSync(raw.subarray(10));
      return { ok: true, data: partial };
    } catch {
      console.warn(`  partial inflate also failed (${raw.length} raw bytes)`);
      return { ok: false, raw };
    }
  }
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

    const raw = Buffer.from(await response.arrayBuffer());
    console.log(`  Raw compressed response: ${raw.length} bytes`);

    const { ok, data } = tryDecompress(raw);

    if (!ok) {
      console.error(`Cannot decompress response body (${raw.length} raw bytes, first 40 hex: ${raw.subarray(0, 40).toString('hex')}). Aborting.`);
      return [];
    }

    const dataStr = data.toString('utf8');
    const dataBytes = Buffer.byteLength(dataStr, 'utf8');
    console.log(`  Decompressed response: ${(dataBytes / 1024 / 1024).toFixed(2)} MB`);

    const hasClosingTag = dataStr.includes('</NATIONS>');
    if (!hasClosingTag) {
      console.error(`Response body is truncated — missing </NATIONS> (${raw.length} raw bytes, ${dataBytes} decompressed bytes). Aborting to preserve existing data.`);
      return [];
    }

    // Extract nations from XML
    const match = dataStr.match(/<NATIONS>(.*?)<\/NATIONS>/s);
    if (!match) {
      console.error('No nations found in NationStates API response.');
      return [];
    }

    const currentNations = match[1].split(',').map((nation) => {
      return nation.trim().toLowerCase().replace(/\s+/g, '_');
    }).sort();

    // Validate response completeness before overwriting files
    const hasY = currentNations.some(n => n.startsWith('y'));
    const hasZ = currentNations.some(n => n.startsWith('z'));
    console.log(`  ${currentNations.length} nations, y=${hasY}, z=${hasZ}`);
    if (currentNations.length < 250000 || !hasY || !hasZ) {
      console.error(`Response appears truncated (${currentNations.length} nations, y=${hasY}, z=${hasZ}). Aborting to preserve existing data.`);
      return [];
    }

    // Step 0: Worktree setup is now handled by GitHub Actions


    // Guard: reject if current nations data is >50% smaller than existing
    const currentBytes = Buffer.byteLength(currentNations.join('\n'), 'utf8');
    try {
      const existing = await fs.stat(mainFilePath);
      if (currentBytes < existing.size * 0.5) {
        console.error(`currentNations is ${((1 - currentBytes / existing.size) * 100).toFixed(0)}% smaller than existing (${currentBytes} vs ${existing.size} bytes). Aborting to preserve existing data.`);
        return [];
      }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    await fs.writeFile(mainFilePath, currentNations.join('\n'), { encoding: 'utf8', flag: 'w' });
    const jsonPath = mainFilePath.replace('.txt', '.json');
    await fs.writeFile(jsonPath, JSON.stringify(currentNations), { encoding: 'utf8', flag: 'w' });

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
    // Guard: allNations archive should never have fewer nations
    if (existingAllNations.length > allNations.length) {
      console.error(`allNations lost nations (${allNations.length} vs ${existingAllNations.length} previously). Aborting to preserve existing data.`);
      return [];
    }

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

// Fetch WA member nations and store alongside currentNations.
// Non-fatal on failure: existing WA file is preserved and fetchGoogleSheets.js will warn if it is missing.
async function fetchWANationsData() {
  try {
    console.log('Fetching WA membership from NationStates API...');
    const response = await fetch(nationStatesWaApi, {
      headers: {
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch WA membership: ${response.statusText}`);
      return false;
    }

    const raw = Buffer.from(await response.arrayBuffer());
    console.log(`  Raw response: ${raw.length} bytes`);

    const { ok, data } = tryDecompress(raw);

    if (!ok) {
      console.error(`Cannot decompress WA response body (${raw.length} raw bytes). Aborting WA update.`);
      return false;
    }

    const dataStr = data.toString('utf8');
    if (!dataStr.includes('</MEMBERS>')) {
      console.error(`WA response is truncated — missing </MEMBERS> (${raw.length} raw bytes). Aborting WA update.`);
      return false;
    }

    const match = dataStr.match(/<MEMBERS>(.*?)<\/MEMBERS>/s);
    if (!match) {
      console.error('No members found in WA membership response.');
      return false;
    }

    const waNations = match[1].split(',').map((nation) => {
      return nation.trim().toLowerCase().replace(/\s+/g, '_');
    }).sort();

    console.log(`  ${waNations.length} WA member nations`);
    if (waNations.length < 5000) {
      console.error(`WA response appears truncated (${waNations.length} nations). Aborting WA update.`);
      return false;
    }

    // Guard: reject if WA list is >50% smaller than existing
    const waBytes = Buffer.byteLength(waNations.join('\n'), 'utf8');
    try {
      const existing = await fs.stat(waFilePath);
      if (waBytes < existing.size * 0.5) {
        console.error(`currentWANations is ${((1 - waBytes / existing.size) * 100).toFixed(0)}% smaller than existing (${waBytes} vs ${existing.size} bytes). Aborting WA update.`);
        return false;
      }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    await fs.writeFile(waFilePath, waNations.join('\n'), { encoding: 'utf8', flag: 'w' });
    const jsonPath = waFilePath.replace('.txt', '.json');
    await fs.writeFile(jsonPath, JSON.stringify(waNations), { encoding: 'utf8', flag: 'w' });

    console.log(`✅ Wrote ${waNations.length} WA member nations to ${waFilePath}`);
    return true;
  } catch (error) {
    console.error('Error processing WA membership data:', error);
    return false;
  }
}

// Run the function
fetchNationStatesData()
  .then(() => fetchWANationsData())
  .catch((error) => {
    console.error('Error processing NationStates API data:', error);
    process.exit(1);
  });