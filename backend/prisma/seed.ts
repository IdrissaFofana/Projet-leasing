import { EntiteSequence, PrismaClient, RoleUtilisateur, TypeTarif } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DEFAULT_PERMISSIONS_BY_ROLE, MODULES } from '../src/common/auth/permissions';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  const systemRoles: Array<{
    code: RoleUtilisateur;
    libelle: string;
    permissions: string[];
  }> = [
    { code: RoleUtilisateur.ADMIN, libelle: 'Administrateur', permissions: [...MODULES] },
    {
      code: RoleUtilisateur.TECHNICIEN,
      libelle: 'Technicien',
      permissions: [...DEFAULT_PERMISSIONS_BY_ROLE.TECHNICIEN],
    },
    {
      code: RoleUtilisateur.FACTURATION,
      libelle: 'Facturation',
      permissions: [...DEFAULT_PERMISSIONS_BY_ROLE.FACTURATION],
    },
    {
      code: RoleUtilisateur.LECTURE,
      libelle: 'Lecture',
      permissions: [...DEFAULT_PERMISSIONS_BY_ROLE.LECTURE],
    },
  ];

  const roleIds: Partial<Record<RoleUtilisateur, string>> = {};
  for (const r of systemRoles) {
    const row = await prisma.roleMetier.upsert({
      where: { code: r.code },
      update: { libelle: r.libelle, permissions: r.permissions, systeme: true, actif: true },
      create: {
        code: r.code,
        libelle: r.libelle,
        description: `Rôle système ${r.code}`,
        permissions: r.permissions,
        systeme: true,
        actif: true,
      },
    });
    roleIds[r.code] = row.id;
  }

  await prisma.utilisateur.upsert({
    where: { email: 'admin@leasing.local' },
    update: {
      mustChangePassword: false,
      permissions: [...MODULES],
      actif: true,
      roleMetierId: roleIds.ADMIN,
    },
    create: {
      email: 'admin@leasing.local',
      nom: 'Administrateur',
      role: RoleUtilisateur.ADMIN,
      roleMetierId: roleIds.ADMIN,
      motDePasseHash: passwordHash,
      permissions: [...MODULES],
      mustChangePassword: false,
    },
  });

  await prisma.utilisateur.upsert({
    where: { email: 'tech@leasing.local' },
    update: {
      mustChangePassword: false,
      permissions: [...DEFAULT_PERMISSIONS_BY_ROLE.TECHNICIEN],
      actif: true,
      roleMetierId: roleIds.TECHNICIEN,
    },
    create: {
      email: 'tech@leasing.local',
      nom: 'Technicien ESAY',
      role: RoleUtilisateur.TECHNICIEN,
      roleMetierId: roleIds.TECHNICIEN,
      motDePasseHash: await bcrypt.hash('Tech123!', 10),
      permissions: [...DEFAULT_PERMISSIONS_BY_ROLE.TECHNICIEN],
      mustChangePassword: false,
    },
  });

  const marques = ['HP', 'Canon', 'Epson', 'Brother', 'Ricoh', 'Kyocera', 'Xerox', 'Samsung'];
  for (const nom of marques) {
    await prisma.marque.upsert({ where: { nom }, update: {}, create: { nom } });
  }

  const fournisseurs = ['Fournisseur A', 'Fournisseur B', 'ESAY Support', 'Stock interne', 'Mr Fofana', 'France'];
  for (const nom of fournisseurs) {
    await prisma.fournisseur.upsert({ where: { nom }, update: {}, create: { nom } });
  }

  const agents = ['Agent 1', 'Agent 2', 'Technicien ESAY', 'Responsable parc'];
  for (const nom of agents) {
    await prisma.agent.upsert({ where: { nom }, update: {}, create: { nom } });
  }

  const services = [
    'Direction',
    'Comptabilite',
    'RH',
    'Accueil',
    'Commercial',
    'Production',
    'Informatique',
    'Logistique',
    'Archives',
    'Agence',
  ];
  for (const nom of services) {
    await prisma.service.upsert({ where: { nom }, update: {}, create: { nom } });
  }

  const tarifs: Array<{ type: TypeTarif; libelle: string; prixUnitaire: number }> = [
    { type: TypeTarif.COPIE_NB, libelle: 'Copie N&B', prixUnitaire: 75 },
    { type: TypeTarif.COPIE_COULEUR, libelle: 'Copie couleur', prixUnitaire: 10 },
    { type: TypeTarif.SCAN_NOIR, libelle: 'Scan noir', prixUnitaire: 0 },
    { type: TypeTarif.SCAN_COULEUR, libelle: 'Scan couleur', prixUnitaire: 0 },
    { type: TypeTarif.ENVOI, libelle: 'Envoi', prixUnitaire: 0 },
  ];
  for (const t of tarifs) {
    await prisma.tarifLeasing.upsert({
      where: { type: t.type },
      update: { libelle: t.libelle, prixUnitaire: t.prixUnitaire },
      create: t,
    });
  }

  const sequences: Array<{ entite: EntiteSequence; prefixe: string; formatNum: string }> = [
    { entite: EntiteSequence.IMPRIMANTE, prefixe: 'IMP-', formatNum: '0000' },
    { entite: EntiteSequence.ENTREE_STOCK, prefixe: 'ENT-', formatNum: '0000' },
    { entite: EntiteSequence.AFFECTATION, prefixe: 'AFF-', formatNum: '0000' },
    { entite: EntiteSequence.RELEVE, prefixe: 'REL-', formatNum: '0000' },
    { entite: EntiteSequence.MAINTENANCE, prefixe: 'MNT-', formatNum: '0000' },
    { entite: EntiteSequence.FACTURE, prefixe: 'FAC-', formatNum: '0000' },
  ];
  for (const s of sequences) {
    await prisma.idSequenceConfig.upsert({
      where: { entite: s.entite },
      update: { prefixe: s.prefixe, formatNum: s.formatNum },
      create: s,
    });
  }

  const canon = await prisma.marque.findUniqueOrThrow({ where: { nom: 'Canon' } });
  const esay = await prisma.fournisseur.findUniqueOrThrow({ where: { nom: 'ESAY Support' } });

  const printers: Array<{
    code: string;
    numeroSerie: string;
    localisation: string;
    dateInstallation: string;
  }> = [
    { code: 'IMP-0001', numeroSerie: '4MB44679', localisation: 'Batiment Equateur etage 5', dateInstallation: '2026-06-15' },
    { code: 'IMP-0002', numeroSerie: '4MB44447', localisation: 'Batiment Equateur etage 11', dateInstallation: '2026-07-14' },
    { code: 'IMP-0003', numeroSerie: '4MB44675', localisation: 'Batiment Equateur etage 10', dateInstallation: '2026-07-14' },
    { code: 'IMP-0004', numeroSerie: '4MB44678', localisation: 'Batiment Equateur etage 8', dateInstallation: '2026-07-14' },
    { code: 'IMP-0005', numeroSerie: '4MB44677', localisation: 'Batiment Equateur etage 4', dateInstallation: '2026-07-14' },
    { code: 'IMP-0006', numeroSerie: '4MB44683', localisation: 'Batiment Equateur etage 3-2', dateInstallation: '2026-07-30' },
    { code: 'IMP-0007', numeroSerie: '4MB41982', localisation: 'Batiment Equateur etage 3-1', dateInstallation: '2026-07-30' },
    { code: 'IMP-0008', numeroSerie: '4MB42222', localisation: 'Batiment Equateur etage 11-2', dateInstallation: '2026-07-30' },
    { code: 'IMP-0009', numeroSerie: '4MB44669', localisation: 'Batiment Equateur etage 0', dateInstallation: '2026-07-30' },
    { code: 'IMP-0010', numeroSerie: '4MB42221', localisation: 'Batiment Equateur etage RDC', dateInstallation: '2026-07-30' },
  ];

  for (const p of printers) {
    await prisma.imprimante.upsert({
      where: { numeroSerie: p.numeroSerie },
      update: {
        code: p.code,
        modele: 'IR-ADV C930',
        localisation: p.localisation,
        marqueId: canon.id,
        fournisseurId: esay.id,
        statut: 'FONCTIONNELLE',
        dateInstallation: new Date(p.dateInstallation),
      },
      create: {
        code: p.code,
        modele: 'IR-ADV C930',
        numeroSerie: p.numeroSerie,
        localisation: p.localisation,
        marqueId: canon.id,
        fournisseurId: esay.id,
        statut: 'FONCTIONNELLE',
        dateInstallation: new Date(p.dateInstallation),
      },
    });
  }

  const maxImp = await prisma.imprimante.aggregate({
    _max: { code: true },
  });
  const maxImpNum = maxImp._max.code
    ? Number(String(maxImp._max.code).replace(/\D/g, '')) || 10
    : 10;
  await prisma.idSequenceConfig.update({
    where: { entite: EntiteSequence.IMPRIMANTE },
    data: { dernierNumero: Math.max(10, maxImpNum) },
  });

  const modeleNom = 'C-EXV 64';
  let modeleCartouche = await prisma.modeleCartouche.findFirst({
    where: { modele: modeleNom, marqueId: canon.id },
  });
  if (!modeleCartouche) {
    modeleCartouche = await prisma.modeleCartouche.create({
      data: { modele: modeleNom, marqueId: canon.id, refFabricant: 'C-EXV64' },
    });
  }
  const couleurs = ['TONER_BLACK', 'TONER_CYAN', 'TONER_MAGENTA', 'TONER_YELLOW'] as const;
  for (const couleur of couleurs) {
    await prisma.cartoucheSku.upsert({
      where: {
        modeleId_couleur: { modeleId: modeleCartouche.id, couleur },
      },
      update: {},
      create: { modeleId: modeleCartouche.id, couleur },
    });
  }

  console.log('Seed OK');
  console.log('Admin: admin@leasing.local / Admin123!');
  console.log('Tech : tech@leasing.local / Tech123!');
  console.log(`Imprimantes: ${printers.length}`);
  console.log(`Modele cartouche: ${modeleNom}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
