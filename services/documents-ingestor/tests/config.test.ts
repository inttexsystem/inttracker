import { describe, it, expect } from 'vitest';
import { config } from '../src/config.js';

describe('config (Drive-first)', () => {
  it('exposes googleDriveRootFolderName (Drive-first)', () => {
    expect(config.googleDriveRootFolderName).toBeTruthy();
  });

  it('exposes googleDriveCreateMissingFolders flag', () => {
    expect(typeof config.googleDriveCreateMissingFolders).toBe('boolean');
  });

  it('exposes localCachePath for non-canonical cache', () => {
    expect(config.localCachePath).toBeTruthy();
  });

  it('keeps databasePath and outboxPath local', () => {
    expect(config.databasePath).toBeTruthy();
    expect(config.outboxPath).toBeTruthy();
  });
});
