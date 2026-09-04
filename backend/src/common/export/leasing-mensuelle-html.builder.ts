import * as fs from 'fs';
import * as path from 'path';
import {
  esc,
  htmlToPdfBuffer,
  loadIvoprestCss,
  loadIvoprestLogoDataUri,
  mergePdfAnnexes,
  sheetFooter,
  sheetHeader,
} from './ivoprest-report-shell';
import {
  fmtNum,
  mapToHtmlView,
  sampleHtmlView,
  type LeasingMensuelleHtmlInput,
  type LeasingMensuelleHtmlView,
} from './leasing-mensuelle-view.mapper';

function loadCss() {
  return loadIvoprestCss();
}

function loadLogoDataUri() {
  return loadIvoprestLogoDataUri();
}

function renderCover(view: LeasingMensuelleHtmlView, logoDataUri: string, page: number) {
  const { meta } = view;
  return `<section class="sheet sheet--landscape cover" aria-label="Page de garde">
    ${sheetHeader(logoDataUri)}
    <div class="cover__body">
      <h1 class="cover__title">Rapport Leasing Mensuel</h1>
      <p class="cover__month">${esc(meta.moisLabel)}</p>
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
          <div class="cover__field cover__field--highlight">
            <span class="cover__field-label">Client</span>
            <span class="cover__field-value">${esc(meta.client)}</span>
          </div>
          <div class="cover__field">
            <span class="cover__field-label">Période couverte</span>
            <span class="cover__field-value cover__field-value--period">
              <time datetime="${esc(meta.periodeDebutIso)}">${esc(meta.periodeDebut)}</time>
              <span class="cover__period-arrow" aria-hidden="true">→</span>
              <time datetime="${esc(meta.periodeFinIso)}">${esc(meta.periodeFin)}</time>
            </span>
          </div>
          <div class="cover__field-row">
            <div class="cover__field">
              <span class="cover__field-label">Référence</span>
              <span class="cover__field-value cover__field-value--code">${esc(meta.reference)}</span>
            </div>
            <div class="cover__field">
              <span class="cover__field-label">Édition</span>
              <span class="cover__field-value">${meta.edition}</span>
            </div>
          </div>
        </div>
      </article>
    </div>
    <p class="cover__note">Rapport mensuel de leasing — relevés, marges incluses et assistances.</p>
    ${sheetFooter(`${meta.reference} · ${meta.footerBrand}`, page)}
  </section>`;
}

function renderToc(view: LeasingMensuelleHtmlView, logoDataUri: string, pages: TocPages) {
  const { meta } = view;
  const annexe1Item =
    view.annexeCompteurs.length > 0
      ? `<li class="toc__item toc__item--sub"><span class="toc__label">Annexe 1 — Photos des compteurs</span><span class="toc__page">${pages.annexe1}</span></li>`
      : '';
  const annexe2Item =
    view.annexeInterventions.length > 0
      ? `<li class="toc__item toc__item--sub"><span class="toc__label">Annexe 2 — Photos des interventions</span><span class="toc__page">${pages.annexe2}</span></li>`
      : '';
  return `<section class="sheet sheet--landscape" aria-label="Sommaire">
    ${sheetHeader(logoDataUri)}
    <div class="sheet__inner">
      <h2 class="toc__title">Sommaire</h2>
      <p class="toc__intro">
        Ce rapport mensuel regroupe les relevés compteurs, l'analyse des marges incluses,
        le calendrier des assistances et les pièces jointes photographiques.
      </p>
      <ol class="toc__list">
        <li class="toc__item"><span class="toc__label">Page de garde</span><span class="toc__page">${pages.cover}</span></li>
        <li class="toc__item"><span class="toc__label">1. Relevés compteurs par imprimante</span><span class="toc__page">${pages.releves}</span></li>
        <li class="toc__item"><span class="toc__label">2. Copies noir &amp; couleur à facturer</span><span class="toc__page">${pages.facturation}</span></li>
        <li class="toc__item"><span class="toc__label">3. Copieurs ayant dépassé la marge incluse</span><span class="toc__page">${pages.depassement}</span></li>
        <li class="toc__item"><span class="toc__label">4. Copieurs n'ayant pas dépassé la marge incluse</span><span class="toc__page">${pages.sousMarge}</span></li>
        <li class="toc__item"><span class="toc__label">5. Calendrier des assistances du mois</span><span class="toc__page">${pages.assistances}</span></li>
        ${annexe1Item}
        ${annexe2Item}
      </ol>
    </div>
    ${sheetFooter(`Sommaire · ${meta.footerBrand}`, pages.toc)}
  </section>`;
}

