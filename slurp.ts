import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ensureDir } from 'https://deno.land/std/fs/mod.ts';

async function downloadFromNexus(
  baseUrl: string,
  repositoryPath: string,
  targetPath: string,
  caFile?: string
) {
  const options: any = {};
  if (caFile) {
    const caData = await fs.readFile(caFile);
    options.caData = caData;
  }

  let page = 1;
  let hasNextPage = true;
  while (hasNextPage) {
    const response = await fetch(`${baseUrl}/${repositoryPath}?page=${page}`, options);
    if (!response.ok) {
      throw new Error(`Failed to fetch repository listing: ${response.status} ${response.statusText}`);
    }

    const repositoryListing = await response.json();
    for (const item of repositoryListing.items) {
      if (item.type === 'file') {
        const itemUrl = `${baseUrl}/${repositoryPath}/${item.name}`;
        const relativeFilePath = path.join(repositoryPath, item.name);
        const itemPath = path.join(targetPath, relativeFilePath);

        console.log(`Downloading: ${itemUrl}`);
        await saveFile(itemUrl, itemPath);
        console.log(`Downloaded: ${itemPath}`);
      } else if (item.type === 'directory') {
        const subdirectoryPath = path.join(targetPath, repositoryPath, item.name);
        await ensureDir(subdirectoryPath);
        
        await downloadFromNexus(baseUrl, `${repositoryPath}/${item.name}`, targetPath, caFile);
      }
    }

    hasNextPage = repositoryListing.page < repositoryListing.pages;
    page++;
  }
}

async function saveFile(url: string, filePath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const fileContent = await response.arrayBuffer();
  await fs.writeFile(filePath, new Uint8Array(fileContent));
}

// Command line switches
const switches = {
  '--baseUrl': { description: 'Base URL of the Nexus server', value: '' },
  '--repositoryPath': { description: 'Path of the repository on the Nexus server', value: '' },
  '--targetPath': { description: 'Path where the downloaded files will be saved', value: '' },
  '--caFile': { description: 'Path to the custom CA file', value: '' },
  '--help': { description: 'Prints the available switches', value: false },
};

for (let i = 0; i < Deno.args.length; i++) {
  const arg = Deno.args[i];

  if (arg in switches) {
    if (arg === '--help') {
      printHelp();
      Deno.exit();
    }

    switches[arg].value = Deno.args[i + 1];
  }
}

function printHelp() {
  console.log('Usage: deno run --allow-net --allow-write --allow-read downloadFromNexus.ts [switches]');
  console.log('');
  console.log('Switches:');
  Object.entries(switches).forEach(([switchName, { description }]) => {
    console.log(`  ${switchName}\t${description}`);
  });
}

// Usage example
const baseUrl = switches['--baseUrl'].value || 'https://nexus.example.com/repository/raw';
const repositoryPath = switches['--repositoryPath'].value || 'my/repository/path';
const targetPath = switches['--targetPath'].value || './downloads';
const caFile = switches['--caFile'].value || '/path/to/custom/ca/file.pem';

await ensureDir(targetPath);
await downloadFromNexus(baseUrl, repositoryPath, targetPath, caFile);
console.log('Download completed!');
