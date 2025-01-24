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
  {
    name: "Rot Ext",
    url: "https://docs.google.com/spreadsheets/d/1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4/export?format=tsv&id=1osIbavh59GHFqQCO909jFRDX5XerSvZ7sWFfgMHLFs4&gid=708581263",
    puppetColumn: 0,
    mainColumn: 1,
    headerRows: 1,
  },
];

async function fetchData(sheet) {
  try {
    const response = await fetch(sheet.url); // Use the browser's native fetch API
    if (!response.ok) {
      console.error(`Failed to fetch ${sheet.name}: ${response.statusText}`);
      return [];
    }

    const data = await response.text(); // Read response as text
    const lines = data.split('\n').slice(sheet.headerRows); // Skip header rows

    return lines
      .map((line) => {
        const columns = line.split('\t');
        const puppet = columns[sheet.puppetColumn]?.trim().toLowerCase().replace(/\s+/g, '_');
        const master = columns[sheet.mainColumn]?.trim().toLowerCase().replace(/\s+/g, '_');
        return puppet && master ? `${puppet}\t${master}\t${sheet.name}` : null; // Format as TSV row
      })
      .filter(Boolean);
  } catch (error) {
    console.error(`Error fetching data for ${sheet.name}:`, error);
    return [];
  }
}

async function aggregateData() {
  const tsvLines = ['puppet\tmaster\tsheet']; // Header row

  for (const sheet of sheets) {
    console.log(`Fetching data from ${sheet.name}...`);
    const sheetData = await fetchData(sheet);
    tsvLines.push(...sheetData); // Append rows from the sheet
  }

  const tsvContent = tsvLines.join('\n'); // Combine rows with newline separator
  console.log('Aggregated TSV Data:\n', tsvContent);

  // If you want to download the data as a file in the browser:
  const blob = new Blob([tsvContent], { type: 'text/tab-separated-values' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'puppetData.tsv';
  link.click();

  return tsvContent; // Optionally return the TSV content
}

aggregateData().catch((error) => {
  console.error('Error aggregating data:', error);
});
