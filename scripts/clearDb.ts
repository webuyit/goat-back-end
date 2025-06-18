// scripts/clearDb.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clearDatabase() {
  await prisma.$transaction([
    prisma.playerStat.deleteMany(),
    prisma.match.deleteMany(),
    prisma.tournament.deleteMany(),
    prisma.team.deleteMany(),
    prisma.player.deleteMany(),
    prisma.league.deleteMany(),
    prisma.market.deleteMany(),
    // add other models here
  ]);

  console.log('All data deleted but schema/tables are intact.');
}

clearDatabase().finally(() => prisma.$disconnect());
