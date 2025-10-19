import { promises as fs, existsSync, createReadStream } from 'fs';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { createBrotliDecompress } from 'zlib';
import { log } from 'console';

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

    if (!rules || rules.length === 0) return;

    const validPatterns = [];
    const validTemplates = [];

    for (const rule of rules) {
      let { pattern, template } = rule;
      
      try {
        new RegExp(pattern, 'i');
        
        // CRITICAL: Convert internal capturing groups to non-capturing groups
        // This prevents the "all undefined" problem
        // Replace ( with (?: UNLESS it's already (?:
        log(`Normalizing pattern: ${pattern}`);
        pattern = pattern.replace(/\((?!\?)/g, '(?:');
        log(`Valid regex pattern added: ${pattern}`);
        validPatterns.push(pattern);
        validTemplates.push(template);
      } catch (e) {
        console.error(
          `[ERROR] Skipping INVALID regex pattern. Pattern: '${pattern}', ` +
          `Template: '${template}', Reason: ${e.message}`
        );
      }
    }

    if (validPatterns.length === 0) return;

    // NOW the combined regex will only have ONE capturing group per pattern
    const combinedStr = validPatterns.map(p => `(${p})`).join('|');

    try {
      this.regex = new RegExp(combinedStr, 'i');
      this.templates = validTemplates;
      console.log(`Successfully compiled ${validPatterns.length} patterns into single regex`);
    } catch (e) {
      console.error(`[ERROR] Failed to compile combined regex: ${e.message}`);
      this.regex = null;
      this.templates = [];
    }
  }

  resolve(text) {
    if (!text || !this.regex) return text;

    const execResult = this.regex.exec(text);
    if (!execResult) return text;

    // Now that we've normalized patterns, the first non-undefined group
    // after index 0 will ALWAYS correspond to the matching pattern
    let matchIndex = -1;
    for (let i = 1; i < execResult.length; i++) {
      if (execResult[i] !== undefined) {
        matchIndex = i - 1;
        break;
      }
    }

    if (matchIndex === -1 || matchIndex >= this.templates.length) {
      console.error(
        `[LOGIC ERROR] Matched '${text}' but could not identify pattern. ` +
        `Match index: ${matchIndex}, Templates: ${this.templates.length}`
      );
      return text;
    }

    const template = this.templates[matchIndex];

    return template.replace(/\$(\d+)/g, (m) => {
      try {
        const groupNum = parseInt(m[1], 10);
        const absoluteGroupIndex = matchIndex + 1 + groupNum;
        return execResult[absoluteGroupIndex] || '';
      } catch (e) {
        console.warn(`[WARN] Failed to resolve group ${m[1]}`);
        return m[0];
      }
    });
  }

  match(text) {
    if (!text || !this.regex) return false;
    return this.regex.test(text);
  }

  resolve(text) {
    if (!text || !this.regex) return text;

    const execResult = this.regex.exec(text);
    if (!execResult) return text;

    // Find first non-undefined capturing group
    let matchIndex = -1;
    for (let i = 1; i < execResult.length; i++) {
      if (execResult[i] !== undefined) {
        matchIndex = i - 1;
        break;
      }
    }

    if (matchIndex === -1) {
      console.error(`[LOGIC ERROR] Matched '${text}' but could not identify pattern.`);
      return text;
    }

    const template = this.templates[matchIndex];

    // Replace $1, $2, etc.
    return template.replace(/\$(\d+)/g, (m) => {
      try {
        const groupNum = parseInt(m[1], 10);
        const absoluteGroupIndex = matchIndex + 1 + groupNum;
        return execResult[absoluteGroupIndex] || '';
      } catch (e) {
        console.warn(`[WARN] Failed to resolve group ${m[1]}`);
        return m[0];
      }
    });
  }
}

