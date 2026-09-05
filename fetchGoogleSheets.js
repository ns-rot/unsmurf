// fetchGoogleSheets.js

import { promises as fs, existsSync, createReadStream } from 'fs';
import { createInterface } from 'readline';

import { gunzipSync, inflateRawSync, createBrotliDecompress } from 'zlib';

const CONFIG = {
  sheets: [
    { name: "9003's Sheet", url: "https://docs.google.com/spreadsheets/d/1MZ-4GLWAZDgB1TDvwtssEcVKHKunOKi3l90Jof1pBB4/export?format=tsv&id=1MZ-4GLWAZDgB1TDvwtssEcVKHKunOKi3l90Jof1pBB4&gid=733627866", puppetColumn: 0, mainColumn: 1, headerRows: 1 },
    { name: "XKI's Sheet", url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSem15AVLXgdjxWBZOnWRFnF6NwkY0gVKPYI8aWuHJzlbyILBL3o1F5GK1hSK3iiBlXLIZBI5jdpkVr/pub?gid=916202163&single=true&output=tsv", puppetColumn: 0, mainColumn: 1, headerRows: 0 },
    { name: "Rot's Sheet", url: "https://docs.google.com/spreadsheets/d/1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4/export?format=tsv&id=1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4", puppetColumn: 0, mainColumn: 1, headerRows: 1 },
  ],
  regexSheets: [{ name: "Rot's Regex Sheet", url: "https://docs.google.com/spreadsheets/d/1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ/export?format=tsv&id=1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ", regexColumn: 0, mainColumn: 1, headerRows: 1 }],
  excludeSheets: [{ name: "Exclude", url: "https://docs.google.com/spreadsheets/d/1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ/export?format=tsv&id=1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ&gid=1034512747", puppetColumn: 0, masterColumn: 1, headerRows: 1 }],
  redirSheets: [{ name: "Redir", url: "https://docs.google.com/spreadsheets/d/1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ/export?format=tsv&id=1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ&gid=1440877244", oldMasterColumn: 0, newMasterColumn: 1, headerRows: 1 }],
  paths: {
    worktree: '.data',
    main: '.data/static/puppetData.tsv',
    nations: '.data/static/allNations.txt.br',
  },
  maxGroupsPerPattern: 800,
  maxPatternsPerGroup: 25,
  maxPatternsPerRegex: 100,
};

const cleanStr = (str, context = {}) => {
  if (!str) return str;
  const cleaned = str.replace(/\u00AD/g, '');
  if (cleaned.length !== str.length) {
    console.warn(`  WARNING: SOFT HYPHEN (U+00AD) found and removed` +
      (context.sheet ? `\n    Sheet: ${context.sheet}` : '') +
      (context.row ? `\n    Row: ${context.row}` : ''));
  }
  return cleaned;
};

const normalize = (str, context) => cleanStr(str, context)?.trim().toLowerCase().replace(/\s+/g, '_');

function tryDecompress(raw) {
  if (raw.length < 2) return { ok: false, raw };
  if (raw[0] !== 0x1f || raw[1] !== 0x8b) {
    return { ok: true, data: raw };
  }
  try {
    return { ok: true, data: gunzipSync(raw) };
  } catch (err) {
    console.warn(`  gzip decompress failed: ${err.code} (${raw.length} raw bytes)`);
    try {
      const partial = inflateRawSync(raw.subarray(10));
      return { ok: true, data: partial };
    } catch {
      console.warn(`  partial inflate also failed`);
      return { ok: false, raw };
    }
  }
}

async function safeFetch(url, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label}: ${res.statusText}`);
  const raw = Buffer.from(await res.arrayBuffer());
  const { ok, data } = tryDecompress(raw);
  if (!ok) throw new Error(`${label}: cannot decompress response (${raw.length} bytes)`);
  return data.toString('utf8');
}



async function streamBrotli(path, fn) {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(path).pipe(createBrotliDecompress()), crlfDelay: Infinity });
    rl.on('line', (line) => { if (line.trim()) fn(line.trim()); });
    rl.on('close', resolve);
    rl.on('error', reject);
  });
}

async function fetchSheet(sheet) {
  try {
    const text = await safeFetch(sheet.url, sheet.name);
    const lines = text.split('\n').slice(sheet.headerRows);
    return lines.map(line => {
      const cols = line.split('\t');
      return { line, cols };
    }).filter(({ line }) => line.trim());
  } catch (e) {
    console.error(`Error fetching ${sheet.name}: ${e.message}`);
    return [];
  }
}

function countGroups(pattern) {
  let count = 0, i = 0;
  while (i < pattern.length) {
    if (pattern[i] === '(' && !(pattern[i + 1] === '?')) count++;
    i++;
  }
  return count;
}

class RegexProcessor {
  constructor(rules) {
    const valid = [];
    const templates = [];

    for (const { pattern, template } of rules) {
      if (!pattern || !template) continue;
      try {
        new RegExp(pattern, 'i');
        valid.push(`(${pattern.replace(/\((?!\?)/g, '(?:')})`);
        templates.push(template);
      } catch (e) {
        console.error(`Invalid regex: ${pattern}`);
      }
    }

    if (valid.length === 0) { this.regex = null; return; }
    try {
      this.regex = new RegExp(valid.join('|'), 'i');
      this.templates = templates;
      console.log(`  Compiled ${valid.length} patterns into single regex`);
    } catch (e) {
      console.error(`Failed to compile regex: ${e.message}`);
      this.regex = null;
    }
  }

  exec(text) { return this.regex?.exec(text); }
  getMatchIndex(result) {
    if (!result) return -1;
    for (let i = 1; i < result.length; i++) if (result[i] !== undefined) return i - 1;
    return -1;
  }
}

async function processGoogleSheets() {
  const startTime = Date.now();
  const tsvLines = ['puppet\tmaster\tsheet'];
  const seenPuppets = new Map();
  const identifications = new Map();
  const log = (msg) => console.log(msg);
  const logStep = (num, title) => log(`\n=== STEP ${num}: ${title} ===`);
  const addIdentification = (puppet, master, sheet) => {
    const entries = identifications.get(puppet);
    if (!entries) { identifications.set(puppet, [{ master, sheet }]); return; }
    if (!entries.some(e => e.master === master && e.sheet === sheet)) entries.push({ master, sheet });
  };

  try {
    // STEP 1: Direct puppets
    logStep(1, 'Processing direct puppet mappings');
    for (const sheet of CONFIG.sheets) {
      const data = await fetchSheet(sheet);
      let count = 0;
      for (const { cols, line } of data) {
        const puppet = normalize(cols[sheet.puppetColumn], { sheet: sheet.name, row: line });
        const master = normalize(cols[sheet.mainColumn], { sheet: sheet.name, row: line });
        if (!puppet || !master) continue;
        addIdentification(puppet, master, sheet.name);
        if (!seenPuppets.has(puppet)) {
          seenPuppets.set(puppet, { master, sheet: sheet.name });
          tsvLines.push(`${puppet}\t${master}\t${sheet.name}`);
          count++;
        }
      }
      log(`  Added ${count} puppets from ${sheet.name}`);
    }
    log(`Total direct puppets: ${seenPuppets.size}`);

    // STEP 2: Exclusions
    // Worktree setup is now handled by GitHub Actions

    logStep(2, 'Loading exclusion rules');
    const excludeSet = new Set();
    for (const sheet of CONFIG.excludeSheets) {
      const data = await fetchSheet(sheet);
      for (const { cols, line } of data) {
        const puppet = normalize(cols[sheet.puppetColumn], { sheet: sheet.name, row: line });
        const master = normalize(cols[sheet.masterColumn], { sheet: sheet.name, row: line });
        if (puppet && master) excludeSet.add(`${puppet}\t${master}`);
      }
    }
    log(`Loaded ${excludeSet.size} exclusion rules`);

    let pruned = 0;
    for (let i = tsvLines.length - 1; i >= 1; i--) {
      const [puppet, master] = tsvLines[i].split('\t');
      if (excludeSet.has(`${puppet}\t${master}`)) {
        tsvLines.splice(i, 1);
        seenPuppets.delete(puppet);
        pruned++;
      }
    }
    for (const [puppet, entries] of identifications) {
      const kept = entries.filter(e => !excludeSet.has(`${puppet}\t${e.master}`));
      if (kept.length) identifications.set(puppet, kept);
      else identifications.delete(puppet);
    }
    if (pruned) log(`Removed ${pruned} rows matching exclusion rules`);

    // STEP 3: Load regex patterns
    logStep(3, 'Loading and compiling regex patterns');
    const patterns = [];
    for (const sheet of CONFIG.regexSheets) {
      const data = await fetchSheet(sheet);
      let valid = 0, invalid = 0;
      for (const { cols, line } of data) {
        const regex = cleanStr(cols[sheet.regexColumn], { sheet: sheet.name, row: line })?.trim();
        const master = normalize(cols[sheet.mainColumn], { sheet: sheet.name, row: line });
        if (!regex || !master) continue;
        try {
          const compiled = new RegExp(regex, 'i');
          patterns.push({ pattern: regex, master, sheetName: sheet.name, regex: compiled });
          valid++;
        } catch (e) {
          console.error(`Invalid regex in ${sheet.name}: ${master}`);
          invalid++;
        }
      }
      log(`  ${valid} valid, ${invalid} invalid patterns`);
    }
    log(`Total patterns: ${patterns.length}`);

    // STEP 3.5: Consolidate patterns
    logStep('3.5', 'Consolidating patterns by master');
    const byMaster = new Map();
    const groupCounts = new Map();

    for (const p of patterns) {
      groupCounts.set(p.pattern, countGroups(p.pattern));
      if (!byMaster.has(p.master)) byMaster.set(p.master, []);
      byMaster.get(p.master).push(p);
    }

    const consolidated = [];
    let saved = 0;

    for (const [master, pts] of byMaster) {
      if (pts.length === 1) {
        consolidated.push({ ...pts[0], sourcePatterns: pts });
        continue;
      }

      let group = [], groupCount = 0;
      for (const p of pts) {
        const pCount = groupCounts.get(p.pattern) || 0;
        if (group.length > 0 && (groupCount + pCount > CONFIG.maxGroupsPerPattern || group.length >= CONFIG.maxPatternsPerGroup)) {
          consolidated.push({
            pattern: group.map(x => x.pattern).join('|'),
            master,
            sheetName: group[0].sheetName,
            groupCount,
            sourcePatterns: group
          });
          saved += group.length - 1;
          group = [];
          groupCount = 0;
        }
        group.push(p);
        groupCount += pCount;
      }
      if (group.length > 0) {
        consolidated.push({
          pattern: group.map(x => x.pattern).join('|'),
          master,
          sheetName: group[0].sheetName,
          groupCount,
          sourcePatterns: group
        });
        saved += group.length - 1;
      }
    }

    log(`${patterns.length} → ${consolidated.length} patterns (${(100 * saved / patterns.length).toFixed(1)}% reduction)`);

    // STEP 4: Build regex processors
    logStep(4, 'Building multiple regex processors');
    const processors = [];
    const matchedPatterns = new Set();
    for (let i = 0; i < consolidated.length; i += CONFIG.maxPatternsPerRegex) {
      const chunk = consolidated.slice(i, i + CONFIG.maxPatternsPerRegex);
      processors.push({
        processor: new RegexProcessor(chunk.map(p => ({ pattern: p.pattern, template: p.master }))),
        patterns: chunk
      });
    }
    log(`Split into ${processors.length} processors`);

    // STEP 5: Regex matching
    logStep(5, 'Testing nations against regex patterns (streaming)');
    let matched = 0, tested = 0, errors = 0;
    const matchStats = {};
    const testStart = Date.now();

    await streamBrotli(CONFIG.paths.nations, (nation) => { nation = cleanStr(nation);
      tested++;

      try {
        for (const { processor, patterns: pts } of processors) {
          if (!processor.regex) continue;
          const result = processor.exec(nation);
          if (result) {
            const idx = processor.getMatchIndex(result);
            if (idx >= 0 && idx < pts.length) {
              const detail = pts[idx];
              const isSeen = seenPuppets.has(nation);
              const key = `${nation}\t${detail.master}`;
              if (!excludeSet.has(key)) {
                if (detail.sourcePatterns.length === 1) {
                  matchedPatterns.add(detail.sourcePatterns[0]);
                } else {
                  for (const sp of detail.sourcePatterns) {
                    if (sp.regex.test(nation)) matchedPatterns.add(sp);
                  }
                }
                addIdentification(nation, detail.master, detail.sheetName);
                if (!isSeen) {
                  seenPuppets.set(nation, { master: detail.master, sheet: detail.sheetName });
                  tsvLines.push(`${nation}\t${detail.master}\t${detail.sheetName}`);
                  matched++;
                  matchStats[detail.master] = (matchStats[detail.master] || 0) + 1;
                }
                break;
              }
              if (isSeen) break;
            }
          }
        }
      } catch (e) {
        if (errors === 0) console.error(`Error during regex matching: ${e.message}`, e);
        errors++;
      }

      if (tested % 50000 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (tested / (Date.now() - startTime) * 1000).toFixed(0);
        log(`  Progress: ${tested.toLocaleString()} tested, ${matched} matched, ${elapsed}s, ${rate}ns/sec`);
      }
    });

    const duration = ((Date.now() - testStart) / 1000).toFixed(1);
    log(`\nMatched ${matched} in ${duration}s (${((tested * 1000) / (Date.now() - testStart)).toFixed(0)}ns/sec)`);
    if (errors > 0) log(`Errors: ${errors}`);

    const unmatchedPatterns = patterns.filter(pattern => !matchedPatterns.has(pattern));
    if (unmatchedPatterns.length > 0) {
      console.warn(`WARNING: ${unmatchedPatterns.length} regex pattern(s) returned no results`);
      for (const { pattern, master, sheetName } of unmatchedPatterns) {
        console.warn(`  ${sheetName} -> ${master}: ${pattern}`);
      }
    }

    const top = Object.entries(matchStats).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (top.length) {
      log('\n  Top masters:');
      top.forEach(([m, c]) => log(`    - ${m}: ${c}`));
    }

    // STEP 6: Redirects
    logStep(6, 'Loading redirect rules');
    const redirs = new Map();
    for (const sheet of CONFIG.redirSheets) {
      const data = await fetchSheet(sheet);
      for (const { cols, line } of data) {
        const old = normalize(cols[sheet.oldMasterColumn], { sheet: sheet.name, row: line });
        const neu = normalize(cols[sheet.newMasterColumn], { sheet: sheet.name, row: line });
        if (old && neu) redirs.set(old, neu);
      }
    }
    log(`Loaded ${redirs.size} redirects`);

    // STEP 7: Apply redirects
    if (redirs.size > 0) {
      logStep(7, 'Applying redirect rules');
      let redirectCount = 0;
      for (let i = 1; i < tsvLines.length; i++) {
        const [puppet, master, sheet] = tsvLines[i].split('\t');
        if (redirs.has(master)) {
          tsvLines[i] = `${puppet}\t${redirs.get(master)}\t${sheet}`;
          redirectCount++;
        }
      }
      log(`Applied ${redirectCount} redirects`);
    }

    // STEP 7.5: Post-redirect overlap & conflict analysis
    logStep('7.5', 'Analyzing post-redirect identifications');
    const sheetRank = new Map();
    let rankCounter = 0;
    for (const list of [CONFIG.sheets, CONFIG.regexSheets, CONFIG.excludeSheets, CONFIG.redirSheets]) {
      for (const s of list) if (!sheetRank.has(s.name)) sheetRank.set(s.name, rankCounter++);
    }
    const rankOf = (n) => sheetRank.get(n) ?? rankCounter;
    const orderedSheets = (names) => names.sort((a, b) => rankOf(a) - rankOf(b));
    const joinSheets = (names) => names.length === 2
      ? names.join(' and ')
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

    const tally = new Map();
    const singleSheetTally = new Map();
    const conflictList = [];
    for (const [puppet, entries] of identifications) {
      const states = new Map();
      for (const { master, sheet } of entries) {
        if (excludeSet.has(`${puppet}\t${master}`)) continue;
        const resolved = redirs.get(master) || master;
        if (!states.has(resolved)) states.set(resolved, new Set());
        states.get(resolved).add(sheet);
      }
      if (states.size === 1) {
        const sheets = [...states.values()][0];
        if (sheets.size >= 2) {
          const key = joinSheets(orderedSheets([...sheets]));
          tally.set(key, (tally.get(key) || 0) + 1);
        } else {
          const [sheet] = sheets;
          singleSheetTally.set(sheet, (singleSheetTally.get(sheet) || 0) + 1);
        }
      } else {
        conflictList.push({ puppet, states });
      }
    }

    if (conflictList.length) {
      const conflictKey = ({ states }) => [...states.keys()].sort()[0];
      conflictList.sort((a, b) => {
        const ma = conflictKey(a), mb = conflictKey(b);
        if (ma !== mb) return ma < mb ? -1 : 1;
        return a.puppet < b.puppet ? -1 : (a.puppet > b.puppet ? 1 : 0);
      });
      log(`\nNation conflicts after redirects (${conflictList.length}):`);
      for (const { puppet, states } of conflictList) {
        const parts = [...states.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([master, sheets]) => `${master} (${orderedSheets([...sheets]).join(', ')})`);
        log(`  ${puppet}: ${parts.join('; ')}`);
      }
    }

    const conflictsPath = CONFIG.paths.main.replace('.tsv', '.conflicts.tsv');
    const existingFirstFound = new Map();
    try {
      const prev = await fs.readFile(conflictsPath, 'utf8');
      for (const line of prev.split('\n').slice(1)) {
        const [nation, ts] = line.split('\t');
        if (nation && ts) existingFirstFound.set(nation, ts);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    const firstFoundNow = Math.floor(Date.now() / 1000);
    const sheetStr = (sheets) => orderedSheets([...sheets]).join(', ');
    const rows = conflictList.map(({ puppet, states }) => {
      const sorted = [...states.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
      const [[m1, s1], [m2, s2] = ['', '']] = sorted;
      const extra = sorted.slice(2).map(([m, sheets]) => `\t${m}\t${sheetStr(sheets)}`).join('');
      const firstFound = existingFirstFound.get(puppet) || firstFoundNow;
      return `${puppet}\t${firstFound}\t${m1}\t${sheetStr(s1)}\t${m2}\t${sheetStr(s2)}${extra}`;
    });
    const conflictsContent = `nation\tcollisionFirstFoundUnix\tmaster1\tsheet1\tmaster2\tsheet2\n${rows.join('\n')}\n`;
    await fs.writeFile(conflictsPath, conflictsContent, 'utf8');
    log(`Wrote conflicts TSV (${rows.length} rows)`);

    if (tally.size) {
      log(`\nNations identified by multiple sheets after redirects:`);
      for (const [key, c] of [...tally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) {
        log(`  identified ${key}: ${c} nations`);
      }
    }

    if (singleSheetTally.size) {
      log(`\nNations identified by a single sheet after redirects:`);
      for (const [key, c] of [...singleSheetTally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) {
        log(`  identified ${key}: ${c} nations`);
      }
    }

    // STEP 8: Sort
    logStep(8, 'Sorting data');
    const data = tsvLines.slice(1).map(line => {
      const [puppet, master, sheet] = line.split('\t');
      return { puppet, master, sheet, original: line };
    });
    data.sort((a, b) =>
      a.master !== b.master
        ? (a.master < b.master ? -1 : 1)
        : (a.puppet < b.puppet ? -1 : (a.puppet > b.puppet ? 1 : 0))
    );

    // Attach extra source sheets: additional sheets that identified this puppet under its winning master.
    // Alternate masters are deliberately not emitted (the primary winner stays canonical in the output files).
    const extraSheets = new Map();
    for (const { puppet, master, sheet } of data) {
      const entries = identifications.get(puppet);
      if (!entries) continue;
      const extras = [];
      for (const e of entries) {
        if (e.sheet === sheet) continue;
        if ((redirs.get(e.master) || e.master) !== master) continue;
        if (!extras.includes(e.sheet)) extras.push(e.sheet);
      }
      if (extras.length) extraSheets.set(puppet, orderedSheets([...extras]));
    }
    let maxExtras = 0;
    for (const v of extraSheets.values()) if (v.length > maxExtras) maxExtras = v.length;

    const header = ['puppet', 'master', 'sheet'];
    for (let i = 2; i < 2 + maxExtras; i++) header.push(`sheet${i}`);
    const rowOf = (d) => {
      const cols = [d.puppet, d.master, d.sheet, ...(extraSheets.get(d.puppet) || [])];
      while (cols.length < header.length) cols.push('');
      return cols.join('\t');
    };
    const content = [header.join('\t'), ...data.map(rowOf)].join('\n');
    log(`Total entries: ${data.length}`);
    if (extraSheets.size) log(`  ${extraSheets.size} puppets carry additional source sheets`);

    // STEP 9: Commit to data branch (Orphan strategy)
    logStep(9, 'Writing and committing');

    // Guard: abort if new data is >50% smaller than existing files
    const newTsvBytes = Buffer.byteLength(content, 'utf8');
    try {
      const existing = await fs.stat(CONFIG.paths.main);
      if (newTsvBytes < existing.size * 0.5) {
        console.error(`puppetData.tsv is ${((1 - newTsvBytes / existing.size) * 100).toFixed(0)}% smaller than existing (${newTsvBytes} vs ${existing.size} bytes). Aborting to preserve existing data.`);
        process.exit(1);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    await fs.writeFile(CONFIG.paths.main, content, 'utf8');

    // Generate and write JSON with Frequency Sorting (Huffman-like optimization for indices)

    // 1. Count frequencies
    const masterCounts = {};
    const sheetCounts = {};

    for (const { master, sheet } of data) {
      masterCounts[master] = (masterCounts[master] || 0) + 1;
      sheetCounts[sheet] = (sheetCounts[sheet] || 0) + 1;
    }

    // 2. Create sorted lists (most frequent first -> lower index)
    const mastersList = Object.keys(masterCounts).sort((a, b) => masterCounts[b] - masterCounts[a]);
    const sheetsList = Object.keys(sheetCounts).sort((a, b) => sheetCounts[b] - sheetCounts[a]);

    // 3. Create Maps for O(1) index lookup
    const mastersMap = new Map(mastersList.map((m, i) => [m, i]));
    const sheetsMap = new Map(sheetsList.map((s, i) => [s, i]));

    // 4. Build puppets list using these sorted indices, with source sheets encoded as a bitmask
    // (bit n = sheets[n] identified this puppet under its winning master; bit 0 = the winner's sheet).
    const extraCount = [...extraSheets.values()].reduce((sum, v) => sum + v.length, 0);
    const puppetsList = data.map(({ puppet, master, sheet }) => {
      let mask = 1 << sheetsMap.get(sheet);
      const extras = extraSheets.get(puppet);
      if (extras) for (const s of extras) mask |= 1 << sheetsMap.get(s);
      return [puppet, mastersMap.get(master), mask];
    });

    const jsonContent = JSON.stringify({
      version: 2,
      masters: mastersList,
      sheets: sheetsList,
      puppets: puppetsList
    });

    const jsonPath = CONFIG.paths.main.replace('.tsv', '.json');
    const newJsonBytes = Buffer.byteLength(jsonContent, 'utf8');
    try {
      const existing = await fs.stat(jsonPath);
      if (newJsonBytes < existing.size * 0.5) {
        console.error(`puppetData.json is ${((1 - newJsonBytes / existing.size) * 100).toFixed(0)}% smaller than existing (${newJsonBytes} vs ${existing.size} bytes). Aborting to preserve existing data.`);
        process.exit(1);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    await fs.writeFile(jsonPath, jsonContent, 'utf8');

    // Log file sizes
    const tsvStats = await fs.stat(CONFIG.paths.main);
    const jsonStats = await fs.stat(CONFIG.paths.main.replace('.tsv', '.json'));
    log(`Generated puppetData.json: ${mastersList.length} masters, ${sheetsList.length} sheets, ${puppetsList.length} puppets${extraCount ? `, ${extraCount} extra sheets` : ''}`);
    log(`  Optimization: Most frequent master '${mastersList[0]}' (${masterCounts[mastersList[0]]} occurrences) assigned index 0.`);
    log(`  TSV Size: ${(tsvStats.size / 1024 / 1024).toFixed(2)} MB`);
    log(`  JSON Size: ${(jsonStats.size / 1024 / 1024).toFixed(2)} MB`);


    // Logging file sizes happens above.
    // Git commit/push logic removed. Handled by GitHub Actions.

    log('Data updated in .data directory.');

    log(`\nCompleted in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

processGoogleSheets();
