import { PrismaClient, UserRole } from "@prisma/client";
import { geoSeedEntries } from "./geo-seed.js";

const prisma = new PrismaClient();

function normalizeGeoName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ");
}

async function seedCanonicalGeography() {
  const slugToId = new Map<string, string>();

  for (const entry of geoSeedEntries.filter((item) => !item.parentSlug)) {
    const area = await prisma.area.upsert({
      where: { slug: entry.slug },
      update: {
        type: entry.type.toUpperCase() as never,
        nameEn: entry.nameEn,
        nameAr: entry.nameAr,
        normalizedName: normalizeGeoName(entry.nameEn),
        parentId: null,
        isActive: true
      },
      create: {
        slug: entry.slug,
        type: entry.type.toUpperCase() as never,
        nameEn: entry.nameEn,
        nameAr: entry.nameAr,
        normalizedName: normalizeGeoName(entry.nameEn),
        isActive: true
      }
    });

    slugToId.set(entry.slug, area.id);
  }

  for (const entry of geoSeedEntries.filter((item) => item.parentSlug)) {
    const parentId = slugToId.get(entry.parentSlug!);

    if (!parentId) {
      throw new Error(`Missing parent area for ${entry.slug}: ${entry.parentSlug}`);
    }

    const area = await prisma.area.upsert({
      where: { slug: entry.slug },
      update: {
        type: entry.type.toUpperCase() as never,
        nameEn: entry.nameEn,
        nameAr: entry.nameAr,
        normalizedName: normalizeGeoName(entry.nameEn),
        parentId,
        isActive: true
      },
      create: {
        slug: entry.slug,
        type: entry.type.toUpperCase() as never,
        nameEn: entry.nameEn,
        nameAr: entry.nameAr,
        normalizedName: normalizeGeoName(entry.nameEn),
        parentId,
        isActive: true
      }
    });

    slugToId.set(entry.slug, area.id);
  }

  for (const entry of geoSeedEntries) {
    const areaId = slugToId.get(entry.slug);

    if (!areaId) {
      continue;
    }

    await prisma.areaAlias.deleteMany({
      where: { areaId }
    });

    await prisma.areaExternalMapping.deleteMany({
      where: { areaId }
    });

    if (entry.aliases.length > 0) {
      await prisma.areaAlias.createMany({
        data: entry.aliases.map((alias) => ({
          areaId,
          alias: alias.alias,
          normalizedAlias: normalizeGeoName(alias.alias),
          locale: alias.locale
        }))
      });
    }

    if (entry.sourceMappings?.length) {
      await prisma.areaExternalMapping.createMany({
        data: entry.sourceMappings.map((mapping) => ({
          areaId,
          source: mapping.source.toUpperCase() as never,
          sourceExternalId: mapping.sourceExternalId,
          sourceSlug: mapping.sourceSlug,
          sourceType: mapping.sourceType
        }))
      });
    }

    if (entry.centroid) {
      await prisma.$executeRaw`
        UPDATE "Area"
        SET "centroid" = ST_SetSRID(ST_MakePoint(${entry.centroid.lng}, ${entry.centroid.lat}), 4326)
        WHERE "id" = ${areaId}
      `;
    }
  }
}

async function main() {
  await seedCanonicalGeography();

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
