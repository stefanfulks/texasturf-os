import { describe, expect, it, vi, beforeEach } from "vitest";
import { notifyInboundActivity } from "../notify";

vi.mock("@/lib/integrations/slack", () => ({
  postMessage: vi.fn(async () => ({ ok: true, ts: "1" })),
}));
import { postMessage as slackPostMessage } from "@/lib/integrations/slack";

function mockSb() {
  const insert = vi.fn(async () => ({ error: null }));
  return { client: { from: vi.fn(() => ({ insert })) }, insert };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SLACK_SALES_CHANNEL_ID;
});

describe("notifyInboundActivity", () => {
  it("matched SMS with channel set: inserts notifications row + posts Slack", async () => {
    process.env.SLACK_SALES_CHANNEL_ID = "C12345";
    const { client, insert } = mockSb();
    await notifyInboundActivity(client as never, {
      kind: "sms",
      ownerId: "u1",
      dealId: "d1",
      dealName: "Mercer",
      contactName: "Doug Mercer",
      summary: "Got it, looking now.",
    });
    expect(insert).toHaveBeenCalledTimes(1);
    const row = (insert.mock.calls[0] as never[])[0] as Record<string, unknown>;
    expect(row.user_id).toBe("u1");
    expect(row.type).toBe("sales_inbound_sms");
    expect(row.resource_type).toBe("deal");
    expect(row.resource_id).toBe("d1");
    expect(String(row.title)).toContain("Doug Mercer");
    expect(slackPostMessage).toHaveBeenCalledWith(
      "C12345",
      expect.stringContaining("Doug Mercer"),
    );
  });

  it("matched voicemail with no channel: only inserts notification, no Slack", async () => {
    const { client, insert } = mockSb();
    await notifyInboundActivity(client as never, {
      kind: "voicemail",
      ownerId: "u1",
      dealId: "d1",
      dealName: "Mercer",
      contactName: "Doug Mercer",
      summary: "Hey it's Doug, call me back.",
    });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(slackPostMessage).not.toHaveBeenCalled();
  });

  it("matched without ownerId: skips notifications row, still posts Slack when configured", async () => {
    process.env.SLACK_SALES_CHANNEL_ID = "C12345";
    const { client, insert } = mockSb();
    await notifyInboundActivity(client as never, {
      kind: "sms",
      ownerId: null,
      dealId: "d1",
      dealName: "Mercer",
      contactName: "Doug Mercer",
      summary: "msg",
    });
    expect(insert).not.toHaveBeenCalled();
    expect(slackPostMessage).toHaveBeenCalled();
  });

  it("unmatched voicemail with channel: posts triage Slack only (no notification row)", async () => {
    process.env.SLACK_SALES_CHANNEL_ID = "C12345";
    const { client, insert } = mockSb();
    await notifyInboundActivity(client as never, {
      kind: "voicemail",
      ownerId: null,
      dealId: null,
      dealName: null,
      contactName: null,
      fromNumber: "+15125550111",
      summary: "Heard you do turf.",
    });
    expect(insert).not.toHaveBeenCalled();
    expect(slackPostMessage).toHaveBeenCalledWith(
      "C12345",
      expect.stringMatching(/Unmatched voicemail.*\+15125550111/),
    );
  });

  it("no channel + no ownerId: no-ops cleanly", async () => {
    const { client, insert } = mockSb();
    await notifyInboundActivity(client as never, {
      kind: "voicemail",
      ownerId: null,
      dealId: null,
      dealName: null,
      contactName: null,
      fromNumber: "+15125550111",
      summary: "msg",
    });
    expect(insert).not.toHaveBeenCalled();
    expect(slackPostMessage).not.toHaveBeenCalled();
  });
});
