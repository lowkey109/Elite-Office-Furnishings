import { db } from "../../db";
import { buildings, tenants, leases, companyBuildingEdges, buildingSuburbEdges } from "../../../shared/schema";
import { eq, desc, sql } from "drizzle-orm";

const AU_SEED_BUILDINGS = [
  { name: "One One One Eagle Street", address: "111 Eagle Street", city: "Brisbane", suburb: "Brisbane City", state: "QLD", postcode: "4000", lat: -27.4670, lng: 153.0250, floors: 54, totalAreaSqm: 65000, buildingGrade: "A", propertyType: "commercial_office", yearBuilt: 2012, nabers: 5.0, currentVacancyPct: 8.2, averageRentPerSqm: 95000 },
  { name: "Waterfront Place", address: "1 Eagle Street", city: "Brisbane", suburb: "Brisbane City", state: "QLD", postcode: "4000", lat: -27.4665, lng: 153.0240, floors: 45, totalAreaSqm: 54000, buildingGrade: "A", propertyType: "commercial_office", yearBuilt: 1990, nabers: 4.5, currentVacancyPct: 5.1, averageRentPerSqm: 88000 },
  { name: "Central Plaza One", address: "345 Queen Street", city: "Brisbane", suburb: "Brisbane City", state: "QLD", postcode: "4000", lat: -27.4685, lng: 153.0232, floors: 40, totalAreaSqm: 48000, buildingGrade: "A", propertyType: "commercial_office", yearBuilt: 1988, nabers: 4.0, currentVacancyPct: 11.3, averageRentPerSqm: 82000 },
  { name: "Aurora Melbourne Central", address: "576 Swan Street", city: "Melbourne", suburb: "Richmond", state: "VIC", postcode: "3121", lat: -37.8230, lng: 144.9900, floors: 38, totalAreaSqm: 42000, buildingGrade: "A", propertyType: "commercial_office", yearBuilt: 2020, nabers: 5.5, currentVacancyPct: 12.0, averageRentPerSqm: 110000 },
  { name: "Collins Arch", address: "447 Collins Street", city: "Melbourne", suburb: "Melbourne CBD", state: "VIC", postcode: "3000", lat: -37.8172, lng: 144.9619, floors: 55, totalAreaSqm: 72000, buildingGrade: "Premium", propertyType: "commercial_office", yearBuilt: 2021, nabers: 5.5, currentVacancyPct: 14.5, averageRentPerSqm: 125000 },
  { name: "Governor Macquarie Tower", address: "1 Farrer Place", city: "Sydney", suburb: "Sydney CBD", state: "NSW", postcode: "2000", lat: -33.8663, lng: 151.2090, floors: 64, totalAreaSqm: 84000, buildingGrade: "Premium", propertyType: "commercial_office", yearBuilt: 1993, nabers: 5.0, currentVacancyPct: 7.5, averageRentPerSqm: 145000 },
  { name: "Quay Quarter Tower", address: "50 Bridge Street", city: "Sydney", suburb: "Sydney CBD", state: "NSW", postcode: "2000", lat: -33.8617, lng: 151.2096, floors: 49, totalAreaSqm: 68000, buildingGrade: "Premium", propertyType: "commercial_office", yearBuilt: 2022, nabers: 6.0, currentVacancyPct: 5.0, averageRentPerSqm: 155000 },
  { name: "150 Collins Street", address: "150 Collins Street", city: "Melbourne", suburb: "Melbourne CBD", state: "VIC", postcode: "3000", lat: -37.8143, lng: 144.9627, floors: 36, totalAreaSqm: 40000, buildingGrade: "A", propertyType: "commercial_office", yearBuilt: 2023, nabers: 5.5, currentVacancyPct: 18.0, averageRentPerSqm: 115000 },
  { name: "240 St Georges Terrace", address: "240 St Georges Terrace", city: "Perth", suburb: "Perth CBD", state: "WA", postcode: "6000", lat: -31.9550, lng: 115.8565, floors: 28, totalAreaSqm: 32000, buildingGrade: "A", propertyType: "commercial_office", yearBuilt: 1982, nabers: 4.0, currentVacancyPct: 13.2, averageRentPerSqm: 72000 },
  { name: "25 Grenfell Street", address: "25 Grenfell Street", city: "Adelaide", suburb: "Adelaide CBD", state: "SA", postcode: "5000", lat: -34.9218, lng: 138.6010, floors: 24, totalAreaSqm: 28000, buildingGrade: "B", propertyType: "commercial_office", yearBuilt: 1975, nabers: 3.5, currentVacancyPct: 16.0, averageRentPerSqm: 58000 },
];

export class BuildingIngestionService {
  async seedAustralianBuildings(): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;

