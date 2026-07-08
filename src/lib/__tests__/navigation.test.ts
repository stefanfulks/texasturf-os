import { describe, expect, it } from "vitest";
import { activeWorkspace } from "@/lib/navigation";

describe("activeWorkspace — SectionHome depends on this resolving for deep sub-pages", () => {
  it("resolves a deep Marketing sub-page (not just /marketing itself)", () => {
    expect(activeWorkspace("/marketing/campaigns/abc-123", false)?.label).toBe("Marketing");
  });
  it("resolves a deep Sales sub-page", () => {
    expect(activeWorkspace("/sales/inbox", false)?.label).toBe("Sales");
  });
  it("resolves Warehouse across its many prefixes", () => {
    expect(activeWorkspace("/operations/vendor-orders/new", false)?.label).toBe("Warehouse");
    expect(activeWorkspace("/inventory/rolls/xyz", false)?.label).toBe("Warehouse");
    expect(activeWorkspace("/fleet/reservations", false)?.label).toBe("Warehouse");
  });
  it("Financial wins over Admin on the overlapping /admin/finance prefix", () => {
    expect(activeWorkspace("/admin/finance/labor", true)?.label).toBe("Financial");
  });
  it("Admin resolves for its own pages", () => {
    expect(activeWorkspace("/admin/feedback", true)?.label).toBe("Admin");
  });
  it("admin-only workspaces are invisible to non-admins", () => {
    expect(activeWorkspace("/admin/finance", false)).toBeNull();
  });
  it("pages outside every workspace (e.g. /settings) resolve to null", () => {
    expect(activeWorkspace("/settings/account", false)).toBeNull();
  });
});