type TocPages = {
  cover: number;
  toc: number;
  releves: number;
  facturation: number;
  depassement: number;
  sousMarge: number;
  assistances: number;
  annexe1: number;
  annexe2: number;
};

function computeTocPages(view: LeasingMensuelleHtmlView): TocPages {
  const annexe1 = view.annexeCompteurs.length > 0 ? 8 : 0;
  const annexe2 =
    view.annexeInterventions.length > 0
      ? (annexe1 > 0 ? annexe1 : 8) + view.annexeCompteurs.length
      : 0;
  return {
    cover: 1,
    toc: 2,
    releves: 3,
    facturation: 4,
    depassement: 5,
    sousMarge: 6,
    assistances: 7,
    annexe1,
    annexe2,
  };
}

function renderReleves(view: LeasingMensuelleHtmlView, logoDataUri: string, page: number) {
  const rows =
    view.releves.length > 0
      ? view.releves
          .map(
            (r) => `<tr>
          <td class="code">${esc(r.imprimante)}</td>
          <td>${esc(r.localisation)}</td>
          <td>${esc(r.code)}</td>
          <td class="num">${fmtNum(r.debutN)}</td>
          <td class="num">${fmtNum(r.debutC)}</td>
          <td class="num">${fmtNum(r.finN)}</td>
          <td class="num">${fmtNum(r.finC)}</td>
          <td class="num">${fmtNum(r.diffN)}</td>
          <td class="num">${fmtNum(r.diffC)}</td>
        </tr>`,
          )
          .join('')
      : `<tr><td colspan="9" class="empty-state">Aucun relevé pour ce mois.</td></tr>`;

  return `<section class="sheet sheet--landscape" aria-label="Relevés compteurs">
    ${sheetHeader(logoDataUri)}
    <div class="sheet__inner">
      <div class="content-block">
        <div class="section-tag">Section 1</div>
        <h2 class="section-title">Relevés compteurs par imprimante</h2>
        <p class="section-desc">Index début / fin de période et différences consommées (Noir &amp; Couleur).</p>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Imprimante</th><th>Localisation</th><th>Relevé</th>
                <th class="num">Début N</th><th class="num">Début C</th>
                <th class="num">Fin N</th><th class="num">Fin C</th>
                <th class="num">Δ N</th><th class="num">Δ C</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
    ${sheetFooter(`${view.meta.reference} · ${view.meta.footerBrand}`, page)}
  </section>`;
}

function renderFacturation(view: LeasingMensuelleHtmlView, logoDataUri: string, page: number) {
  const t = view.totauxFacturation;
  const rows =
    view.facturation.length > 0
      ? view.facturation
          .map((r) => {
            const statut = r.sousQuota
              ? '<span class="badge badge--ok">Sous quota</span>'
              : '<span class="badge badge--danger">À facturer</span>';
            return `<tr>
          <td class="code">${esc(r.imprimante)}</td>
          <td>${esc(r.localisation)}</td>
          <td class="num">${fmtNum(r.consoN)}</td>
          <td class="num">${fmtNum(r.consoC)}</td>
          <td class="num">${fmtNum(r.quotaN)}</td>
          <td class="num">${fmtNum(r.quotaC)}</td>
          <td class="num">${fmtNum(r.factN)}</td>
          <td class="num">${fmtNum(r.factC)}</td>
          <td>${statut}</td>
        </tr>`;
          })
          .join('')
      : `<tr><td colspan="9" class="empty-state">Aucun relevé — rien à facturer.</td></tr>`;

  const tfoot =
    view.facturation.length > 0
      ? `<tfoot>
      <tr class="data-table__total">
        <td colspan="6"><strong>Total copies hors quota</strong></td>
        <td class="num"><strong>${fmtNum(t.factN)}</strong></td>
        <td class="num"><strong>${fmtNum(t.factC)}</strong></td>
        <td></td>
      </tr>
    </tfoot>`
      : '';

  return `<section class="sheet sheet--landscape" aria-label="Copies à facturer">
    ${sheetHeader(logoDataUri)}
    <div class="sheet__inner">
      <div class="content-block">
        <div class="section-tag">Section 2</div>
        <h2 class="section-title">Copies noir &amp; couleur à facturer</h2>
        <p class="section-desc">
          Détail par copieur : consommation, quota inclus et copies hors quota à facturer.
          Si le copieur reste sous quota, Fact. N et Fact. C valent <strong>0</strong>.
        </p>
        <div class="table-wrap">
          <table class="data-table data-table--facturation">
            <thead>
              <tr>
                <th>Copieur</th>
                <th>Localisation</th>
                <th class="num">Conso N</th>
                <th class="num">Conso C</th>
                <th class="num">Quota N</th>
                <th class="num">Quota C</th>
                <th class="num">Fact. N</th>
                <th class="num">Fact. C</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            ${tfoot}
          </table>
        </div>
        <div class="summary-box">
          Total copies hors quota ce mois :
          <span>${fmtNum(t.factN)} N</span> · <span>${fmtNum(t.factC)} C</span>
        </div>
      </div>
    </div>
    ${sheetFooter(`${view.meta.reference} · ${view.meta.footerBrand}`, page)}
  </section>`;
}

