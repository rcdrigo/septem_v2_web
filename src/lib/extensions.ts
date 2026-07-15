/**
 * Catálogo de extensões para o campo de anexo (Fase 4c). Inclui os formatos de
 * arquitetura/engenharia que o produto precisa aceitar (dwg, dxf, rvt, ifc, skp…),
 * além dos comuns. O admin pode digitar qualquer outra — este catálogo é só o
 * atalho pesquisável.
 */
export const EXTENSION_CATALOG: { group: string; exts: string[] }[] = [
  { group: 'Documentos', exts: ['pdf', 'doc', 'docx', 'odt', 'txt', 'rtf'] },
  { group: 'Planilhas', exts: ['xls', 'xlsx', 'ods', 'csv'] },
  { group: 'Apresentações', exts: ['ppt', 'pptx', 'odp'] },
  { group: 'Imagens', exts: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'tiff', 'bmp'] },
  { group: 'Compactados', exts: ['zip', 'rar', '7z'] },
  { group: 'CAD / Arquitetura', exts: ['dwg', 'dxf', 'dwf', 'rvt', 'rfa', 'ifc', 'skp', 'pln', '3ds', 'step', 'stp', 'iges', 'igs', 'stl', 'obj'] },
  { group: 'GIS / Engenharia', exts: ['kml', 'kmz', 'shp', 'geojson', 'las'] },
];

export const ALL_EXTENSIONS: string[] = Array.from(
  new Set(EXTENSION_CATALOG.flatMap((g) => g.exts)),
);

export function parseExtCsv(csv: string | undefined): string[] {
  return (csv ?? '').split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
}

export function extCsv(exts: string[]): string {
  return Array.from(new Set(exts.map((e) => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean))).join(',');
}
