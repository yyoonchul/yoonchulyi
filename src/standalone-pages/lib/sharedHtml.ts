import { readdir, readFile } from 'node:fs/promises';
import { extname, join, basename } from 'node:path';

const sharedHtmlContentDir = join(process.cwd(), 'src/standalone-pages/content');

export interface SharedHtmlEntry {
  slug: string;
  fileName: string;
}

export async function getSharedHtmlEntries(): Promise<SharedHtmlEntry[]> {
  const fileNames = await readdir(sharedHtmlContentDir);

  return fileNames
    .filter((fileName) => extname(fileName) === '.html')
    .sort()
    .map((fileName) => ({
      slug: basename(fileName, '.html'),
      fileName,
    }));
}

export async function readSharedHtml(slug: string): Promise<string | null> {
  const entries = await getSharedHtmlEntries();
  const entry = entries.find((candidate) => candidate.slug === slug);

  if (!entry) {
    return null;
  }

  return readFile(join(sharedHtmlContentDir, entry.fileName), 'utf-8');
}
