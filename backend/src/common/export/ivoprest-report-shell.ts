import { InternalServerErrorException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';

const reportLogger = new Logger('IvoprestReports');

function resolveTemplateDir() {
  const candidates = [
    path.join(process.cwd(), 'assets', 'templates', 'ivoprest-reports'),
    path.join(__dirname, '..', '..', '..', 'assets', 'templates', 'ivoprest-reports'),
    path.join(__dirname, '..', '..', '..', '..', 'assets', 'templates', 'ivoprest-reports'),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'styles.css'))) ?? candidates[0];
}

export const IVOPREST_TEMPLATE_DIR = resolveTemplateDir();

function resolveChromeExecutable(): string | undefined {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const linuxBins = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ];
  return linuxBins.find((bin) => fs.existsSync(bin));
}

export function esc(s: string | number | null | undefined) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function loadIvoprestCss() {
  return fs.readFileSync(path.join(IVOPREST_TEMPLATE_DIR, 'styles.css'), 'utf8');
}

export function loadIvoprestLogoDataUri() {
  const logoPath = path.join(IVOPREST_TEMPLATE_DIR, 'logo-ivoprest.jpg');
  if (!fs.existsSync(logoPath)) return '';
  const buf = fs.readFileSync(logoPath);
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

export function sheetHeader(logoDataUri: string) {
  return `<header class="sheet__header">
    <img src="${logoDataUri}" alt="Ivoprest" class="sheet__logo" />
  </header>`;
}

export function sheetFooter(left: string, page: number) {
  return `<footer class="sheet__footer">
    <span>${esc(left)}</span>
    <span class="page-num">${page}</span>
  </footer>`;
}

export type CoverField = {
  label: string;
  value: string;
  highlight?: boolean;
  code?: boolean;
  period?: { debut: string; debutIso: string; fin: string; finIso: string };
};

export type CoverMeta = {
  title: string;
  subtitle: string;
  note: string;
  footerLeft: string;
  fields: CoverField[];
  fieldRows?: Array<[CoverField, CoverField]>;
};

export function renderIvoprestCover(
  meta: CoverMeta,
  logoDataUri: string,
  page: number,
) {
  const fieldsHtml = meta.fields
    .map((f) => {
      if (f.period) {
        return `<div class="cover__field">
          <span class="cover__field-label">${esc(f.label)}</span>
          <span class="cover__field-value cover__field-value--period">
            <time datetime="${esc(f.period.debutIso)}">${esc(f.period.debut)}</time>
            <span class="cover__period-arrow" aria-hidden="true">→</span>
            <time datetime="${esc(f.period.finIso)}">${esc(f.period.fin)}</time>
          </span>
        </div>`;
      }
      const cls = [
        'cover__field',
        f.highlight ? 'cover__field--highlight' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const valueCls = [
        'cover__field-value',
        f.code ? 'cover__field-value--code' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<div class="${cls}">
        <span class="cover__field-label">${esc(f.label)}</span>
        <span class="${valueCls}">${esc(f.value)}</span>
      </div>`;
    })
    .join('\n');

  const rowsHtml = (meta.fieldRows ?? [])
    .map(
      ([a, b]) => `<div class="cover__field-row">
      <div class="cover__field">
        <span class="cover__field-label">${esc(a.label)}</span>
        <span class="cover__field-value${a.code ? ' cover__field-value--code' : ''}">${esc(a.value)}</span>
      </div>
      <div class="cover__field">
        <span class="cover__field-label">${esc(b.label)}</span>
        <span class="cover__field-value${b.code ? ' cover__field-value--code' : ''}">${esc(b.value)}</span>
      </div>
    </div>`,
    )
    .join('\n');

  return `<section class="sheet cover" aria-label="Page de garde">
    ${sheetHeader(logoDataUri)}
    <div class="cover__body">
      <h1 class="cover__title">${esc(meta.title)}</h1>
      <p class="cover__month">${esc(meta.subtitle)}</p>
      <article class="cover__card">
        <header class="cover__card-head">
          <div class="cover__card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="13" y2="17"/>
            </svg>
          </div>
          <div class="cover__card-head-text">
            <span class="cover__card-label">Document client</span>
            <span class="cover__card-sub">Informations de synthèse du rapport</span>
          </div>
        </header>
        <div class="cover__card-body">
          ${fieldsHtml}
          ${rowsHtml}
        </div>
      </article>
    </div>
    <p class="cover__note">${esc(meta.note)}</p>
    ${sheetFooter(meta.footerLeft, page)}
  </section>`;
}

export type TocItem = {
  label: string;
  page: number | string;
  sub?: boolean;
};

export function renderIvoprestToc(opts: {
  intro: string;
  items: TocItem[];
  footerLeft: string;
  logoDataUri: string;
  page: number;
}) {
  const items = opts.items
    .map(
      (it) =>
        `<li class="toc__item${it.sub ? ' toc__item--sub' : ''}"><span class="toc__label">${esc(it.label)}</span><span class="toc__page">${esc(it.page)}</span></li>`,
    )
    .join('\n');
  return `<section class="sheet" aria-label="Sommaire">
    ${sheetHeader(opts.logoDataUri)}
    <div class="sheet__inner">
      <h2 class="toc__title">Sommaire</h2>
      <p class="toc__intro">${esc(opts.intro)}</p>
      <ol class="toc__list">${items}</ol>
    </div>
    ${sheetFooter(opts.footerLeft, opts.page)}
  </section>`;
}

export function wrapIvoprestDocument(title: string, sectionsHtml: string) {
  const css = loadIvoprestCss();
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>
  <style>${css}</style>
</head>
<body>
  <main class="document">${sectionsHtml}</main>
</body>
</html>`;
}

export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const executablePath = resolveChromeExecutable();
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      timeout: 60_000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--font-render-hinting=none',
      ],
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    reportLogger.error(`Puppeteer launch failed: ${detail}`);
    throw new InternalServerErrorException(
      'Génération PDF impossible : Chrome/Chromium introuvable ou incomplet sur le serveur. ' +
        'Installez chromium (apt) ou définissez PUPPETEER_EXECUTABLE_PATH, puis relancez l’API.',
    );
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    reportLogger.error(`PDF render failed: ${detail}`);
    throw new InternalServerErrorException(
      'Génération PDF impossible : échec du rendu Chromium. Vérifiez les libs graphiques Linux et /dev/shm.',
    );
  } finally {
    await browser.close();
  }
}

export async function mergePdfAnnexes(
  mainBuffer: Buffer,
  annexes: Array<{ path: string; label?: string }>,
): Promise<Buffer> {
  if (annexes.length === 0) return mainBuffer;
  const merged = await PDFDocument.load(mainBuffer);
  for (const ann of annexes) {
    if (!fs.existsSync(ann.path)) continue;
    try {
      const annexDoc = await PDFDocument.load(fs.readFileSync(ann.path));
      const pages = await merged.copyPages(annexDoc, annexDoc.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    } catch {
      /* ignore unreadable pdf annex */
    }
  }
  return Buffer.from(await merged.save());
}

export function contentBlock(
  tag: string,
  title: string,
  desc: string,
  body: string,
) {
  return `<div class="content-block">
    <p class="section-tag">${esc(tag)}</p>
    <h2 class="section-title">${esc(title)}</h2>
    <p class="section-desc">${esc(desc)}</p>
    ${body}
  </div>`;
}

export function sectionSheet(opts: {
  landscape?: boolean;
  logoDataUri: string;
  footerLeft: string;
  page: number;
  ariaLabel: string;
  inner: string;
}) {
  return `<section class="sheet${opts.landscape ? ' sheet--landscape' : ''}" aria-label="${esc(opts.ariaLabel)}">
    ${sheetHeader(opts.logoDataUri)}
    <div class="sheet__inner">${opts.inner}</div>
    ${sheetFooter(opts.footerLeft, opts.page)}
  </section>`;
}
