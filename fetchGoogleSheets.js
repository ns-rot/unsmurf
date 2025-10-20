// fetchGoogleSheets.js

import { promises as fs, existsSync, createReadStream } from 'fs';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { createBrotliDecompress } from 'zlib';

const sheets = [
  {
    name: "9003",
    url: "https://docs.google.com/spreadsheets/d/1MZ-4GLWAZDgB1TDvwtssEcVKHKunOKi3l90Jof1pBB4/export?format=tsv&id=1MZ-4GLWAZDgB1TDvwtssEcVKHKunOKi3l90Jof1pBB4&gid=733627866",
    puppetColumn: 0,
    mainColumn: 1,
    headerRows: 1,
  },
  {
    name: "XKI",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSem15AVLXgdjxWBZOnWRFnF6NwkY0gVKPYI8aWuHJzlbyILBL3o1F5GK1hSK3iiBlXLIZBI5jdpkVr/pub?gid=916202163&single=true&output=tsv",
    puppetColumn: 0,
    mainColumn: 1,
    headerRows: 0,
  },
  {
    name: "Rot",
    url: "https://docs.google.com/spreadsheets/d/1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4/export?format=tsv&id=1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4",
    puppetColumn: 0,
    mainColumn: 1,
    headerRows: 1,
  },
];

const regexSheets = [
    {
        name: "Rot2",
        url: "https://docs.google.com/spreadsheets/d/1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ/export?format=tsv&id=1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ",
        regexColumn: 0,
        mainColumn: 1,
        headerRows: 1,
    }
];

const redirSheet = [
    {
        name: "Redir",
        url: "https://docs.google.com/spreadsheets/d/1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ/export?format=tsv&id=1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ&gid=1440877244",
        oldMasterColumn: 0,
        newMasterColumn: 1,
        headerRows: 1,
    }
];

const excludeSheet = [
    {
        name: "Exclude",
        url: "https://docs.google.com/spreadsheets/d/1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ/export?format=tsv&id=1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ&gid=1034512747",
        puppetColumn: 0,
        masterColumn: 1,
        headerRows: 1,
    }
];

// Paths for data files
const mainFilePath = `public/static/puppetData.tsv`; // Path in main branch
const allNationsCompressedPath = `public/static/allNations.txt.br`; // Path to the compressed nations list
const worktreePath = '../gh-pages'; // Worktree directory for gh-pages
const ghPagesFilePath = `${worktreePath}/static/puppetData.tsv`; // Path in gh-pages

async function runGitCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Running command: ${command}`); // Debugging output
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running command: ${command}\n`, stderr);
        reject(error);
      } else {
        console.log(stdout.trim());
        resolve(stdout.trim());
      }
    });
  });
}

// Ensure the gh-pages worktree is clean before adding it
async function setupWorktree() {
  try {
    console.log('Cleaning up worktree...');
    await runGitCommand(`git worktree prune`);

    // Check if worktree path exists and remove it if needed
    if (existsSync(worktreePath)) {
      console.log(`Worktree ${worktreePath} exists. Removing it...`);
      await runGitCommand(`git worktree remove ${worktreePath} --force`);
    }

    // Ensure gh-pages branch exists before creating worktree
    console.log('Fetching gh-pages branch...');
    await runGitCommand(`git fetch origin gh-pages || git branch gh-pages origin/gh-pages`);

    console.log('Adding gh-pages worktree...');
    await runGitCommand(`git worktree add -f ${worktreePath} gh-pages`);
  } catch (error) {
    console.error('Error setting up worktree:', error);
  }
}

async function readBrotliFile(filePath) {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    const brotli = createBrotliDecompress();
    const chunks = [];
    stream.on('error', (err) => (err.code === 'ENOENT' ? resolve('') : reject(err)));
    brotli.on('data', (chunk) => chunks.push(chunk));
    brotli.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    brotli.on('error', (err) => reject(err));
    stream.pipe(brotli);
  });
}

