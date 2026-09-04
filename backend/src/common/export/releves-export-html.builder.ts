import {
  contentBlock,
  esc,
  htmlToPdfBuffer,
  loadIvoprestLogoDataUri,
  renderIvoprestCover,
  sectionSheet,
  wrapIvoprestDocument,
} from './ivoprest-report-shell';
import { fmtNum } from './leasing-mensuelle-view.mapper';

const MOIS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export type RelevesExportColumn = {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
};

export type RelevesExportHtmlInput = {
  title: string;
  subtitle: string;
  note?: string;
  sectionTag?: string;
  sectionTitle?: string;
  client?: string;
  reference: string;
  mois?: string;
  moisDebut?: string;
  moisFin?: string;
  meta?: Array<{ label: string; value: string }>;
  columns: RelevesExportColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
};

function moisLabel(mois: string) {
  const [y, m] = mois.split('-').map(Number);
  if (!y || !m) return mois;
  return `${MOIS_FR[m - 1]} ${y}`;
}

function periodeBounds(mois: string) {
  const [y, m] = mois.split('-').map(Number);
  const debut = new Date(y, m - 1, 1);
  const fin = new Date(y, m, 0);
  const fmt = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return {
    debut: fmt(debut),
    debutIso: debut.toISOString().slice(0, 10),
    fin: fmt(fin),
    finIso: fin.toISOString().slice(0, 10),
  };
}

function cellValue(v: string | number | null | undefined) {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return fmtNum(v);
  return esc(v);
}

function renderTableSheet(input: RelevesExportHtmlInput, logo: string, page: number) {
  const cols = input.columns;
  const head = cols
    .map((c) => {
      const align =
        c.align === 'right' ? ' class="num"' : c.align === 'center' ? ' class="center"' : '';
      return `<th${align}>${esc(c.header)}</th>`;
    })
    .join('');

  const body =
    input.rows.length > 0
      ? input.rows
          .map((row) => {
            const tds = cols
              .map((c) => {
                const align =
                  c.align === 'right'
                    ? ' class="num"'
                    : c.align === 'center'
                      ? ' class="center"'
                      : '';
                const isCode = c.key === 'code' || c.key === 'imprimante';
                const val = cellValue(row[c.key]);
                return `<td${align}>${isCode && typeof row[c.key] === 'string' ? `<span class="code">${esc(String(row[c.key]))}</span>` : val}</td>`;
              })
              .join('');
            return `<tr>${tds}</tr>`;
          })
          .join('')
      : `<tr><td colspan="${cols.length}" class="empty-state">Aucune donnée pour cette vue.</td></tr>`;

  const inner = contentBlock(
    input.sectionTag ?? 'Relevés',
    input.sectionTitle ?? input.title,
    input.subtitle,
    `<div class="table-wrap"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
     <div class="summary-box">${input.rows.length} ligne(s)</div>`,
  );

  return sectionSheet({
    landscape: true,
    logoDataUri: logo,
    footerLeft: `${input.reference} · Ivoprest`,
    page,
    ariaLabel: input.title,
    inner,
  });
}

export function buildRelevesExportHtml(input: RelevesExportHtmlInput): string {
  const logo = loadIvoprestLogoDataUri();
  const client = input.client?.trim() || 'Client';
  const subtitle = input.mois
    ? moisLabel(input.mois)
    : input.moisDebut && input.moisFin
      ? `${moisLabel(input.moisDebut)} → ${moisLabel(input.moisFin)}`
      : input.subtitle;

  const period = input.mois
    ? periodeBounds(input.mois)
    : input.moisDebut && input.moisFin
      ? {
          debut: moisLabel(input.moisDebut),
          debutIso: `${input.moisDebut}-01`,
          fin: moisLabel(input.moisFin),
          finIso: `${input.moisFin}-01`,
        }
      : null;

  const cover = renderIvoprestCover(
    {
      title: input.title,
      subtitle,
      note: input.note ?? input.subtitle,
      footerLeft: `${input.reference} · Ivoprest`,
      fields: [
        { label: 'Client', value: client, highlight: true },
        ...(period
          ? [
              {
                label: 'Période couverte',
                value: '',
                period: {
                  debut: period.debut,
                  debutIso: period.debutIso,
                  fin: period.fin,
                  finIso: period.finIso,
                },
              },
            ]
          : []),
        ...(input.meta ?? []).map((m) => ({ label: m.label, value: m.value })),
      ],
      fieldRows: [
        [
          { label: 'Référence', value: input.reference, code: true },
          {
            label: 'Édition',
            value: new Date().toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
          },
        ],
      ],
    },
    logo,
    1,
    { landscape: true },
  );

  const table = renderTableSheet(input, logo, 2);
  return wrapIvoprestDocument(`${input.title} · Ivoprest`, [cover, table].join('\n'));
}

export async function buildRelevesExportPdf(input: RelevesExportHtmlInput): Promise<Buffer> {
  return htmlToPdfBuffer(buildRelevesExportHtml(input));
}
