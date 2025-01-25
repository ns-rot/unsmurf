import { promises as fs } from 'fs'; // Node.js filesystem module
import fetch from 'node-fetch'; // Use node-fetch for HTTP requests

const nationStatesApi = "https://www.nationstates.net/cgi-bin/api.cgi?q=nations";
const userAgent = "script=ns-unsmurf-github by=rotenaple";

async function fetchNationStatesData() {
    const filePath = './public/static/currentNations.txt';

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

    // Save nations to a text file
    await fs.writeFile(filePath, nations.join('\n'), 'utf8');
    console.log(`NationStates data saved to ${filePath}`);
    return nations;
  } catch (error) {
    console.error('Error fetching NationStates API data:', error);
    return [];
  }
}

fetchNationStatesData().catch((error) => {
  console.error('Error processing NationStates API data:', error);
});
