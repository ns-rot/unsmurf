// fetchGoogleSheets.js

import { promises as fs, existsSync, createReadStream } from 'fs';
import { createInterface } from 'readline';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { createBrotliDecompress } from 'zlib';

const CONFIG = {
  sheets: [
    { name: "9003", url: "https://docs.google.com/spreadsheets/d/1MZ-4GLWAZDgB1TDvwtssEcVKHKunOKi3l90Jof1pBB4/export?format=tsv&id=1MZ-4GLWAZDgB1TDvwtssEcVKHKunOKi3l90Jof1pBB4&gid=733627866", puppetColumn: 0, mainColumn: 1, headerRows: 1 },
    { name: "XKI", url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSem15AVLXgdjxWBZOnWRFnF6NwkY0gVKPYI8aWuHJzlbyILBL3o1F5GK1hSK3iiBlXLIZBI5jdpkVr/pub?gid=916202163&single=true&output=tsv", puppetColumn: 0, mainColumn: 1, headerRows: 0 },
    { name: "Rot", url: "https://docs.google.com/spreadsheets/d/1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4/export?format=tsv&id=1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4", puppetColumn: 0, mainColumn: 1, headerRows: 1 },
  ],
  regexSheets: [{ name: "Rot2", url: "https://docs.google.com/spreadsheets/d/1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ/export?format=tsv&id=1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ", regexColumn: 0, mainColumn: 1, headerRows: 1 }],
  excludeSheets: [{ name: "Exclude", url: "https://docs.google.com/spreadsheets/d/1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ/export?format=tsv&id=1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ&gid=1034512747", puppetColumn: 0, masterColumn: 1, headerRows: 1 }],
  redirSheets: [{ name: "Redir", url: "https://docs.google.com/spreadsheets/d/1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ/export?format=tsv&id=1SM4QPGoEdd-ty8-mOdXK-jMIp_2aWesfUX7EHJi4DGQ&gid=1440877244", oldMasterColumn: 0, newMasterColumn: 1, headerRows: 1 }],
  paths: {
    main: 'public/static/puppetData.tsv',
    nations: 'public/static/allNations.txt.br',
    worktree: '../gh-pages',
    ghPages: '../gh-pages/static/puppetData.tsv',
  },
  maxGroupsPerPattern: 800,
  maxPatternsPerGroup: 25,
  maxPatternsPerRegex: 100,
};

const normalize = (str) => str?.trim().toLowerCase().replace(/\s+/g, '_');

async function runGit(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) { console.error(stderr); reject(err); } else resolve(stdout.trim());
    });
  });
}

