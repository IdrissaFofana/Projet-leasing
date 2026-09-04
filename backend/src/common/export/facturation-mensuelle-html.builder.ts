import {
  esc,
  htmlToPdfBuffer,
  loadIvoprestLogoDataUri,
  renderIvoprestCover,
  sheetFooter,
  sheetHeader,
  wrapIvoprestDocument,
} from './ivoprest-report-shell';
import {
  fmtMoney,
  fmtNum,
  mapToHtmlView,
  type LeasingMensuelleHtmlInput,
  type LeasingMensuelleHtmlView,
} from './leasing-mensuelle-view.mapper';

function renderFacturationTable(view: LeasingMensuelleHtmlView, logo: string, page: number) {
  const { prixNb, prixCouleur } = view.meta;
  const t = view.totauxFacturation;
  const rows =
    view.facturation.length > 0
      ? view.facturation
          .map((r) => {
            const montantCls = r.sousQuota ? 'val-positive' : 'val-negative';
            const statut = r.sousQuota
              ? '<span class="badge badge--ok">Sous quota · 0 F</span>'
              : '<span class="badge badge--danger">À facturer</span>';
            return `<tr>
          <td class="code">${esc(r.imprimante)}</td>
          <td>${esc(r.localisation)}</td>
          <td class="num">${fmtNum(r.factN)}</td>
          <td class="num">${fmtNum(r.factC)}</td>
          <td class="num">${fmtMoney(r.montantN)}</td>
          <td class="num">${fmtMoney(r.montantC)}</td>
          <td class="num ${montantCls}"><strong>${fmtMoney(r.montantTotal)}</strong></td>
          <td>${statut}</td>
        </tr>`;
          })
          .join('')
      : `<tr><td colspan="8" class="empty-state">Aucun relevé — montant total 0 F.</td></tr>`;

  const tfoot =
    view.facturation.length > 0
      ? `<tfoot>
      <tr class="data-table__total">
        <td colspan="2"><strong>Total à facturer</strong></td>
        <td class="num"><strong>${fmtNum(t.factN)}</strong></td>
        <td class="num"><strong>${fmtNum(t.factC)}</strong></td>
        <td class="num"><strong>${fmtMoney(t.montantN)}</strong></td>
        <td class="num"><strong>${fmtMoney(t.montantC)}</strong></td>
        <td class="num"><strong>${fmtMoney(t.montantTotal)}</strong></td>
        <td></td>
      </tr>
    </tfoot>`
      : '';

  return `<section class="sheet sheet--landscape" aria-label="Prix à facturer">
    ${sheetHeader(logo)}
    <div class="sheet__inner">
      <div class="content-block">
        <div class="section-tag">Facturation</div>
        <h2 class="section-title">Prix à facturer par copieur</h2>
        <p class="section-desc">
          Copies hors quota × tarifs unitaires (noir ${fmtMoney(prixNb)} · couleur ${fmtMoney(prixCouleur)}).
          Sous quota = <strong>0 F</strong>.
        </p>
        <div class="table-wrap">
          <table class="data-table data-table--facturation">
            <thead>
              <tr>
                <th>Copieur</th>
                <th>Localisation</th>
                <th class="num">Fact. N</th>
                <th class="num">Fact. C</th>
                <th class="num">Montant N</th>
                <th class="num">Montant C</th>
                <th class="num">Prix à facturer</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            ${tfoot}
          </table>
        </div>
        <div class="summary-box">
          Prix total à facturer ce mois :
          <span>${fmtMoney(t.montantTotal)}</span>
        </div>
      </div>
    </div>
    ${sheetFooter(`${view.meta.reference} · ${view.meta.footerBrand}`, page)}
  </section>`;
}

export function buildFacturationMensuelleHtml(view: LeasingMensuelleHtmlView): string {
  const logo = loadIvoprestLogoDataUri();
  const { meta } = view;
  const cover = renderIvoprestCover(
    {
      title: 'Rapport Facturation Mensuelle',
      subtitle: meta.moisLabel,
      note: 'Détail des montants à facturer par copieur (copies hors quota) et total du mois.',
      footerLeft: `${meta.reference} · ${meta.footerBrand}`,
      fields: [
        { label: 'Client', value: meta.client, highlight: true },
        {
          label: 'Période couverte',
          value: '',
          period: {
            debut: meta.periodeDebut,
            debutIso: meta.periodeDebutIso,
            fin: meta.periodeFin,
            finIso: meta.periodeFinIso,
          },
        },
      ],
      fieldRows: [
        [
          { label: 'Référence', value: meta.reference, code: true },
          { label: 'Édition', value: meta.edition.replace(/<[^>]+>/g, '') },
        ],
      ],
    },
    logo,
    1,
  );
  const table = renderFacturationTable(view, logo, 2);
  return wrapIvoprestDocument(
    `Rapport Facturation · ${meta.moisLabel} · Ivoprest`,
    [cover, table].join('\n'),
  );
}

export async function buildFacturationMensuelleHtmlPdf(
  data: LeasingMensuelleHtmlInput,
): Promise<Buffer> {
  const view = mapToHtmlView(data);
  return htmlToPdfBuffer(buildFacturationMensuelleHtml(view));
}
