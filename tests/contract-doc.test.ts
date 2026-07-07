import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Control Tapetes contract document', () => {
  it('docs/CONTROL_TAPETES_DOCUMENTS_CONTRACT.md exists', () => {
    const path = resolve(process.cwd(), 'docs', 'CONTROL_TAPETES_DOCUMENTS_CONTRACT.md');
    expect(existsSync(path)).toBe(true);
  });

  it('contract mentions pending_app_acceptance', () => {
    const path = resolve(process.cwd(), 'docs', 'CONTROL_TAPETES_DOCUMENTS_CONTRACT.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('pending_app_acceptance');
  });

  it('contract explicitly states outbox is operational', () => {
    const path = resolve(process.cwd(), 'docs', 'CONTROL_TAPETES_DOCUMENTS_CONTRACT.md');
    const content = readFileSync(path, 'utf-8');
    expect(content.toLowerCase()).toContain('outbox operacional');
  });

  it('contract lists all event types', () => {
    const path = resolve(process.cwd(), 'docs', 'CONTROL_TAPETES_DOCUMENTS_CONTRACT.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('document.detected');
    expect(content).toContain('document.linked');
    expect(content).toContain('document.accepted');
    expect(content).toContain('document.rejected');
    expect(content).toContain('ingestion_event_id');
    expect(content).toContain('drive_web_view_link');
  });

  it('contract lists document.detected event fields', () => {
    const path = resolve(process.cwd(), 'docs', 'CONTROL_TAPETES_DOCUMENTS_CONTRACT.md');
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('document.detected');
    expect(content).toContain('pedido_manual');
    expect(content).toContain('drive_file_id');
    expect(content).toContain('manifest_storage_uri');
  });
});
