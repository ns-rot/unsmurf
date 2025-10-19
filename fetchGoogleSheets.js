import { promises as fs, existsSync, createReadStream } from 'fs'; // Node.js filesystem module
import fetch from 'node-fetch'; // Use node-fetch for HTTP requests
import { exec } from 'child_process'; // For running Git commands
import { createBrotliDecompress } from 'zlib'; // For decompressing the nations list

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

async function processGoogleSheets() {
  const tsvLines = ['puppet\tmaster\tsheet']; // Header row
  const seenPuppets = new Set(); // Track unique puppet names

  try {
    console.log(`Loading all nations data from ${allNationsCompressedPath}...`);
    const allNationsData = await readBrotliFile(allNationsCompressedPath);
    const allNations = allNationsData.split('\n').filter(n => n.trim() !== '');
    console.log(`Loaded ${allNations.length} total nations for regex matching.`);

    for (const sheet of sheets) {
      console.log(`Fetching direct puppet data from ${sheet.name}...`);
      const sheetData = await fetchData(sheet);
      
      // Only add entries with unseen puppet names
      for (const line of sheetData) {
        const [puppet] = line.split('\t');
        if (puppet && !seenPuppets.has(puppet)) {
          seenPuppets.add(puppet);
          tsvLines.push(line);
        }
      }
    }
    
    const patternDetails = [];
    let invalidRegexCount = 0;

    for (const sheet of regexSheets) {
        console.log(`Fetching and validating regexes from ${sheet.name}...`);
        const response = await fetch(sheet.url);
        if (!response.ok) { 
            console.error(`Failed to fetch ${sheet.name}: ${response.statusText}`); 
            continue; 
        }
        const data = await response.text();
        const lines = data.split('\n').slice(sheet.headerRows);

        // Validate each regex line-by-line before adding it
        for (const line of lines) {
            const columns = line.split('\t');
            const regexString = columns[sheet.regexColumn]?.trim();
            const master = columns[sheet.mainColumn]?.trim().toLowerCase().replace(/\s+/g, '_');

            // GRACEFUL HANDLING 1: Skip if data is incomplete
            if (!regexString || !master) {
                if (line.trim()) { // Only log if the line wasn't just empty
                    console.warn(`[WARNING] Skipping row in sheet '${sheet.name}' due to missing regex or master. Line: "${line.trim()}"`);
                }
                continue; // Go to the next line
            }

            // GRACEFUL HANDLING 2: Validate each regex pattern individually
            try {
                new RegExp(regexString); // Try to compile the regex
                patternDetails.push({ pattern: regexString, master, sheetName: sheet.name });
            } catch (e) {
                invalidRegexCount++;
                console.error(`[ERROR] Skipping invalid regex pattern in sheet '${sheet.name}'. Master: '${master}', Pattern: '${regexString}', Error: ${e.message}`);
            }
        }
    }

    if (invalidRegexCount > 0) {
        console.warn(`\n[SUMMARY] Skipped a total of ${invalidRegexCount} invalid regex patterns. Check logs above for details.\n`);
    }

    if (patternDetails.length > 0) {
        console.log(`Combining ${patternDetails.length} valid regexes into a single pattern...`);
        
        // Each pattern is wrapped in its own capturing group. The index of this group
        // will correspond to the index in the `patternDetails` array.
        const combinedPatternString = patternDetails.map(p => `(${p.pattern})`).join('|');

        try {
            const combinedRegex = new RegExp(combinedPatternString, 'i');
            let matchCount = 0;

            for (const nation of allNations) {
                if (seenPuppets.has(nation)) continue;

                const match = nation.match(combinedRegex);
                if (match) {
                    // The first element of match is the full string. The subsequent elements are
                    // the capture groups. We find the index of the first defined capture group.
                    const matchIndex = match.slice(1).findIndex(m => m !== undefined);

                    // RELIABILITY CHECK: Ensure the found index is valid.
                    if (matchIndex !== -1 && patternDetails[matchIndex]) {
                        const winningPattern = patternDetails[matchIndex];
                        seenPuppets.add(nation);
                        tsvLines.push(`${nation}\t${winningPattern.master}\t${winningPattern.sheetName}`);
                        matchCount++;
                    } else {
                        // This is a safety log. It shouldn't be hit with the new validation,
                        // but it's good to have in case of an unexpected logic error.
                        console.error(`[LOGIC ERROR] Found a regex match for nation '${nation}', but could not map it back to a pattern. Match array:`, match);
                    }
                }
            }
            console.log(`Found ${matchCount} new puppets via regex matching.`);
        } catch (e) {
            // This catch is a final fallback. Individual regexes are already validated.
            // An error here might indicate a catastrophic issue with combining patterns.
            console.error("CRITICAL ERROR: Failed to execute combined regex. This may be due to excessive complexity or a catastrophic backtracking issue.", e.message);
        }
    }

    const redirMap = new Map();
    for (const sheet of redirSheet) {
        console.log(`Fetching redirects from ${sheet.name}...`);
        const response = await fetch(sheet.url);
        if (!response.ok) { console.error(`Failed to fetch ${sheet.name}: ${response.statusText}`); continue; }
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
        // Start at 1 to skip the header
        for (let i = 1; i < tsvLines.length; i++) {
            let [puppet, master, sheet] = tsvLines[i].split('\t');
            if (redirMap.has(master)) {
                const newMaster = redirMap.get(master);
                tsvLines[i] = `${puppet}\t${newMaster}\t${sheet}`;
            }
        }
    }

    const tsvContent = tsvLines.join('\n');
    

    // Step 1: Write TSV to main/public/static
    await fs.writeFile(mainFilePath, tsvContent, 'utf8');
    console.log(`Data saved to ${mainFilePath}`);

    // Step 2: Commit & push to main branch
    console.log('Committing and pushing changes to main...');
    await runGitCommand(`
      git fetch origin main --quiet &&
      git pull --ff-only origin main &&
      git add ${mainFilePath} &&
      git commit -m "Force update Google Sheets data in main branch" --allow-empty &&
      git push --force origin main
    `);

    // Step 3: Set up gh-pages worktree
    await setupWorktree();

    // Step 4: Copy file from main/public/static to gh-pages/static
    await fs.copyFile(mainFilePath, ghPagesFilePath);
    console.log(`Copied ${mainFilePath} to ${ghPagesFilePath}`);

    // Step 5: Commit & push to gh-pages
    console.log('Committing and pushing changes to gh-pages...');
    await runGitCommand(`
      cd ${worktreePath} &&
      git add static/puppetData.tsv &&
      git commit -m "Sync Google Sheets data from main to gh-pages" || true &&
      git push --force origin gh-pages
    `);
    

    // Step 6: Clean up worktree
    console.log('Removing gh-pages worktree...');
    await runGitCommand(`git worktree remove ${worktreePath} --force`);

  } catch (error) {
    console.error('Error processing Google Sheets:', error);
  }
}

processGoogleSheets().catch((error) => {
  console.error('Error processing Google Sheets:', error);
});