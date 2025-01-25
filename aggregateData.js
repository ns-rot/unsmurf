import { promises as fs } from 'fs'; // Node.js filesystem module
import fetch from 'node-fetch'; // Use node-fetch for HTTP requests
import { exec } from 'child_process'; // For running shell commands

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

const nationStatesApi = "https://www.nationstates.net/cgi-bin/api.cgi?q=nations";
const userAgent = "script=ns-unsmurf-github by=rotenaple";

async function fetchData(sheet) {
  // ... Fetch data logic remains the same ...
}

async function fetchNationStatesData() {
  // ... Fetch NationStates API data logic remains the same ...
}

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

async function aggregateData() {
  const tsvLines = ['puppet\tmaster\tsheet']; // Header row

  // Fetch data from Google Sheets
  for (const sheet of sheets) {
    console.log(`Fetching data from ${sheet.name}...`);
    const sheetData = await fetchData(sheet);
    tsvLines.push(...sheetData); // Append rows from the sheet
  }

  // Fetch data from NationStates API
  console.log('Fetching data from NationStates API...');
  const nationStatesData = await fetchNationStatesData();
  tsvLines.push(...nationStatesData.map((nation) => `${nation}\tnationstates_api\tnationstates`));

  const tsvContent = tsvLines.join('\n'); // Combine rows with newline separator

  try {
    // Create a worktree for the gh-pages branch if not already done
    console.log('Setting up gh-pages worktree...');
    await runGitCommand('git worktree add ../gh-pages gh-pages');

    // Save the TSV data to the gh-pages branch directory
    const filePath = '../gh-pages/static/puppetData.tsv';
    await fs.writeFile(filePath, tsvContent, 'utf8');
    console.log(`Data saved to ${filePath}`);

    // Commit and push changes to gh-pages
    console.log('Committing and pushing changes to gh-pages...');
    await runGitCommand(`
      cd ../gh-pages &&
      git add static/puppetData.tsv &&
      git commit -m "Update puppetData.tsv via script" &&
      git push origin gh-pages
    `);

    // Cleanup the worktree after push (optional)
    console.log('Removing gh-pages worktree...');
    await runGitCommand('git worktree remove ../gh-pages');
  } catch (error) {
    console.error('Error during gh-pages operations:', error);
  }
}

aggregateData().catch((error) => {
  console.error('Error aggregating data:', error);
});
