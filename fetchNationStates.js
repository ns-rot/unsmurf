import { promises as fs } from 'fs'; // Node.js filesystem module
import fetch from 'node-fetch'; // Use node-fetch for HTTP requests
import { exec } from 'child_process'; // For running Git commands
import { existsSync, rmSync } from 'fs'; // For checking and removing directories

const nationStatesApi = "https://www.nationstates.net/cgi-bin/api.cgi?q=nations";
const userAgent = "script=ns-unsmurf-github by=rotenaple";

// Paths for data files
const mainFilePath = `public/static/currentNations.txt`; // Path in main branch
const worktreePath = '../gh-pages'; // Worktree directory for gh-pages
const ghPagesFilePath = `${worktreePath}/static/currentNations.txt`; // Path in gh-pages

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

    // Step 1: Write NationStates data to main/public/static
    // Compute hash BEFORE writing
    const hashBefore = await computeFileHash(mainFilePath);
    console.log(`🔹 Hash before writing: ${hashBefore || "File does not exist"}`);

    // Write the updated data
    await fs.writeFile(mainFilePath, nations.join('\n'), { encoding: 'utf8', flag: 'w' });

    // Compute hash AFTER writing
    const hashAfter = await computeFileHash(mainFilePath);
    console.log(`🔹 Hash after writing: ${hashAfter}`);

    // Log if file changed
    if (hashBefore === hashAfter) {
      console.log("⚠️ File content is the same as before.");
    } else {
      console.log("✅ File content has changed, proceeding with commit.");
    }

    // Step 2: Commit & push to main branch
    console.log('Committing and pushing changes to main...');
    await runGitCommand(`
      git fetch origin main --quiet &&
      git pull --ff-only origin main &&
      git add ${mainFilePath} &&
      git commit -m "Force update NationStates data in main branch" --allow-empty &&
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
      git add static/currentNations.txt &&
      git commit -m "Sync NationStates data from main to gh-pages" || true &&
      git push --force origin gh-pages
    `);

    // Step 6: Clean up worktree
    console.log('Removing gh-pages worktree...');
    await runGitCommand(`git worktree remove ${worktreePath} --force`);

    return nations;
  } catch (error) {
    console.error('Error processing NationStates API data:', error);
    return [];
  }
}

import crypto from 'crypto'; // Import crypto for hashing

// Function to compute file hash
async function computeFileHash(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch (error) {
    return null; // Return null if file does not exist
  }
}

// Run the function
fetchNationStatesData().catch((error) => {
  console.error('Error processing NationStates API data:', error);
});