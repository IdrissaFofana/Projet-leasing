import {
  contentBlock,
  esc,
  htmlToPdfBuffer,
  loadIvoprestLogoDataUri,
  renderIvoprestCover,
  renderIvoprestToc,
  sectionSheet,
  wrapIvoprestDocument,
} from './ivoprest-report-shell';
import {
  fmtNum,
  mapToAnnuelleView,
  resolveLeasingPeriode,
  type LeasingAnnuelleHtmlView,
  type LeasingPeriodeSpec,
} from './leasing-annuelle-view.mapper';

export { mapToAnnuelleView, resolveLeasingPeriode };

function renderResume(view: LeasingAnnuelleHtmlView, logo: string, page: number) {
  const { resume, meta } = view;
  const cards = [
    ['Parc actif', String(resume.imprimantesActives)],
    ['Relevés', String(resume.releves)],
    ['Interventions', String(resume.interventions)],
    ['Assistances incluses', String(resume.assistancesIncluses)],
    ['Pannes', String(resume.pannes)],
    ['Dépassements marge', String(resume.depassements)],
    ['Conso N', fmtNum(resume.consoN)],
    ['Conso C', fmtNum(resume.consoC)],
    ['Facturable N', fmtNum(resume.facturerN)],
    ['Facturable C', fmtNum(resume.facturerC)],
  ];
  const body = `<div class="summary-box" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px 18px;">
    ${cards.map(([k, v]) => `<div><span class="cover__field-label">${esc(k)}</span><div><strong>${esc(v)}</strong></div></div>`).join('')}
  </div>`;
  return sectionSheet({
    logoDataUri: logo,
    footerLeft: `${meta.reference} · ${meta.footerBrand}`,
    page,
    ariaLabel: meta.syntheseLabel,
    inner: contentBlock(
      'Section 1',
      meta.syntheseLabel,
      `Vue d'ensemble du parc et des volumes — ${meta.subtitle}.`,
      body,
    ),
  });
}

function renderConso(view: LeasingAnnuelleHtmlView, logo: string, page: number) {
  const rows =
    view.conso.length === 0
      ? `<tr><td colspan="8" class="empty-state">Aucune consommation enregistrée</td></tr>`
      : view.conso
          .map(
            (r) => `<tr>
        <td class="code">${esc(r.code)}</td>
        <td>${esc(r.localisation)}</td>
        <td class="center">${r.moisCouvert}</td>
        <td class="num">${fmtNum(r.consoN)}</td>
        <td class="num">${fmtNum(r.consoC)}</td>
        <td class="num">${fmtNum(r.facturerN)}</td>
        <td class="num">${fmtNum(r.facturerC)}</td>
        <td class="center">${r.depassements}</td>
      </tr>`,
          )
          .join('');
  const body = `<div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th>Copieur</th><th>Localisation</th><th class="center">Mois</th>
      <th class="num">Conso N</th><th class="num">Conso C</th>
      <th class="num">Fact. N</th><th class="num">Fact. C</th>
      <th class="center">Dépass.</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
  return sectionSheet({
    landscape: true,
    logoDataUri: logo,
    footerLeft: `${view.meta.reference} · ${view.meta.footerBrand}`,
    page,
    ariaLabel: 'Consommation',
    inner: contentBlock(
      'Section 2',
      'Consommation par imprimante',
      'Cumul des volumes noir / couleur et mois de dépassement de marge sur la période.',
      body,
    ),
  });
}

function renderAssistances(view: LeasingAnnuelleHtmlView, logo: string, page: number) {
  const rows = view.assistancesParMois
    .map(
      (r) => `<tr>
      <td>${esc(r.moisLabel)}</td>
      <td class="center">${r.incluses}</td>
      <td class="center">${r.pannes}</td>
      <td class="center">${r.prelevements}</td>
      <td class="center">${r.incluses + r.pannes + r.prelevements}</td>
    </tr>`,
    )
    .join('');
  const body = `<div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th>Mois</th><th>Incluses</th><th>Pannes</th><th>Prélèvements</th><th>Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
  return sectionSheet({
    logoDataUri: logo,
    footerLeft: `${view.meta.reference} · ${view.meta.footerBrand}`,
    page,
    ariaLabel: 'Assistances',
    inner: contentBlock(
      'Section 3',
      'Assistances par mois',
      '1 assistance incluse / copieur / mois — prélèvements et pannes hors quota.',
      body,
    ),
  });
}

