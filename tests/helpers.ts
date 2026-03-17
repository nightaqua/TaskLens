import { TFile } from 'obsidian';

/**
 * Helper to create mock TFile objects for testing
 */
export const createMockFile = (path: string): TFile => {
    const file = Object.create(TFile.prototype);
    if (file instanceof TFile) {
        file.path = path;
    }
    return file;
};