    for (const b of AU_SEED_BUILDINGS) {
      const existing = await db.select().from(buildings)
        .where(eq(buildings.address, b.address))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(buildings).values({
        ...b,
        sourceType: "seed",
        dataQuality: "estimated",
      });
      inserted++;
    }

    await this.refreshSuburbEdges();
    return { inserted, skipped };
  }

  async ingestFromCsv(rows: any[]): Promise<{ inserted: number; errors: string[] }> {
    let inserted = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        if (!row.name || !row.city) {
          errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
          continue;
        }
        await db.insert(buildings).values({
          name: row.name,
          address: row.address,
          city: row.city,
          suburb: row.suburb,
          state: row.state,
          postcode: row.postcode,
          lat: row.lat ? parseFloat(row.lat) : undefined,
          lng: row.lng ? parseFloat(row.lng) : undefined,
          totalAreaSqm: row.total_area ? parseInt(row.total_area) : undefined,
          floors: row.floors ? parseInt(row.floors) : undefined,
          buildingGrade: row.grade,
          sourceType: "csv_upload",
          dataQuality: "user_provided",
        });
        inserted++;
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    await this.refreshSuburbEdges();
    return { inserted, errors };
  }

  async addTenant(input: {
    buildingId: string;
    companyName: string;
    companyId?: string;
    floor?: string;
    spaceSizeSqm?: number;
    industry?: string;
    estimatedHeadcount?: number;
  }): Promise<typeof tenants.$inferSelect> {
    const [tenant] = await db.insert(tenants).values({
      buildingId: input.buildingId,
      companyName: input.companyName,
      companyId: input.companyId,
      floor: input.floor,
      spaceSizeSqm: input.spaceSizeSqm,
      industry: input.industry,
      estimatedHeadcount: input.estimatedHeadcount,
      tenantStatus: "active",
      sourceType: "manual",
    }).returning();

    if (input.companyId) {
      const existing = await db.select().from(companyBuildingEdges)
        .where(eq(companyBuildingEdges.companyId, input.companyId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(companyBuildingEdges).values({
          companyId: input.companyId,
          edgeType: "tenant",
          confidence: 90,
          sourceType: "manual",
        });
      }
    }

    return tenant;
  }

  async addLease(input: {
    tenantId: string;
    buildingId: string;
    companyName?: string;
    startDate?: Date;
    expiryDate?: Date;
    leaseTermYears?: number;
    rentPerSqm?: number;
    spaceSizeSqm?: number;
    notes?: string;
  }): Promise<typeof leases.$inferSelect> {
    const totalAnnualRent = input.rentPerSqm && input.spaceSizeSqm
      ? input.rentPerSqm * input.spaceSizeSqm
      : undefined;

    const [lease] = await db.insert(leases).values({
      tenantId: input.tenantId,
      buildingId: input.buildingId,
      companyName: input.companyName,
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      leaseTermYears: input.leaseTermYears,
      rentPerSqm: input.rentPerSqm,
      spaceSizeSqm: input.spaceSizeSqm,
      totalAnnualRent,
      status: "active",
      sourceType: "manual",
      notes: input.notes,
    }).returning();

    return lease;
  }

  async refreshSuburbEdges(): Promise<void> {
    const allBuildings = await db.select().from(buildings);
    for (const b of allBuildings) {
      if (!b.suburb || !b.city) continue;
      const existing = await db.select().from(buildingSuburbEdges)
        .where(eq(buildingSuburbEdges.buildingId, b.id))
        .limit(1);

      const demandScore = Math.min(100, Math.round(50 + ((1 - (b.currentVacancyPct || 10) / 100) * 50)));
      const vacancyRisk = Math.round(((b.currentVacancyPct || 10) / 100) * 100) / 100;

      if (existing.length === 0) {
        await db.insert(buildingSuburbEdges).values({
          buildingId: b.id,
          suburb: b.suburb,
          city: b.city,
          demandScore,
          vacancyRisk,
        });
      } else {
        await db.update(buildingSuburbEdges)
          .set({ demandScore, vacancyRisk, updatedAt: new Date() })
          .where(eq(buildingSuburbEdges.buildingId, b.id));
      }
    }
  }

  async getBuildingStats() {
    const allBuildings = await db.select().from(buildings);
    const allTenants = await db.select().from(tenants);
    const allLeases = await db.select().from(leases);

    const now = new Date();
    const in12Months = new Date(now.getFullYear(), now.getMonth() + 12, now.getDate());
    const expiringLeases = allLeases.filter(l => l.expiryDate && new Date(l.expiryDate) <= in12Months && l.status === "active");

    return {
      totalBuildings: allBuildings.length,
      totalTenants: allTenants.length,
      activeLeases: allLeases.filter(l => l.status === "active").length,
      expiringIn12Months: expiringLeases.length,
      cities: [...new Set(allBuildings.map(b => b.city))].length,
    };
  }
}

export const buildingIngestionService = new BuildingIngestionService();
