/**

 * Génère le PDF modèle client (HTML → Puppeteer).

 * Usage : npm run template:leasing-mensuelle

 */

import { writeLeasingMensuelleHtmlSampleFile } from '../src/common/export/leasing-mensuelle-html.builder';



writeLeasingMensuelleHtmlSampleFile()

  .then((p) => {

    console.log('Modèle généré :', p);

  })

  .catch((err) => {

    console.error(err);

    process.exit(1);

  });