function renderMargeTable(
  rows: LeasingMensuelleHtmlView['depassement'],
  emptyMsg: string,
  showBadge: 'danger' | 'ok',
) {
  if (rows.length === 0) {
    return `<p class="empty-state">${esc(emptyMsg)}</p>`;
  }
  return `<div class="table-wrap"><table class="data-table">
    <thead>
      <tr>
        <th>Imprimante</th><th>Localisation</th>
        <th class="num">Quota N</th><th class="num">Quota C</th>
        <th class="num">Conso N</th><th class="num">Conso C</th>
        <th class="num">Fact. N</th><th class="num">Fact. C</th>
        <th class="num">Marge rest. N</th><th class="num">Marge rest. C</th>
        <th>Statut</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((r) => {
          const negN = r.margeRestanteN < 0;
          const negC = r.margeRestanteC < 0;
          const badge =
            showBadge === 'danger'
              ? '<span class="badge badge--danger">Dépassement</span>'
              : '<span class="badge badge--ok">Sous quota</span>';
          return `<tr>
            <td class="code">${esc(r.imprimante)}</td>
            <td>${esc(r.localisation)}</td>
            <td class="num">${fmtNum(r.quotaN)}</td>
            <td class="num">${fmtNum(r.quotaC)}</td>
            <td class="num">${fmtNum(r.consoN)}</td>
            <td class="num">${fmtNum(r.consoC)}</td>
            <td class="num">${fmtNum(r.factN)}</td>
            <td class="num">${fmtNum(r.factC)}</td>
            <td class="num ${negN ? 'val-negative' : 'val-positive'}">${fmtNum(r.margeRestanteN)}</td>
            <td class="num ${negC ? 'val-negative' : 'val-positive'}">${fmtNum(r.margeRestanteC)}</td>
            <td>${badge}</td>
          </tr>`;
        })
        .join('')}
    </tbody>
  </table></div>`;
}

function renderDepassement(view: LeasingMensuelleHtmlView, logoDataUri: string, page: number) {
  return `<section class="sheet sheet--landscape" aria-label="Dépassement marge">
    ${sheetHeader(logoDataUri)}
    <div class="sheet__inner">
      <div class="content-block">
        <div class="section-tag">Section 3</div>
        <h2 class="section-title">Copieurs ayant dépassé la marge incluse</h2>
        <p class="section-desc">Quota mensuel dépassé — copies hors quota à facturer (même critère que Fact. N / Fact. C).</p>
        ${renderMargeTable(view.depassement, 'Aucun dépassement ce mois.', 'danger')}
      </div>
    </div>
    ${sheetFooter(`${view.meta.reference} · ${view.meta.footerBrand}`, page)}
  </section>`;
}

function renderSousMarge(view: LeasingMensuelleHtmlView, logoDataUri: string, page: number) {
  const cumul =
    view.sousMarge.length > 0
      ? `<div class="summary-box">
          Cumul marge restante (parc sous quota) :
          <span>N ${fmtNum(view.cumulMargeN)}</span> · <span>Couleur ${fmtNum(view.cumulMargeC)}</span>
        </div>`
      : '';
  return `<section class="sheet sheet--landscape" aria-label="Sous marge">
    ${sheetHeader(logoDataUri)}
    <div class="sheet__inner">
      <div class="content-block">
        <div class="section-tag">Section 4</div>
        <h2 class="section-title">Copieurs n'ayant pas dépassé la marge incluse</h2>
        <p class="section-desc">Marge restante par copieur et cumul du parc sous quota.</p>
        ${renderMargeTable(view.sousMarge, 'Aucun copieur sous quota ce mois.', 'ok')}
        ${cumul}
      </div>
    </div>
    ${sheetFooter(`${view.meta.reference} · ${view.meta.footerBrand}`, page)}
  </section>`;
}

