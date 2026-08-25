-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "autreAdresse" TEXT,
ADD COLUMN     "autreTelephone" TEXT,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "dateNaissance" DATE,
ADD COLUMN     "languePref" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "nomFamille" TEXT,
ADD COLUMN     "notifEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prenom" TEXT,
ADD COLUMN     "telephone" TEXT;
