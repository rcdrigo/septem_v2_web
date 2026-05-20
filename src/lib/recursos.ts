import { downloadText, readTextFile } from './download';

/**
 * Ações da navbar "Recursos". Cada função opera sobre o modeler do bpmn-js
 * e devolve uma Promise resolvida quando a ação terminou.
 *
 * Espelha os itens do dropdown "Exportar" do `Designer2.ascx` do ZEEV
 * (BPMN/PNG/SVG) — aqui mantemos BPMN+PNG conforme spec.
 */

export async function exportBpmn(modeler: any, filename: string) {
  if (!modeler) return;
  const { xml } = await modeler.saveXML({ format: true });
  downloadText(safeFilename(filename, 'bpmn'), xml, 'application/xml');
}

export async function importBpmn(modeler: any, file: File) {
  if (!modeler) return;
  const xml = await readTextFile(file);
  await modeler.importXML(xml);
  modeler.get('canvas').zoom('fit-viewport', 'auto');
}

/**
 * Exporta o canvas como PNG. Usa o SVG do bpmn-js como base, embute as
 * folhas de estilo embutidas, e converte para imagem via `<canvas>`.
 */
export async function exportPng(modeler: any, filename: string) {
  if (!modeler) return;
  const { svg } = await modeler.saveSVG();

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(svgUrl);
    const { width, height } = measureSvg(svg, img);

    const canvas = document.createElement('canvas');
    canvas.width = width * 2; // 2x para qualidade em telas HiDPI
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D não disponível');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/png');
    triggerDownload(dataUrl, safeFilename(filename, 'png'));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

// ─── helpers locais ──────────────────────────────────────────────────────────

function safeFilename(name: string, ext: string): string {
  const base = (name || 'processo').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'processo';
  return base.endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao renderizar SVG do diagrama'));
    img.src = url;
  });
}

function measureSvg(svg: string, img: HTMLImageElement): { width: number; height: number } {
  // tenta extrair viewBox; fallback nos naturais
  const m = /viewBox="([\d.\- ]+)"/.exec(svg);
  if (m) {
    const parts = m[1].split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { width: parts[2], height: parts[3] };
    }
  }
  return { width: img.naturalWidth || 1200, height: img.naturalHeight || 800 };
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
