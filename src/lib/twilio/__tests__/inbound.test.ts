import { describe, expect, it, vi } from "vitest";
import { lookupInboundCaller } from "../inbound";

type Row = Record<string, unknown>;
function mockClient(rows: { sales_contacts?: Row[]; deals?: Row[]; profiles?: Row[] }) {
  const tables: Record<string, Row[]> = {
    sales_contacts: rows.sales_contacts ?? [],
    deals: rows.deals ?? [],
    profiles: rows.profiles ?? [],
  };
  // Minimal chainable matching the calls inbound.ts makes.
  const builder = (table: string) => {
    let data: Row[] = [...tables[table]];
    const api: Record<string, unknown> = {};
    api.select = vi.fn(() => api);
    api.eq = vi.fn((col: string, val: unknown) => { data = data.filter((r) => r[col] === val); return api; });
    api.in = vi.fn((col: string, vals: unknown[]) => { data = data.filter((r) => vals.includes(r[col] as never)); return api; });
    api.order = vi.fn(() => api);
    api.limit = vi.fn(() => api);
    api.maybeSingle = vi.fn(async () => ({ data: data[0] ?? null }));
    return api;
  };
  return { from: vi.fn((t: string) => builder(t)) };
}

describe("lookupInboundCaller", () => {
  it("returns matched: false when no contact has that phone", async () => {
    const sb = mockClient({ sales_contacts: [] });
    const result = await lookupInboundCaller(sb as never, "+15125550000");
    expect(result).toEqual({ matched: false });
  });

  it("returns matched + contact + null deal when contact has no open deal", async () => {
    const sb = mockClient({
      sales_contacts: [{ id: "c1", name: "Doug", phone: "+15125550000" }],
      deals: [],
    });
    const result = await lookupInboundCaller(sb as never, "+15125550000");
    expect(result).toEqual({
      matched: true,
      contact: { id: "c1", name: "Doug" },
      deal: null,
      ownerMobile: null,
    });
  });

  it("returns full match (contact + open deal + owner mobile) when everything resolves", async () => {
    const sb = mockClient({
      sales_contacts: [{ id: "c1", name: "Doug", phone: "+15125550000" }],
      deals: [{ id: "d1", name: "Mercer", stage: "negotiation", sales_contact_id: "c1", owner_id: "u1" }],
      profiles: [{ id: "u1", mobile: "+15129030668" }],
    });
    const result = await lookupInboundCaller(sb as never, "+15125550000");
    expect(result).toEqual({
      matched: true,
      contact: { id: "c1", name: "Doug" },
      deal: { id: "d1", name: "Mercer", ownerId: "u1" },
      ownerMobile: "+15129030668",
    });
  });

  it("returns deal but null ownerMobile when owner profile has no mobile set", async () => {
    const sb = mockClient({
      sales_contacts: [{ id: "c1", name: "Doug", phone: "+15125550000" }],
      deals: [{ id: "d1", name: "Mercer", stage: "negotiation", sales_contact_id: "c1", owner_id: "u1" }],
      profiles: [{ id: "u1", mobile: null }],
    });
    const result = await lookupInboundCaller(sb as never, "+15125550000");
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.deal?.id).toBe("d1");
      expect(result.ownerMobile).toBeNull();
    }
  });
});
