-- CreateEnum
CREATE TYPE "PorteeCampagne" AS ENUM ('ALL', 'SELECTION');

-- AlterTable
ALTER TABLE "CampagneSaisie" ADD COLUMN "portee" "PorteeCampagne" NOT NULL DEFAULT 'ALL';
