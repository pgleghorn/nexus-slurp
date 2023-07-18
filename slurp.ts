import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureDir } from 'https://deno.land/std/fs/mod.ts';

async function downloadFromNexus(
  baseUrl: string,
  repositoryPath: string,
  targetPath: string,
  caFile?: string
) {
  const options: RequestInit = {};
  if (caFile) {
    const caData = await fs.promises.readFile(caFile);
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

  const fileStream = await fs.promises.open(filePath, 'w');
  await Deno.copy(response.body!, fileStream);
  fileStream.close();
}

// Usage example
const baseUrl = 'https://nexus.example.com/repository/raw';
const repositoryPath = 'my/repository/path';
const targetPath = './downloads';
const caFile = '/path/to/custom/ca/file.pem';

await ensureDir(targetPath);
await downloadFromNexus(baseUrl, repositoryPath, targetPath, caFile);
console.log('Download completed!');
