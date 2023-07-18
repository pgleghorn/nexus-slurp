import * as fs from 'fs';
import * as path from 'path';
import { ensureDir } from 'https://deno.land/std/fs/mod.ts';
import { download } from 'https://deno.land/x/download/mod.ts';

async function downloadFromNexus(
  baseUrl: string,
  repositoryPath: string,
  targetPath: string,
  caFile?: string
) {
  const options: RequestInit = {};
  if (caFile) {
    const caData = await Deno.readFile(caFile);
    options.caFile = caData;
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
        await download(itemUrl, itemPath);
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

// Usage example
const baseUrl = 'https://nexus.example.com/repository/raw';
const repositoryPath = 'my/repository/path';
const targetPath = './downloads';
const caFile = '/path/to/custom/ca/file.pem';

await ensureDir(targetPath);
await downloadFromNexus(baseUrl, repositoryPath, targetPath, caFile);
console.log('Download completed!');
