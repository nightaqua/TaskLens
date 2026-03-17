import { TFile } from 'obsidian';

/**
 * Helper to create mock TFile objects for testing
 */
export const createMockFile = (path: string): TFile => {
    const file = Object.create(TFile.prototype);
    if (file instanceof TFile) {
        Object.assign(file, { path });
        return file;
    }
    // Should never reach here in tests given Object.create
    throw new Error('Could not create mock TFile');
};
