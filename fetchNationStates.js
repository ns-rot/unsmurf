import { promises as fs } from 'fs'; // Node.js filesystem module
import fetch from 'node-fetch'; // Use node-fetch for HTTP requests
import { exec } from 'child_process'; // For running Git commands

const nationStatesApi = "https://www.nationstates.net/cgi-bin/api.cgi?q=nations";
const userAgent = "script=ns-unsmurf-github by=rotenaple";

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

async function fetchNationStatesData() {
  const filePath = '../gh-pages/static/currentNations.txt';

  try {
    console.log('Setting up gh-pages worktree...');
    await runGitCommand('git worktree add ../gh-pages gh-pages');

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
    const match = data.match(/<NATIONS>(.*?)<\/NATIONS>/);
    if (!match) {
      console.error('No nations found in NationStates API response.');
      return [];
    }

    const nations = match[1].split(',').map((nation) => {
      return nation.trim().toLowerCase().replace(/\s+/g, '_');
    });

    // Save nations to the gh-pages branch directory
    await fs.writeFile(filePath, nations.join('\n'), 'utf8');
    console.log(`NationStates data saved to ${filePath}`);

    // Commit and push changes to gh-pages
    console.log('Committing and pushing changes to gh-pages...');
    await runGitCommand(`
      cd ../gh-pages &&
      git add static/currentNations.txt &&
      git commit -m "Update NationStates data" &&
      git push origin gh-pages
    `);

    // Clean up the worktree
    console.log('Removing gh-pages worktree...');
    await runGitCommand('git worktree remove ../gh-pages');

    return nations;
  } catch (error) {
    console.error('Error processing NationStates API data:', error);
    return [];
  }
}

fetchNationStatesData().catch((error) => {
  console.error('Error processing NationStates API data:', error);
});
