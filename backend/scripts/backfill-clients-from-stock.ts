import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.stockProduit.findMany({
    where: { destinataire: { not: null } },
    select: { id: true, destinataire: true, clientId: true },
  });

  const byName = new Map<string, string[]>();
  for (const r of rows) {
    const nom = (r.destinataire || '').trim();
    if (!nom) continue;
    const list = byName.get(nom) ?? [];
    list.push(r.id);
    byName.set(nom, list);
  }

  console.log(`Destinataires distincts: ${byName.size}`);
  for (const [nom, ids] of byName) {
    console.log(`  - ${nom} (${ids.length} ligne(s))`);
  }

  let created = 0;
  let linked = 0;

  for (const [nom, ids] of byName) {
    let client = await prisma.client.findUnique({ where: { nom } });
    if (!client) {
      client = await prisma.client.create({ data: { nom } });
      created += 1;
      console.log(`+ Client créé: ${nom}`);
    }

    const res = await prisma.stockProduit.updateMany({
      where: {
        id: { in: ids },
        OR: [{ clientId: null }, { clientId: { not: client.id } }],
      },
      data: { clientId: client.id, destinataire: client.nom },
    });
    linked += res.count;
  }

  const totalClients = await prisma.client.count();
  console.log(`\n✓ Créés: ${created} · liés: ${linked} · clients total: ${totalClients}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
