import { describe, expect, it } from "vitest";
import { groupVisitsByCity, type DailyMapVisit } from "../client/src/components/field-ops/indiaMapData";

function makeVisit(overrides: Partial<DailyMapVisit> = {}): DailyMapVisit {
  return {
    id: 1,
    employeeName: "Asha Rao",
    customerName: "Northstar Supplies",
    location: "Bengaluru, Karnataka",
    purpose: "New Lead",
    outcome: "Positive",
    createdAt: "2026-10-15T04:30:00.000Z",
    ...overrides,
  };
}

describe("groupVisitsByCity", () => {
  it("combines aliases into a city and retains all visits and per-purpose counts", () => {
    const result = groupVisitsByCity([
      makeVisit({ id: 1, employeeName: "Asha Rao", location: "Bangalore, Karnataka", purpose: "New Lead", createdAt: "2026-10-15T03:00:00.000Z" }),
      makeVisit({ id: 2, employeeName: "Bimal Das", location: "Bengaluru, Karnataka", purpose: "Service", createdAt: "2026-10-15T04:00:00.000Z" }),
    ]);
    const city = result.cities[0];
    expect(result.cities).toHaveLength(1);
    expect(city.name).toBe("Bengaluru");
    expect(city.count).toBe(2);
    expect(city.purposeCounts["New Lead"]).toBe(1);
    expect(city.purposeCounts.Service).toBe(1);
    expect(city.visits.map(visit => visit.employeeName)).toEqual(["Bimal Das", "Asha Rao"]);
    expect(result.unmappedLocations).toEqual([]);
  });

  it("lists each unmapped location and creates no map rows for empty data", () => {
    const result = groupVisitsByCity([
      makeVisit({ location: "Remote District, Odisha" }),
      makeVisit({ id: 2, location: "Remote District, Odisha" }),
    ]);
    expect(result.cities).toHaveLength(1);
    expect(result.cities[0].coordinates).toBeNull();
    expect(result.unmappedLocations).toEqual(["Remote District, Odisha"]);
    expect(groupVisitsByCity([])).toEqual({ cities: [], unmappedLocations: [] });
  });
});
