import { TFile } from 'obsidian';

/**
 * Helper to create mock TFile objects for testing
 */
export const createMockFile = (path: string): TFile => {
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
    const file = Object.create(TFile.prototype) as TFile;
    if (file instanceof TFile) {
        Object.assign(file, { path });
        return file;
    }
    // Should never reach here in tests given Object.create
    throw new Error('Could not create mock TFile');
};