function renderAssistances(view: LeasingMensuelleHtmlView, logoDataUri: string, page: number) {
  const rows =
    view.assistances.length > 0
      ? view.assistances
          .map(
            (a) => `<tr>
          <td class="code">${esc(a.imprimante)}</td>
          <td>${esc(a.localisation)}</td>
          <td><div class="dates-list">${a.dates.map((d) => `<span class="date-chip">${esc(d)}</span>`).join('')}</div></td>
          <td class="center">${a.nb}</td>
        </tr>`,
          )
          .join('')
      : `<tr><td colspan="4" class="empty-state">Aucune assistance ce mois.</td></tr>`;

  return `<section class="sheet sheet--landscape" aria-label="Assistances">
    ${sheetHeader(logoDataUri)}
    <div class="sheet__inner">
      <div class="content-block">
        <div class="section-tag">Section 5</div>
        <h2 class="section-title">Calendrier des assistances du mois</h2>
            <p class="section-desc">Dates d'intervention par imprimante (1 assistance incluse / copieur / mois ; prélèvements compteur et pannes hors quota).</p>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Imprimante</th><th>Localisation</th><th>Dates des assistances</th><th class="center">Nb</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
    ${sheetFooter(`${view.meta.reference} · ${view.meta.footerBrand}`, page)}
  </section>`;
}

function renderAnnexePage(
  annexeNum: 1 | 2,
  item: { label: string; subtitle: string; imageDataUri: string | null },
  logoDataUri: string,
  page: number,
  footerBrand: string,
) {
  const placeholder =
    item.imageDataUri != null
      ? `<img src="${item.imageDataUri}" alt="${esc(item.label)}" style="max-width:100%;max-height:100%;object-fit:contain;" />`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
        </svg>
        ${annexeNum === 1 ? 'Photo / scan du compteur non disponible' : 'Photo preuve d\'intervention non disponible'}`;

  return `<section class="sheet sheet--landscape" aria-label="Annexe ${annexeNum} — ${esc(item.label)}">
    ${sheetHeader(logoDataUri)}
    <div class="sheet__inner">
      <div class="annexe-tag">Annexe ${annexeNum}</div>
      <h2 class="annexe-title">${esc(item.label)}</h2>
      <p class="annexe-sub">${esc(item.subtitle)}</p>
      <div class="photo-placeholder">${placeholder}</div>
    </div>
    ${sheetFooter(`Annexe ${annexeNum} · ${footerBrand}`, page)}
  </section>`;
}

export function buildLeasingMensuelleHtml(view: LeasingMensuelleHtmlView): string {
  const css = loadCss();
  const logoDataUri = loadLogoDataUri();
  const pages = computeTocPages(view);

  let pageNum = 1;
  const sections: string[] = [];

  sections.push(renderCover(view, logoDataUri, pageNum++));
  sections.push(renderToc(view, logoDataUri, pages));
  pageNum = 3;
  sections.push(renderReleves(view, logoDataUri, pageNum++));
  sections.push(renderFacturation(view, logoDataUri, pageNum++));
  sections.push(renderDepassement(view, logoDataUri, pageNum++));
  sections.push(renderSousMarge(view, logoDataUri, pageNum++));
  sections.push(renderAssistances(view, logoDataUri, pageNum++));

  for (const item of view.annexeCompteurs) {
    sections.push(renderAnnexePage(1, item, logoDataUri, pageNum++, view.meta.footerBrand));
  }
  for (const item of view.annexeInterventions) {
    sections.push(renderAnnexePage(2, item, logoDataUri, pageNum++, view.meta.footerBrand));
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Rapport Leasing Mensuel · ${esc(view.meta.moisLabel)} · Ivoprest</title>
  <style>${css}</style>
</head>
<body>
  <main class="document">${sections.join('\n')}</main>
</body>
</html>`;
}

export async function buildLeasingMensuelleHtmlPdf(
  data: LeasingMensuelleHtmlInput,
): Promise<Buffer> {
  const view = mapToHtmlView(data);
  const html = buildLeasingMensuelleHtml(view);
  const mainBuffer = await htmlToPdfBuffer(html);
  return mergePdfAnnexes(mainBuffer, view.pdfAnnexes);
}

export async function buildLeasingMensuelleSamplePdf(): Promise<Buffer> {
  const view = sampleHtmlView();
  const html = buildLeasingMensuelleHtml(view);
  return htmlToPdfBuffer(html);
}

export async function writeLeasingMensuelleHtmlSampleFile(outPath?: string): Promise<string> {
  const target =
    outPath ??
    path.join(process.cwd(), 'assets', 'templates', 'modele-leasing-mensuelle.pdf');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const buffer = await buildLeasingMensuelleSamplePdf();
  fs.writeFileSync(target, buffer);
  return target;
}
