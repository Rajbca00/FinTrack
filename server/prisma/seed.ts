import { PrismaClient } from "@prisma/client";
import { seedDefaults } from "../src/services/defaultSeed";

const prisma = new PrismaClient();

async function main() {
  const { categoryCount, ruleCount } = await seedDefaults(prisma);
  console.log("Seed complete:", categoryCount, "categories,", ruleCount, "rules");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