async function processGoogleSheets() {
  const tsvLines = ['puppet\tmaster\tsheet']; // Header row
  const seenPuppets = new Set();

  try {
    console.log(`Loading all nations data from ${allNationsCompressedPath}...`);
    const allNationsData = await readBrotliFile(allNationsCompressedPath);
    const allNations = allNationsData.split('\n').filter(n => n.trim() !== '');
    console.log(`Loaded ${allNations.length} total nations for regex matching.`);

    for (const sheet of sheets) {
      console.log(`Fetching direct puppet data from ${sheet.name}...`);
      const sheetData = await fetchData(sheet);
      for (const line of sheetData) {
        const [puppet] = line.split('\t');
        if (puppet && !seenPuppets.has(puppet)) {
          seenPuppets.add(puppet);
          tsvLines.push(line);
        }
      }
    }
    
    const patternDetails = [];

    for (const sheet of regexSheets) {
      console.log(`Fetching and validating regexes from ${sheet.name}...`);
      const response = await fetch(sheet.url);
      if (!response.ok) {
        console.error(`Failed to fetch ${sheet.name}: ${response.statusText}`);
        continue;
      }
      const data = await response.text();
      const lines = data.split('\n').slice(sheet.headerRows);

      for (const line of lines) {
        const columns = line.split('\t');
        const regexString = columns[sheet.regexColumn]?.trim();
        const master = columns[sheet.mainColumn]?.trim().toLowerCase().replace(/\s+/g, '_');

        if (!regexString || !master) {
          if (line.trim()) {
            console.warn(
              `[WARNING] Skipping row in sheet '${sheet.name}' due to missing data. Line: "${line.trim()}"`
            );
          }
          continue;
        }

        try {
          new RegExp(regexString);
          patternDetails.push({ pattern: regexString, master, sheetName: sheet.name });
        } catch (e) {
          console.error(
            `[ERROR] Skipping invalid regex pattern in sheet '${sheet.name}'. ` +
            `Master: '${master}', Pattern: '${regexString}', Error: ${e.message}`
          );
        }
      }
    }

    // Load exclusion rules
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
    console.log(`Loaded ${excludeSet.size} exclusion rules.`);

    if (patternDetails.length > 0) {
      console.log(`Compiling ${patternDetails.length} regexes using RegexProcessor...`);
      const regexProcessor = new RegexProcessor(
        patternDetails.map(p => ({ pattern: p.pattern, template: p.master }))
      );

      let matchCount = 0;
      for (const nation of allNations) {
        if (seenPuppets.has(nation)) continue;

        if (regexProcessor.match(nation)) {
          const matchingPattern = findMatchingPattern(nation, patternDetails);
          if (matchingPattern) {
            // Check if this (nation, master) pair is excluded
            const exclusionKey = `${nation}\t${matchingPattern.master}`;
            if (excludeSet.has(exclusionKey)) {
              console.log(`Skipping excluded entry: ${exclusionKey}`);
              continue; // Skip without marking as seen
            }

            seenPuppets.add(nation);
            tsvLines.push(
              `${nation}\t${matchingPattern.master}\t${matchingPattern.sheetName}`
            );
            matchCount++;
          }
        }
      }
      console.log(`Found ${matchCount} new puppets via regex matching.`);
    }

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

    if (redirMap.size > 0) {
      console.log(`Applying ${redirMap.size} redirect rules...`);
      for (let i = 1; i < tsvLines.length; i++) {
        const [puppet, master, sheet] = tsvLines[i].split('\t');
        if (redirMap.has(master)) {
          const newMaster = redirMap.get(master);
          tsvLines[i] = `${puppet}\t${newMaster}\t${sheet}`;
        }
      }
    }

    const tsvContent = tsvLines.join('\n');

    // === WRITE AND COMMIT ===
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

  } catch (error) {
    console.error('Error processing Google Sheets:', error);
  }
}

/**
 * Helper function to find which pattern matched a given nation.
 * Returns the matching pattern details.
 */
function findMatchingPattern(nation, patternDetails) {
  for (const pd of patternDetails) {
    try {
      const regex = new RegExp(pd.pattern, 'i');
      if (regex.test(nation)) {
        return pd;
      }
    } catch (e) {
      // Skip invalid patterns
      continue;
    }
  }
  return null;
}

processGoogleSheets().catch((error) => {
  console.error('Error processing Google Sheets:', error);
});