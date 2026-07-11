import { config } from '../config.js';
import type { TipoDocumento, DirecaoNF } from '../types/document.js';

export interface DriveLogicalPath {
  backend: 'google_drive';
  rootFolderName: string;
  logicalPath: string;
  folderUri?: string;
}

function todayDir(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rootName(): string {
  return config.googleDriveRootFolderName;
}

export function tipoSubfolder(tipo: TipoDocumento, direcaoNf?: DirecaoNF | null): string {
  if (tipo === 'nf') {
    const dir = direcaoNf ?? 'desconhecida';
    return `nf/${dir}`;
  }
  return tipo;
}

export function pendenteDrivePath(params: {
  date?: string;
  tipoDocumento: TipoDocumento;
  direcaoNf?: DirecaoNF | null;
  filename?: string;
}): DriveLogicalPath {
  const date = params.date ?? todayDir();
  const sub = tipoSubfolder(params.tipoDocumento, params.direcaoNf);
  const path = params.filename
    ? `${rootName()}/pendentes/${date}/${sub}/${params.filename}`
    : `${rootName()}/pendentes/${date}/${sub}`;
  return {
    backend: 'google_drive',
    rootFolderName: rootName(),
    logicalPath: path,
  };
}

export function pedidoDocumentDrivePath(params: {
  pedidoManual: string;
  date?: string;
  tipoDocumento: TipoDocumento;
  direcaoNf?: DirecaoNF | null;
  filename: string;
}): DriveLogicalPath {
  const date = params.date ?? todayDir();
  const sub = tipoSubfolder(params.tipoDocumento, params.direcaoNf);
  const path = `${rootName()}/pedidos/${params.pedidoManual}/${date}/${sub}/${params.filename}`;
  return {
    backend: 'google_drive',
    rootFolderName: rootName(),
    logicalPath: path,
  };
}

export function pedidoSubfolderDrivePath(params: {
  pedidoManual: string;
  date?: string;
  tipoDocumento: TipoDocumento;
  direcaoNf?: DirecaoNF | null;
}): DriveLogicalPath {
  const date = params.date ?? todayDir();
  const sub = tipoSubfolder(params.tipoDocumento, params.direcaoNf);
  const path = `${rootName()}/pedidos/${params.pedidoManual}/${date}/${sub}`;
  return {
    backend: 'google_drive',
    rootFolderName: rootName(),
    logicalPath: path,
  };
}

export function manifestDrivePath(pedidoManual: string): DriveLogicalPath {
  return {
    backend: 'google_drive',
    rootFolderName: rootName(),
    logicalPath: `${rootName()}/pedidos/${pedidoManual}/manifest.json`,
  };
}

export function taxonomiaDatePath(date?: string): string {
  if (date) {
    const parts = date.replace(/-/g, '/').split('/');
    return parts.join('/');
  }
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

export function recebidoDrivePath(params: {
  date?: string;
  tipoDocumento: TipoDocumento;
  direcaoNf?: DirecaoNF | null;
  filename?: string;
}): DriveLogicalPath {
  const date = taxonomiaDatePath(params.date);
  const sub = tipoSubfolder(params.tipoDocumento, params.direcaoNf);
  const path = params.filename
    ? `${rootName()}/Recebidos/${date}/${sub}/${params.filename}`
    : `${rootName()}/Recebidos/${date}/${sub}`;
  return {
    backend: 'google_drive',
    rootFolderName: rootName(),
    logicalPath: path,
  };
}

export function pedidoTaxonomiaDocumentDrivePath(params: {
  pedidoManual: string;
  date?: string;
  tipoDocumento: TipoDocumento;
  direcaoNf?: DirecaoNF | null;
  filename: string;
}): DriveLogicalPath {
  const date = taxonomiaDatePath(params.date);
  const sub = tipoSubfolder(params.tipoDocumento, params.direcaoNf);
  const path = `${rootName()}/Pedidos/${params.pedidoManual}/${date}/${sub}/${params.filename}`;
  return {
    backend: 'google_drive',
    rootFolderName: rootName(),
    logicalPath: path,
  };
}

export function pedidoTaxonomiaFolderDrivePath(params: {
  pedidoManual: string;
  date?: string;
  tipoDocumento: TipoDocumento;
  direcaoNf?: DirecaoNF | null;
}): DriveLogicalPath {
  const date = taxonomiaDatePath(params.date);
  const sub = tipoSubfolder(params.tipoDocumento, params.direcaoNf);
  const path = `${rootName()}/Pedidos/${params.pedidoManual}/${date}/${sub}`;
  return {
    backend: 'google_drive',
    rootFolderName: rootName(),
    logicalPath: path,
  };
}

export function localCacheRoot(): string {
  return config.localCachePath;
}
