import { promises as fs } from 'fs'; // Node.js filesystem module
import fetch from 'node-fetch'; // Use node-fetch for HTTP requests
import { exec } from 'child_process'; // For running Git commands
import { existsSync, rmSync } from 'fs'; // For checking and removing directories

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

// Paths for the data files
const mainFilePath = `public/static/puppetData.tsv`; // Path in main branch
const ghPagesPath = `../gh-pages/static/puppetData.tsv`; // Path in gh-pages branch

async function runGitCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running command "${command}":`, stderr);
        reject(error);
      } else {
        resolve(stdout.trim());
      }
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

async function processGoogleSheets() {
  const worktreePath = '../gh-pages';
  const tsvLines = ['puppet\tmaster\tsheet']; // Header row

  try {
    // Fetch and process each sheet
    for (const sheet of sheets) {
      console.log(`Fetching data from ${sheet.name}...`);
      const sheetData = await fetchData(sheet);
      tsvLines.push(...sheetData);
    }

    const tsvContent = tsvLines.join('\n');

    // Step 1: Write TSV to main/public/static
    await fs.writeFile(mainFilePath, tsvContent, 'utf8');
    console.log(`Data saved to ${mainFilePath}`);

    // Step 2: Commit & push to main branch
    console.log('Committing and pushing changes to main...');
    await runGitCommand(`
      git add ${mainFilePath} || true &&
      git diff --cached --quiet || git commit -m "Update Google Sheets data in main branch" &&
      git push origin main
    `);    

    // Step 3: Set up gh-pages worktree
    if (existsSync(worktreePath)) {
      console.log(`Worktree directory ${worktreePath} already exists. Removing it...`);
      rmSync(worktreePath, { recursive: true, force: true });
    }
    console.log('Setting up gh-pages worktree...');
    await runGitCommand(`git worktree add ${worktreePath} gh-pages`);

    // Step 4: Copy file from main/public/static to gh-pages/static
    await fs.copyFile(mainFilePath, ghPagesPath);
    console.log(`Copied ${mainFilePath} to ${ghPagesPath}`);

    // Step 5: Commit & push to gh-pages
    console.log('Committing and pushing changes to gh-pages...');
    await runGitCommand(`
      cd ${worktreePath} &&
      git add static/puppetData.tsv &&
      git commit -m "Sync Google Sheets data from main to gh-pages" &&
      git push origin gh-pages
    `);

    // Step 6: Remove the worktree
    console.log('Removing gh-pages worktree...');
    await runGitCommand(`git worktree remove ${worktreePath}`);

  } catch (error) {
    console.error('Error processing Google Sheets:', error);
  }
}

processGoogleSheets().catch((error) => {
  console.error('Error processing Google Sheets:', error);
});
