import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {
      role: UserRole.ADMIN,
      locale: "en",
      notificationPrefs: {
        emailEnabled: true,
        pushEnabled: true
      }
    },
    create: {
      email: "demo@example.com",
      name: "Demo Admin",
      role: UserRole.ADMIN,
      locale: "en",
      notificationPrefs: {
        emailEnabled: true,
        pushEnabled: true
      }
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
