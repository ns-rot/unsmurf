// fetchGoogleSheets.js

import { promises as fs, existsSync, createReadStream } from 'fs';
import { createInterface } from 'readline';
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
    console.log(`Running command: ${command}`);
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

async function setupWorktree() {
  try {
    console.log('Cleaning up worktree...');
    await runGitCommand(`git worktree prune`);

    if (existsSync(worktreePath)) {
      console.log(`Worktree ${worktreePath} exists. Removing it...`);
      await runGitCommand(`git worktree remove ${worktreePath} --force`);
    }

    console.log('Fetching gh-pages branch...');
    await runGitCommand(`git fetch origin gh-pages || git branch gh-pages origin/gh-pages`);

    console.log('Adding gh-pages worktree...');
    await runGitCommand(`git worktree add -f ${worktreePath} gh-pages`);
  } catch (error) {
    console.error('Error setting up worktree:', error);
  }
}

async function streamBrotliFile(filePath, processLine) {
  return new Promise((resolve, reject) => {
    const fileStream = createReadStream(filePath);
    const brotli = createBrotliDecompress();
    const rl = createInterface({
      input: fileStream.pipe(brotli),
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      const nation = line.trim();
      if (nation) {
        processLine(nation);
      }
    });

    rl.on('close', () => {
      resolve();
    });

    rl.on('error', (err) => {
      reject(err);
    });

    fileStream.on('error', (err) => {
      reject(err);
    });

    brotli.on('error', (err) => {
      reject(err);
    });
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

function countCaptureGroups(pattern) {
  try {
    let count = 0;
    let i = 0;
    while (i < pattern.length) {
      if (pattern[i] === '(') {
        if (i + 1 < pattern.length && pattern[i + 1] === '?') {
          i += 2;
        } else {
          count++;
          i++;
        }
      } else {
        i++;
      }
    }
    return count;
  } catch (e) {
    return 0;
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
        new RegExp(pattern, 'i');
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

    const combinedStr = validPatterns.map(p => `(${p})`).join('|');

    try {
      this.regex = new RegExp(combinedStr, 'i');
      this.templates = validTemplates;
      console.log(
        `  Compiled ${validPatterns.length} patterns into single regex` +
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

  getMatchIndex(execResult) {
    if (!execResult) return -1;
    
    for (let i = 1; i < execResult.length; i++) {
      if (execResult[i] !== undefined) {
        return i - 1;
      }
    }
    return -1;
  }

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
    console.log(`Streaming nations data from ${allNationsCompressedPath}...\n`);

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

    // === STEP 3.5: CONSOLIDATE PATTERNS BY MASTER (WITH GROUP LIMIT) ===
    console.log('=== STEP 3.5: Consolidating patterns by master (respecting group limits) ===');
    
    const MAX_GROUPS_PER_CONSOLIDATED = 800;
    const MAX_PATTERNS_PER_CONSOLIDATED = 25;
    
    const patternsByMaster = new Map();

    const patternGroups = new Map();
    for (const detail of patternDetails) {
      const groupCount = countCaptureGroups(detail.pattern);
      patternGroups.set(detail.pattern, groupCount);
    }

    for (const detail of patternDetails) {
      if (!patternsByMaster.has(detail.master)) {
        patternsByMaster.set(detail.master, []);
      }
      patternsByMaster.get(detail.master).push(detail);
    }

    const consolidatedPatterns = [];
    let savedAlternations = 0;
    let consolidationStats = [];

    for (const [master, patterns] of patternsByMaster.entries()) {
      if (patterns.length === 1) {
        consolidatedPatterns.push(patterns[0]);
        continue;
      }

      let currentGroup = [];
      let currentGroupCount = 0;

      for (const pattern of patterns) {
        const patternGroupCount = patternGroups.get(pattern.pattern) || 0;

        if (
          currentGroup.length > 0 &&
          (currentGroupCount + patternGroupCount > MAX_GROUPS_PER_CONSOLIDATED ||
            currentGroup.length >= MAX_PATTERNS_PER_CONSOLIDATED)
        ) {
          const combinedPattern = currentGroup.map(p => p.pattern).join('|');
          consolidatedPatterns.push({
            pattern: combinedPattern,
            master,
            sheetName: currentGroup[0].sheetName,
            patternCount: currentGroup.length,
            groupCount: currentGroupCount
          });

          consolidationStats.push({
            master,
            patterns: currentGroup.length,
            groups: currentGroupCount
          });

          savedAlternations += currentGroup.length - 1;

          currentGroup = [];
          currentGroupCount = 0;
        }

        currentGroup.push(pattern);
        currentGroupCount += patternGroupCount;
      }

      if (currentGroup.length > 0) {
        const combinedPattern = currentGroup.map(p => p.pattern).join('|');
        consolidatedPatterns.push({
          pattern: combinedPattern,
          master,
          sheetName: currentGroup[0].sheetName,
          patternCount: currentGroup.length,
          groupCount: currentGroupCount
        });

        consolidationStats.push({
          master,
          patterns: currentGroup.length,
          groups: currentGroupCount
        });

        savedAlternations += currentGroup.length - 1;
      }
    }

    console.log(`Consolidated ${patternDetails.length} patterns → ${consolidatedPatterns.length} consolidated patterns`);
    if (savedAlternations > 0) {
      const reductionPercent = (100 * savedAlternations / patternDetails.length).toFixed(1);
      console.log(`  💾 Reduction: ${savedAlternations} fewer top-level alternatives (${reductionPercent}% reduction)`);
    }

    const largeConsolidations = consolidationStats
      .filter(s => s.patterns > 1)
      .sort((a, b) => b.patterns - a.patterns)
      .slice(0, 10);
    
    if (largeConsolidations.length > 0) {
      console.log('\n  📊 Top 10 masters by consolidation:');
      largeConsolidations.forEach(stat => {
        console.log(`    - ${stat.master}: ${stat.patterns} patterns → ${stat.groups} groups`);
      });
    }

    const totalGroupsInRegex = consolidatedPatterns.reduce((sum, p) => {
      return sum + (p.groupCount || countCaptureGroups(p.pattern)) + 1;
    }, 0);

    console.log(`\n  📈 Final regex statistics:`);
    console.log(`    - Consolidated patterns: ${consolidatedPatterns.length}`);
    console.log(`    - Estimated total capturing groups: ${totalGroupsInRegex}`);
    if (totalGroupsInRegex > 1024) {
      console.log(`    ⚠️  EXCEEDS JavaScript limit (1024)! Consider further splitting.`);
    } else if (totalGroupsInRegex > 800) {
      console.log(`    ⚠️  Approaching limit. Consider splitting into multiple regex sets.`);
    } else {
      console.log(`    ✅ Well within JavaScript limit.`);
    }
    console.log();

    // === STEP 4: BUILD MULTIPLE REGEX PROCESSORS ===
    console.log('=== STEP 4: Building multiple regex processors ===');
    
    const MAX_PATTERNS_PER_REGEX = 100;
    const regexProcessors = [];
    
    for (let i = 0; i < consolidatedPatterns.length; i += MAX_PATTERNS_PER_REGEX) {
      const chunk = consolidatedPatterns.slice(i, i + MAX_PATTERNS_PER_REGEX);
      const processor = new RegexProcessor(
        chunk.map(p => ({ pattern: p.pattern, template: p.master }))
      );
      regexProcessors.push({ processor, patterns: chunk });
    }
    
    console.log(`Split into ${regexProcessors.length} regex processors (max ${MAX_PATTERNS_PER_REGEX} patterns each)\n`);

    // === STEP 5: REGEX MATCHING (STREAMING) ===
    console.log('=== STEP 5: Testing nations against regex patterns (streaming) ===');
    if (consolidatedPatterns.length > 0) {
      let matchCount = 0;
      let testCount = 0;
      let errorCount = 0;
      const matchStats = {};

      const regexTestStart = Date.now();

      await streamBrotliFile(allNationsCompressedPath, (nation) => {
        if (seenPuppets.has(nation)) return;

        testCount++;

        try {
          let matched = false;
          
          for (const { processor, patterns } of regexProcessors) {
            if (!processor.regex) continue;
            
            const execResult = processor.exec(nation);
            
            if (execResult) {
              const matchIndex = processor.getMatchIndex(execResult);

              if (matchIndex >= 0 && matchIndex < patterns.length) {
                const patternDetail = patterns[matchIndex];
                const exclusionKey = `${nation}\t${patternDetail.master}`;
                
                if (!excludeSet.has(exclusionKey)) {
                  seenPuppets.add(nation);
                  tsvLines.push(`${nation}\t${patternDetail.master}\t${patternDetail.sheetName}`);
                  matchCount++;
                  matchStats[patternDetail.master] = (matchStats[patternDetail.master] || 0) + 1;
                  matched = true;
                  break;
                }
              }
            }
          }
        } catch (e) {
          errorCount++;
          console.error(`[ERROR] Regex test failed on nation '${nation}': ${e.message}`);
        }

        if (testCount % 50000 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = (testCount / (Date.now() - startTime) * 1000).toFixed(0);
          console.log(
            `  Progress: ${testCount.toLocaleString()} ` +
            `nations tested, ${matchCount} matches found, ${elapsed}s elapsed, ${rate} nations/sec`
          );
        }
      });

      const regexTestTime = ((Date.now() - regexTestStart) / 1000).toFixed(1);
      const testsPerSecond = ((testCount * 1000) / (Date.now() - regexTestStart)).toFixed(0);

      console.log(`\nRegex matching completed in ${regexTestTime}s (${testsPerSecond} nations/sec)`);
      console.log(`Found ${matchCount} new puppets via regex matching`);
      console.log(`  - Tested: ${testCount.toLocaleString()} nations`);
      console.log(`  - Matched: ${matchCount} puppets`);
      if (errorCount > 0) {
        console.log(`  - Errors: ${errorCount}`);
      }

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