async function setupWorktree() {
  await runGit(`git worktree prune`);
  if (existsSync(CONFIG.paths.worktree)) await runGit(`git worktree remove ${CONFIG.paths.worktree} --force`);
  await runGit(`git fetch origin gh-pages || git branch gh-pages origin/gh-pages`);
  await runGit(`git worktree add -f ${CONFIG.paths.worktree} gh-pages`);
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
    const res = await fetch(sheet.url);
    if (!res.ok) throw new Error(res.statusText);
    const lines = (await res.text()).split('\n').slice(sheet.headerRows);
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
  const seenPuppets = new Set();
  const log = (msg) => console.log(msg);
  const logStep = (num, title) => log(`\n=== STEP ${num}: ${title} ===`);

  try {
    // STEP 1: Direct puppets
    logStep(1, 'Processing direct puppet mappings');
    for (const sheet of CONFIG.sheets) {
      const data = await fetchSheet(sheet);
      let count = 0;
      for (const { cols } of data) {
        const puppet = normalize(cols[sheet.puppetColumn]);
        const master = normalize(cols[sheet.mainColumn]);
        if (puppet && master && !seenPuppets.has(puppet)) {
          seenPuppets.add(puppet);
          tsvLines.push(`${puppet}\t${master}\t${sheet.name}`);
          count++;
        }
      }
      log(`  Added ${count} puppets from ${sheet.name}`);
    }
    log(`Total direct puppets: ${seenPuppets.size}`);

    // STEP 2: Exclusions
    logStep(2, 'Loading exclusion rules');
    const excludeSet = new Set();
    for (const sheet of CONFIG.excludeSheets) {
      const data = await fetchSheet(sheet);
      for (const { cols } of data) {
        const puppet = normalize(cols[sheet.puppetColumn]);
        const master = normalize(cols[sheet.masterColumn]);
        if (puppet && master) excludeSet.add(`${puppet}\t${master}`);
      }
    }
    log(`Loaded ${excludeSet.size} exclusion rules`);

    // STEP 3: Load regex patterns
    logStep(3, 'Loading and compiling regex patterns');
    const patterns = [];
    for (const sheet of CONFIG.regexSheets) {
      const data = await fetchSheet(sheet);
      let valid = 0, invalid = 0;
      for (const { cols } of data) {
        const regex = cols[sheet.regexColumn]?.trim();
        const master = normalize(cols[sheet.mainColumn]);
        if (!regex || !master) continue;
        try {
          new RegExp(regex, 'i');
          patterns.push({ pattern: regex, master, sheetName: sheet.name });
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
      if (pts.length === 1) { consolidated.push(pts[0]); continue; }

      let group = [], groupCount = 0;
      for (const p of pts) {
        const pCount = groupCounts.get(p.pattern) || 0;
        if (group.length > 0 && (groupCount + pCount > CONFIG.maxGroupsPerPattern || group.length >= CONFIG.maxPatternsPerGroup)) {
          consolidated.push({
            pattern: group.map(x => x.pattern).join('|'),
            master,
            sheetName: group[0].sheetName,
            groupCount
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
          groupCount
        });
        saved += group.length - 1;
      }
    }

    log(`${patterns.length} → ${consolidated.length} patterns (${(100 * saved / patterns.length).toFixed(1)}% reduction)`);

    // STEP 4: Build regex processors
    logStep(4, 'Building multiple regex processors');
    const processors = [];
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

    await streamBrotli(CONFIG.paths.nations, (nation) => {
      if (seenPuppets.has(nation)) return;
      tested++;

      try {
        for (const { processor, patterns: pts } of processors) {
          if (!processor.regex) continue;
          const result = processor.exec(nation);
          if (result) {
            const idx = processor.getMatchIndex(result);
            if (idx >= 0 && idx < pts.length) {
              const detail = pts[idx];
              const key = `${nation}\t${detail.master}`;
              if (!excludeSet.has(key)) {
                seenPuppets.add(nation);
                tsvLines.push(`${nation}\t${detail.master}\t${detail.sheetName}`);
                matched++;
                matchStats[detail.master] = (matchStats[detail.master] || 0) + 1;
                break;
              }
            }
          }
        }
      } catch (e) {
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
      for (const { cols } of data) {
        const old = normalize(cols[sheet.oldMasterColumn]);
        const neu = normalize(cols[sheet.newMasterColumn]);
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
    const content = [tsvLines[0], ...data.map(p => p.original)].join('\n');
    log(`Total entries: ${data.length}`);

    // STEP 9: Commit to main
    logStep(9, 'Writing and committing');
    await fs.writeFile(CONFIG.paths.main, content, 'utf8');
    await runGit(`git fetch origin main --quiet && git pull --ff-only origin main && git add ${CONFIG.paths.main} && git commit -m "Update puppet data" --allow-empty && git push --force origin main`);

    // STEP 10: Sync to gh-pages
    logStep(10, 'Syncing to gh-pages');
    await setupWorktree();
    await fs.copyFile(CONFIG.paths.main, CONFIG.paths.ghPages);
    await runGit(`cd ${CONFIG.paths.worktree} && git add static/puppetData.tsv && git commit -m "Sync puppet data" --allow-empty && git push --force origin gh-pages`);
    log('Synced to gh-pages');

    log(`\nCompleted in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error('Error:', e);
  }
}

processGoogleSheets();