function renderTypes(view: LeasingAnnuelleHtmlView, logo: string, page: number) {
  const rows =
    view.interventionsParType.length === 0
      ? `<tr><td colspan="2" class="empty-state">Aucune intervention</td></tr>`
      : view.interventionsParType
          .map(
            (r) => `<tr>
        <td>${esc(r.label)}</td>
        <td class="center">${r.count}</td>
      </tr>`,
          )
          .join('');
  const body = `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Tâche / type</th><th>Occurrences</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
  return sectionSheet({
    logoDataUri: logo,
    footerLeft: `${view.meta.reference} · ${view.meta.footerBrand}`,
    page,
    ariaLabel: 'Interventions par type',
    inner: contentBlock(
      'Section 4',
      'Interventions par type de tâche',
      'Dénombrement des tâches sur la période (une intervention multi-tâches compte pour chaque tâche).',
      body,
    ),
  });
}

export function buildLeasingAnnuelleHtml(view: LeasingAnnuelleHtmlView): string {
  const logo = loadIvoprestLogoDataUri();
  const footer = `${view.meta.reference} · ${view.meta.footerBrand}`;
  const sections = [
    renderIvoprestCover(
      {
        title: view.meta.title,
        subtitle: view.meta.subtitle,
        note: view.meta.note,
        footerLeft: footer,
        fields: [
          { label: 'Client', value: view.meta.client, highlight: true },
          {
            label: 'Période couverte',
            value: '',
            period: {
              debut: view.meta.periodeDebut,
              debutIso: view.meta.periodeDebutIso,
              fin: view.meta.periodeFin,
              finIso: view.meta.periodeFinIso,
            },
          },
        ],
        fieldRows: [
          [
            { label: 'Référence', value: view.meta.reference, code: true },
            { label: 'Édition', value: view.meta.edition },
          ],
        ],
      },
      logo,
      1,
      { landscape: true },
    ),
    renderIvoprestToc({
      intro: `Ce rapport ${view.meta.kind === 'annuelle' ? 'annuel' : view.meta.kind === 'semestrielle' ? 'semestriel' : 'trimestriel'} regroupe la synthèse du parc, les consommations cumulées, les assistances mensuelles et le détail des interventions par type de tâche.`,
      items: [
        { label: 'Page de garde', page: 1 },
        { label: `1. ${view.meta.syntheseLabel}`, page: 3 },
        { label: '2. Consommation par imprimante', page: 4 },
        { label: '3. Assistances par mois', page: 5 },
        { label: '4. Interventions par type de tâche', page: 6 },
      ],
      footerLeft: footer,
      logoDataUri: logo,
      page: 2,
      landscape: true,
    }),
    renderResume(view, logo, 3),
    renderConso(view, logo, 4),
    renderAssistances(view, logo, 5),
    renderTypes(view, logo, 6),
  ];
  return wrapIvoprestDocument(
    `${view.meta.title} · ${view.meta.subtitle} · Ivoprest`,
    sections.join('\n'),
  );
}

export async function buildLeasingPeriodeHtmlPdf(input: {
  spec: LeasingPeriodeSpec;
  clientNom: string;
  releves: Parameters<typeof mapToAnnuelleView>[0]['releves'];
  maintenances: Parameters<typeof mapToAnnuelleView>[0]['maintenances'];
  imprimantesActives: number;
}): Promise<{ buffer: Buffer; filename: string; labelCourt: string }> {
  const periode = resolveLeasingPeriode(input.spec);
  const view = mapToAnnuelleView({
    periode,
    clientNom: input.clientNom,
    releves: input.releves,
    maintenances: input.maintenances,
    imprimantesActives: input.imprimantesActives,
  });
  const buffer = await htmlToPdfBuffer(buildLeasingAnnuelleHtml(view));
  return {
    buffer,
    filename: `${periode.filenameSlug}.pdf`,
    labelCourt: periode.labelCourt,
  };
}

/** Compat : rapport annuel */
export async function buildLeasingAnnuelleHtmlPdf(input: {
  annee: string;
  clientNom: string;
  releves: Parameters<typeof mapToAnnuelleView>[0]['releves'];
  maintenances: Parameters<typeof mapToAnnuelleView>[0]['maintenances'];
  imprimantesActives: number;
}): Promise<Buffer> {
  const { buffer } = await buildLeasingPeriodeHtmlPdf({
    spec: { kind: 'annuelle', annee: input.annee },
    clientNom: input.clientNom,
    releves: input.releves,
    maintenances: input.maintenances,
    imprimantesActives: input.imprimantesActives,
  });
  return buffer;
}