async function fetchData(sheet) {
  try {
    const response = await fetch(sheet.url);
    if (!response.ok) {
      console.error(`Failed to fetch ${sheet.name}: ${response.statusText}`);
      return [];
    }
    const data = await response.text();
    const lines = data.split('\n').slice(sheet.headerRows);

    return lines
      .map((line) => {
        const columns = line.split('\t');
        const puppet = columns[sheet.puppetColumn]?.trim().toLowerCase().replace(/\s+/g, '_');
        const master = columns[sheet.mainColumn]?.trim().toLowerCase().replace(/\s+/g, '_');
        return puppet && master ? `${puppet}\t${master}\t${sheet.name}` : null;
      })
      .filter(Boolean);
  } catch (error) {
    console.error(`Error fetching data for ${sheet.name}:`, error);
    return [];
  }
}

class RegexProcessor {
  constructor(rules) {
    this.regex = null;
    this.templates = [];

    if (!rules || rules.length === 0) {
      console.warn('[WARNING] No regex rules provided to RegexProcessor');
      return;
    }

    const validPatterns = [];
    const validTemplates = [];
    let skippedCount = 0;

    for (const rule of rules) {
      let { pattern, template } = rule;
      
      if (!pattern || !template) {
        skippedCount++;
        continue;
      }

      try {
        // Validate pattern compiles
        new RegExp(pattern, 'i');
        
        // CRITICAL: Convert capturing groups to non-capturing groups
        // Prevents "undefined groups" issue
        pattern = pattern.replace(/\((?!\?)/g, '(?:');
        
        validPatterns.push(pattern);
        validTemplates.push(template);
      } catch (e) {
        skippedCount++;
        console.error(
          `[ERROR] Failed to validate regex pattern. Pattern: '${pattern}', ` +
          `Reason: ${e.message}`
        );
      }
    }

    if (validPatterns.length === 0) {
      console.error('[ERROR] No valid patterns after validation');
      return;
    }

    // Combine all patterns: (pattern1)|(pattern2)|...|(patternN)
    // Each pattern gets exactly ONE capturing group
    const combinedStr = validPatterns.map(p => `(${p})`).join('|');

    try {
      this.regex = new RegExp(combinedStr, 'i');
      this.templates = validTemplates;
      console.log(
        `Compiled ${validPatterns.length} patterns into single regex` +
        (skippedCount > 0 ? ` (${skippedCount} skipped)` : '')
      );
    } catch (e) {
      console.error(`[ERROR] Failed to compile combined regex: ${e.message}`);
      this.regex = null;
      this.templates = [];
    }
  }

  exec(text) {
    if (!text || !this.regex) return null;
    return this.regex.exec(text);
  }

  /**
   * Identify which pattern matched from exec result
   * @param {RegExpExecArray} execResult - Result from regex.exec()
   * @returns {number} Index of matched pattern, or -1 if not found
   */
  getMatchIndex(execResult) {
    if (!execResult) return -1;
    
    // Find first non-undefined group (corresponds to matched pattern)
    for (let i = 1; i < execResult.length; i++) {
      if (execResult[i] !== undefined) {
        return i - 1;  // Convert to 0-based index
      }
    }
    return -1;
  }

  /**
   * Get template for matched pattern
   */
  getTemplate(matchIndex) {
    if (matchIndex < 0 || matchIndex >= this.templates.length) {
      return null;
    }
    return this.templates[matchIndex];
  }
}

async function processGoogleSheets() {
  const startTime = Date.now();
  const tsvLines = ['puppet\tmaster\tsheet'];
  const seenPuppets = new Set();

  try {
    console.log(`Loading all nations data from ${allNationsCompressedPath}...`);
    const allNationsData = await readBrotliFile(allNationsCompressedPath);
    const allNations = allNationsData.split('\n').filter(n => n.trim() !== '');
    console.log(`Loaded ${allNations.length} total nations for regex matching.\n`);

    // === STEP 1: DIRECT PUPPETS ===
    console.log('=== STEP 1: Processing direct puppet mappings ===');
    for (const sheet of sheets) {
      console.log(`Fetching direct puppet data from ${sheet.name}...`);
      const sheetData = await fetchData(sheet);
      let addedCount = 0;
      
      for (const line of sheetData) {
        const [puppet] = line.split('\t');
        if (puppet && !seenPuppets.has(puppet)) {
          seenPuppets.add(puppet);
          tsvLines.push(line);
          addedCount++;
        }
      }
      console.log(`  Added ${addedCount} puppets from ${sheet.name}`);
    }
    console.log(`Total direct puppets: ${seenPuppets.size}\n`);

    // === STEP 2: LOAD EXCLUSIONS ===
    console.log('=== STEP 2: Loading exclusion rules ===');
    const excludeSet = new Set();
    for (const sheet of excludeSheet) {
      console.log(`Fetching exclusion rules from ${sheet.name}...`);
      const response = await fetch(sheet.url);
      if (!response.ok) {
        console.error(`Failed to fetch ${sheet.name}: ${response.statusText}`);
        continue;
      }
      const data = await response.text();
      const lines = data.split('\n').slice(sheet.headerRows);

      for (const line of lines) {
        const columns = line.split('\t');
        const puppet = columns[sheet.puppetColumn]?.trim().toLowerCase().replace(/\s+/g, '_');
        const master = columns[sheet.masterColumn]?.trim().toLowerCase().replace(/\s+/g, '_');
        if (puppet && master) {
          excludeSet.add(`${puppet}\t${master}`);
        }
      }
    }
    console.log(`Loaded ${excludeSet.size} exclusion rules.\n`);

    // === STEP 3: LOAD AND COMPILE REGEX PATTERNS ===
    console.log('=== STEP 3: Loading and compiling regex patterns ===');
    const patternDetails = [];

    for (const sheet of regexSheets) {
      console.log(`Fetching regexes from ${sheet.name}...`);
      const response = await fetch(sheet.url);
      if (!response.ok) {
        console.error(`Failed to fetch ${sheet.name}: ${response.statusText}`);
        continue;
      }
      const data = await response.text();
      const lines = data.split('\n').slice(sheet.headerRows);

      let validCount = 0;
      let invalidCount = 0;

      for (const line of lines) {
        const columns = line.split('\t');
        const regexString = columns[sheet.regexColumn]?.trim();
        const master = columns[sheet.mainColumn]?.trim().toLowerCase().replace(/\s+/g, '_');

        if (!regexString || !master) {
          if (line.trim()) {
            console.warn(
              `[WARNING] Skipping row in '${sheet.name}' due to missing data. ` +
              `Line: "${line.trim()}"`
            );
          }
          continue;
        }

        try {
          new RegExp(regexString, 'i');
          patternDetails.push({
            pattern: regexString,
            master,
            sheetName: sheet.name
          });
          validCount++;
        } catch (e) {
          console.error(
            `[ERROR] Skipping invalid regex in '${sheet.name}'. ` +
            `Master: '${master}', Pattern: '${regexString}', Error: ${e.message}`
          );
          invalidCount++;
        }
      }
      console.log(`  ${validCount} valid patterns, ${invalidCount} invalid patterns`);
    }
    console.log(`Total patterns before consolidation: ${patternDetails.length}\n`);

    // === STEP 3.5: CONSOLIDATE PATTERNS BY MASTER ===
    console.log('=== STEP 3.5: Consolidating patterns by master ===');
    const patternsByMaster = new Map();

    for (const detail of patternDetails) {
      if (!patternsByMaster.has(detail.master)) {
        patternsByMaster.set(detail.master, []);
      }
      patternsByMaster.get(detail.master).push(detail);
    }

    const consolidatedPatterns = [];
    let patternsBeforeConsolidation = patternDetails.length;
    let savedAlternations = 0;

    for (const [master, patterns] of patternsByMaster.entries()) {
      if (patterns.length > 1) {
        // Multiple patterns for same master - combine with alternation
        const combinedPattern = patterns.map(p => p.pattern).join('|');
        
        consolidatedPatterns.push({
          pattern: combinedPattern,
          master,
          sheetName: patterns[0].sheetName
        });
        
        savedAlternations += patterns.length - 1;
      } else {
        // Single pattern - keep as is
        consolidatedPatterns.push(patterns[0]);
      }
    }

    console.log(`Consolidated ${patternsBeforeConsolidation} patterns → ${consolidatedPatterns.length} patterns`);
    if (savedAlternations > 0) {
      const reductionPercent = (100 * savedAlternations / patternsBeforeConsolidation).toFixed(1);
      console.log(`  💾 Reduction: ${savedAlternations} fewer top-level alternatives (${reductionPercent}% reduction)\n`);
    }

    // === STEP 4: BUILD OPTIMIZED REGEX PROCESSOR ===
    console.log('=== STEP 4: Building optimized regex processor ===');
    const regexProcessor = new RegexProcessor(
      consolidatedPatterns.map(p => ({ pattern: p.pattern, template: p.master }))
    );
    console.log();

    // === STEP 5: REGEX MATCHING ===
    console.log('=== STEP 5: Testing nations against regex patterns ===');
    if (consolidatedPatterns.length > 0 && regexProcessor.regex) {
      let matchCount = 0;
      let testCount = 0;
      let errorCount = 0;
      let excludedCount = 0;
      const matchStats = {};

      const regexTestStart = Date.now();

      for (let idx = 0; idx < allNations.length; idx++) {
        const nation = allNations[idx];
        
        if (seenPuppets.has(nation)) continue;

        testCount++;

        try {
          // Single .exec() call gets all match data
          // No need to loop through patterns again!
          const execResult = regexProcessor.exec(nation);
          
          if (execResult) {
            // Matched pattern from exec result
            const matchIndex = regexProcessor.getMatchIndex(execResult);

            if (matchIndex >= 0 && matchIndex < consolidatedPatterns.length) {
              const patternDetail = consolidatedPatterns[matchIndex];
              const exclusionKey = `${nation}\t${patternDetail.master}`;
              
              if (excludeSet.has(exclusionKey)) {
                console.log(`  Excluding: ${exclusionKey}`);
                excludedCount++;
              } else {
                seenPuppets.add(nation);
                tsvLines.push(`${nation}\t${patternDetail.master}\t${patternDetail.sheetName}`);
                matchCount++;
                
                // Track statistics
                matchStats[patternDetail.master] = (matchStats[patternDetail.master] || 0) + 1;
              }
            } else {
              console.error(
                `[ERROR] Regex matched nation '${nation}' but could not identify pattern. ` +
                `Match index: ${matchIndex}, Pattern count: ${consolidatedPatterns.length}`
              );
              errorCount++;
            }
          }
        } catch (e) {
          errorCount++;
          console.error(
            `[ERROR] Regex test failed on nation '${nation}': ${e.message}`
          );
        }

        // Progress logging every 50k nations
        if (testCount % 50000 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = (testCount / (Date.now() - startTime) * 1000).toFixed(0);
          console.log(
            `  Progress: ${testCount.toLocaleString()}/${allNations.length.toLocaleString()} ` +
            `nations tested, ${matchCount} matches found, ${elapsed}s elapsed, ${rate} nations/sec`
          );
        }
      }

      const regexTestTime = ((Date.now() - regexTestStart) / 1000).toFixed(1);
      const testsPerSecond = ((testCount * 1000) / (Date.now() - regexTestStart)).toFixed(0);

      console.log(`\nRegex matching completed in ${regexTestTime}s (${testsPerSecond} nations/sec)`);
      console.log(`Found ${matchCount} new puppets via regex matching`);
      console.log(`  - Tested: ${testCount.toLocaleString()} nations`);
      console.log(`  - Matched: ${matchCount} puppets`);
      console.log(`  - Excluded: ${excludedCount} matches`);
      if (errorCount > 0) {
        console.log(`  - Errors: ${errorCount}`);
      }
      
      // Show top 10 masters by match count
      const topMasters = Object.entries(matchStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      if (topMasters.length > 0) {
        console.log('\n  📊 Top 10 masters by match count:');
        topMasters.forEach(([master, count]) => {
          console.log(`    - ${master}: ${count}`);
        });
      }
      console.log();
    }

    // === STEP 6: LOAD REDIRECTS ===
    console.log('=== STEP 6: Loading redirect rules ===');
    const redirMap = new Map();
    for (const sheet of redirSheet) {
      console.log(`Fetching redirects from ${sheet.name}...`);
      const response = await fetch(sheet.url);
      if (!response.ok) {
        console.error(`Failed to fetch ${sheet.name}: ${response.statusText}`);
        continue;
      }
      const data = await response.text();
      const lines = data.split('\n').slice(sheet.headerRows);

      for (const line of lines) {
        const columns = line.split('\t');
        const oldMaster = columns[sheet.oldMasterColumn]?.trim().toLowerCase().replace(/\s+/g, '_');
        const newMaster = columns[sheet.newMasterColumn]?.trim().toLowerCase().replace(/\s+/g, '_');
        if (oldMaster && newMaster) {
          redirMap.set(oldMaster, newMaster);
        }
      }
    }
    console.log(`Loaded ${redirMap.size} redirect rules.\n`);

    // === STEP 7: APPLY REDIRECTS ===
    if (redirMap.size > 0) {
      console.log('=== STEP 7: Applying redirect rules ===');
      let redirectCount = 0;
      for (let i = 1; i < tsvLines.length; i++) {
        const [puppet, master, sheet] = tsvLines[i].split('\t');
        if (redirMap.has(master)) {
          const newMaster = redirMap.get(master);
          tsvLines[i] = `${puppet}\t${newMaster}\t${sheet}`;
          redirectCount++;
        }
      }
      console.log(`Applied ${redirectCount} redirects.\n`);
    }

    // === STEP 8: SORT DATA ===
    console.log('=== STEP 8: Sorting data by master then puppet ===');
    const header = tsvLines[0];
    const dataLines = tsvLines.slice(1);

    const parsedData = dataLines.map(line => {
      const [puppet, master, sheet] = line.split('\t');
      return { puppet, master, sheet, original: line };
    });

    parsedData.sort((a, b) => {
      if (a.master !== b.master) {
        return a.master < b.master ? -1 : 1;
      }
      return a.puppet < b.puppet ? -1 : (a.puppet > b.puppet ? 1 : 0);
    });

    const tsvContent = [header, ...parsedData.map(p => p.original)].join('\n');
    console.log(`Total entries in final file: ${parsedData.length}\n`);

    // === STEP 9: WRITE AND COMMIT ===
    console.log('=== STEP 9: Writing and committing files ===');
    await fs.writeFile(mainFilePath, tsvContent, 'utf8');
    console.log(`Data saved to ${mainFilePath}`);

    console.log('Committing and pushing changes to main...');
    await runGitCommand(`
      git fetch origin main --quiet &&
      git pull --ff-only origin main &&
      git add ${mainFilePath} &&
      git commit -m "Force update Google Sheets data in main branch" --allow-empty &&
      git push --force origin main
    `);

    // === STEP 10: SYNC TO GH-PAGES ===
    console.log('\n=== STEP 10: Syncing to gh-pages ===');
    await setupWorktree();
    await fs.copyFile(mainFilePath, ghPagesFilePath);
    console.log(`Copied ${mainFilePath} to ${ghPagesFilePath}`);

    console.log('Committing and pushing changes to gh-pages...');
    await runGitCommand(`
      cd ${worktreePath} &&
      git add static/puppetData.tsv &&
      git commit -m "Sync Google Sheets data from main to gh-pages" || true &&
      git push --force origin gh-pages
    `);

    console.log('Removing gh-pages worktree...');
    await runGitCommand(`git worktree remove ${worktreePath} --force`);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nCompleted in ${totalTime}s`);

  } catch (error) {
    console.error('Error processing Google Sheets:', error);
  }
}

processGoogleSheets().catch((error) => {
  console.error('Error processing Google Sheets:', error);
});