export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export async function listRecentFiles(daysBack: number): Promise<DriveFile[]> {
  console.log('[drive] Drive connector prepared — not yet wired.');
  return [];
}
