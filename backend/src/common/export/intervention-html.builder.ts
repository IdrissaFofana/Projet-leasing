import {
  contentBlock,
  esc,
  htmlToPdfBuffer,
  loadIvoprestLogoDataUri,
  mergePdfAnnexes,
  renderIvoprestCover,
  renderIvoprestToc,
  sectionSheet,
  wrapIvoprestDocument,
} from './ivoprest-report-shell';
import { TYPE_MAINTENANCE_LABEL } from './leasing-annuelle-view.mapper';
import { absoluteUploadPath } from '../upload/report-files';

export type InterventionReportInput = {
  code: string;
  dateMaintenance: Date | string;
  heure?: string | null;
  type: string;
  taches: string[];
  horsQuota: boolean;
  releveId?: string | null;
  moisAssistance?: string | null;
  actionsRealisees?: string | null;
  piecesConsommables?: string | null;
  observations?: string | null;
  prochaineMaintenance?: Date | string | null;
  clientNom: string;
  technicien?: string | null;
  assignee?: string | null;
  copieurs: Array<{ code: string; localisation: string | null; modele?: string | null }>;
  rapportPath?: string | null;
  rapportMime?: string | null;
  releveCode?: string | null;
};

function formatDateFr(d: Date | string | null | undefined) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR');
}

function quotaLabel(input: InterventionReportInput) {
  if (input.horsQuota) return 'Panne signalée (hors quota)';
  if (input.releveId) return 'Prélèvement compteur (hors quota)';
  if (input.type === 'ASSISTANCE' || input.taches.includes('ASSISTANCE')) {
    return 'Assistance incluse';
  }
  return 'Hors quota assistances';
}

export function buildInterventionHtml(input: InterventionReportInput): string {
  const logo = loadIvoprestLogoDataUri();
  const taches = (input.taches.length ? input.taches : [input.type]).map(
    (t) => TYPE_MAINTENANCE_LABEL[t] ?? t,
  );
  const dateLabel = formatDateFr(input.dateMaintenance);
  const reference = input.code;
  const footer = `${reference} · Ivoprest`;
  const edition = new Date().toLocaleDateString('fr-FR');

  const cover = renderIvoprestCover(
    {
      title: 'Rapport d’intervention',
      subtitle: `${input.code} · ${dateLabel}`,
      note: 'Compte rendu d’intervention — copieurs concernés, tâches réalisées et observations.',
      footerLeft: footer,
      fields: [
        { label: 'Client', value: input.clientNom, highlight: true },
        {
          label: 'Date d’intervention',
          value: dateLabel + (input.heure ? ` · ${input.heure}` : ''),
        },
      ],
      fieldRows: [
        [
          { label: 'Référence', value: reference, code: true },
          { label: 'Édition', value: edition },
        ],
      ],
    },
    logo,
    1,
  );

  const toc = renderIvoprestToc({
    intro:
      'Ce document détaille l’intervention : identification, copieurs, tâches réalisées, actions et pièces jointes.',
    items: [
      { label: 'Page de garde', page: 1 },
      { label: '1. Identification', page: 3 },
      { label: '2. Copieurs concernés', page: 4 },
      { label: '3. Tâches réalisées', page: 5 },
      { label: '4. Actions & observations', page: 6 },
    ],
    footerLeft: footer,
    logoDataUri: logo,
    page: 2,
  });

  const idBody = `<div class="summary-box" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px 18px;">
    <div><span class="cover__field-label">Code</span><div><strong class="code">${esc(input.code)}</strong></div></div>
    <div><span class="cover__field-label">Date</span><div><strong>${esc(dateLabel)}</strong></div></div>
    <div><span class="cover__field-label">Technicien</span><div><strong>${esc(input.technicien ?? '—')}</strong></div></div>
    <div><span class="cover__field-label">Assigné</span><div><strong>${esc(input.assignee ?? '—')}</strong></div></div>
    <div><span class="cover__field-label">Mois assistance</span><div><strong>${esc(input.moisAssistance ?? '—')}</strong></div></div>
    <div><span class="cover__field-label">Quota</span><div><strong>${esc(quotaLabel(input))}</strong></div></div>
    <div><span class="cover__field-label">Relevé lié</span><div><strong>${esc(input.releveCode ?? '—')}</strong></div></div>
    <div><span class="cover__field-label">Prochaine</span><div><strong>${esc(formatDateFr(input.prochaineMaintenance))}</strong></div></div>
  </div>`;

  const idSheet = sectionSheet({
    logoDataUri: logo,
    footerLeft: footer,
    page: 3,
    ariaLabel: 'Identification',
    inner: contentBlock(
      'Section 1',
      'Identification de l’intervention',
      'Références, affectation et statut au regard du quota mensuel.',
      idBody,
    ),
  });

  const copieurRows =
    input.copieurs.length === 0
      ? `<tr><td colspan="3" class="empty-state">Aucun copieur</td></tr>`
      : input.copieurs
          .map(
            (c) => `<tr>
        <td class="code">${esc(c.code)}</td>
        <td>${esc(c.localisation ?? '—')}</td>
        <td>${esc(c.modele ?? '—')}</td>
      </tr>`,
          )
          .join('');
  const copieursSheet = sectionSheet({
    logoDataUri: logo,
    footerLeft: footer,
    page: 4,
    ariaLabel: 'Copieurs',
    inner: contentBlock(
      'Section 2',
      'Copieurs concernés',
      'Une intervention peut porter sur un ou plusieurs copieurs.',
      `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Code</th><th>Localisation</th><th>Modèle</th></tr></thead>
        <tbody>${copieurRows}</tbody>
      </table></div>`,
    ),
  });

  const tacheChips = taches
    .map((t, i) => `<span class="date-chip">${i + 1}. ${esc(t)}</span>`)
    .join(' ');
  const tachesSheet = sectionSheet({
    logoDataUri: logo,
    footerLeft: footer,
    page: 5,
    ariaLabel: 'Tâches',
    inner: contentBlock(
      'Section 3',
      'Tâches réalisées',
      taches.length > 1
        ? `${taches.length} tâches énumérées pour cette intervention.`
        : 'Tâche unique réalisée lors de l’intervention.',
      `<div class="dates-list">${tacheChips || '<span class="empty-state">Aucune tâche</span>'}</div>
       <p style="margin-top:14px"><span class="cover__field-label">Type principal</span>
       <strong> ${esc(TYPE_MAINTENANCE_LABEL[input.type] ?? input.type)}</strong></p>`,
    ),
  });

  const actionsBody = `<div class="summary-box">
    <p><span class="cover__field-label">Actions réalisées</span></p>
    <p>${esc(input.actionsRealisees ?? '—')}</p>
    <p style="margin-top:12px"><span class="cover__field-label">Pièces / consommables</span></p>
    <p>${esc(input.piecesConsommables ?? '—')}</p>
    <p style="margin-top:12px"><span class="cover__field-label">Observations</span></p>
    <p>${esc(input.observations ?? '—')}</p>
  </div>`;
  const actionsSheet = sectionSheet({
    logoDataUri: logo,
    footerLeft: footer,
    page: 6,
    ariaLabel: 'Actions',
    inner: contentBlock(
      'Section 4',
      'Actions & observations',
      'Détail opérationnel saisi par le technicien.',
      actionsBody,
    ),
  });

  return wrapIvoprestDocument(
    `Rapport intervention · ${input.code} · Ivoprest`,
    [cover, toc, idSheet, copieursSheet, tachesSheet, actionsSheet].join('\n'),
  );
}

export async function buildInterventionHtmlPdf(
  input: InterventionReportInput,
): Promise<Buffer> {
  const html = buildInterventionHtml(input);
  const main = await htmlToPdfBuffer(html);
  if (
    input.rapportPath &&
    input.rapportMime === 'application/pdf'
  ) {
    const abs = absoluteUploadPath(input.rapportPath);
    return mergePdfAnnexes(main, [{ path: abs, label: 'Rapport joint' }]);
  }
  return main;
}
