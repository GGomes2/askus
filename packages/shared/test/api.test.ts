import { describe, expect, it } from "vitest";
import {
  APP_NAME,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_KNOWLEDGE_FILE_BYTES,
  PLAN_LIMITS,
  apiErrorSchema,
  apiRequestSchemas,
  type ApiRequest,
  type ApiRoute,
  type ApiSuccess,
} from "../src";

const id = "4c8421c7-8846-4a3e-91cd-0c4d3668a681";
const params = { id };
const key = "pk_A1b-2_3";
const chat = { key, visitorId: "visitor-1", message: "What are your hours?" };
const webhook = {
  headers: {
    "svix-id": "msg_123",
    "svix-timestamp": "1732300000",
    "svix-signature": "v1,example",
  },
  rawBody: '{"type":"subscriptionItem.active","data":{}}',
};

const validRequests = {
  "GET /api/widget/config": { query: { key } },
  "POST /api/widget/chat": { body: chat },
  "GET /api/projects": {},
  "POST /api/projects": { body: { name: "Website" } },
  "PATCH /api/projects/:id": { params, body: { name: "New name" } },
  "DELETE /api/projects/:id": { params },
  "POST /api/projects/:id/knowledge": { params, body: { title: "Hours", text: "  Open daily.\n" } },
  "POST /api/projects/:id/knowledge/upload-url": {
    params,
    body: { title: "Hours", fileName: "Hours.PDF", sizeBytes: MAX_KNOWLEDGE_FILE_BYTES },
  },
  "POST /api/projects/:id/knowledge/finalize": { params, body: { sourceId: id } },
  "DELETE /api/knowledge/:id": { params },
  "GET /api/projects/:id/conversations": { params },
  "GET /api/conversations/:id": { params },
  "PATCH /api/projects/:id/config": { params, body: { showBadge: false } },
  "POST /api/clerk/webhook": webhook,
  "GET /api/posthog-config": {},
} satisfies { [Route in ApiRoute]: ApiRequest<Route> };

describe("API request schemas", () => {
  it.each(Object.entries(validRequests) as [ApiRoute, unknown][])("accepts %s", (route, request) => {
    expect(apiRequestSchemas[route].parse(request)).toEqual(request);
  });

  it.each<[ApiRoute, unknown]>([
    ["GET /api/widget/config", { query: { key: "pk_" } }],
    ["POST /api/widget/chat", { body: { ...chat, conversationId: "unknown" } }],
    ["POST /api/widget/chat", { body: { ...chat, visitorId: "  " } }],
    ["POST /api/widget/chat", { body: { ...chat, message: " " } }],
    ["POST /api/widget/chat", { body: { ...chat, message: "x".repeat(MAX_CHAT_MESSAGE_LENGTH + 1) } }],
    ["GET /api/projects", { body: {} }],
    ["POST /api/projects", { body: { name: "Website", plan: "pro" } }],
    ["PATCH /api/projects/:id", { params, body: { name: " " } }],
    ["DELETE /api/projects/:id", { params: { id: "bad-id" } }],
    ["POST /api/projects/:id/knowledge", { params, body: { title: "Hours", text: " \n" } }],
    ["POST /api/projects/:id/knowledge/finalize", { params, body: {} }],
    ["DELETE /api/knowledge/:id", { params: {} }],
    ["GET /api/projects/:id/conversations", {}],
    ["GET /api/conversations/:id", { params, body: {} }],
    ["PATCH /api/projects/:id/config", { params, body: {} }],
    ["PATCH /api/projects/:id/config", { params, body: { buttonColor: "red;" } }],
    ["PATCH /api/projects/:id/config", { params, body: { position: "center" } }],
    ["PATCH /api/projects/:id/config", { params, body: { animation: "bounce" } }],
    ["PATCH /api/projects/:id/config", { params, body: { showBadge: "false" } }],
    ["POST /api/clerk/webhook", { rawBody: webhook.rawBody, headers: {} }],
    ["GET /api/posthog-config", { query: { key } }],
  ])("rejects invalid input for %s", (route, request) => {
    expect(apiRequestSchemas[route].safeParse(request).success).toBe(false);
  });

  it("accepts a follow-up at the message limit and preserves message text", () => {
    const message = ` ${"x".repeat(MAX_CHAT_MESSAGE_LENGTH - 2)} `;
    const body = { ...chat, conversationId: id, message };
    expect(apiRequestSchemas["POST /api/widget/chat"].parse({ body })).toEqual({ body });
  });

  const uploadUrl = apiRequestSchemas["POST /api/projects/:id/knowledge/upload-url"];
  const upload = validRequests["POST /api/projects/:id/knowledge/upload-url"];

  it.each(["how-to.pdf", "how-to.md", "how-to.txt"])("accepts %s as a knowledge file", (fileName) => {
    expect(uploadUrl.safeParse({ params, body: { ...upload.body, fileName } }).success).toBe(true);
  });

  it.each([
    { fileName: "guide.pdf.exe" },
    { fileName: "../guide.pdf" },
    { fileName: "folder\\guide.pdf" },
    { sizeBytes: MAX_KNOWLEDGE_FILE_BYTES + 1 },
    { sizeBytes: 0 },
    { sizeBytes: 1.5 },
  ])("rejects an invalid upload declaration %j", (patch) => {
    expect(uploadUrl.safeParse({ params, body: { ...upload.body, ...patch } }).success).toBe(false);
  });
});

describe("shared API values", () => {
  it("uses the public chat response and shared error shape", () => {
    const response = { conversationId: id, reply: "Open daily." } satisfies ApiSuccess<"POST /api/widget/chat">;
    expect(response.conversationId).toBe(id);
    const error = { error: { code: "PLAN_REQUIRED", message: "Upgrade to customize your widget." } };
    expect(apiErrorSchema.parse(error)).toEqual(error);
    expect(apiErrorSchema.safeParse({ error: { message: "Missing code" } }).success).toBe(false);
  });

  it("matches the plan quotas and widget features", () => {
    expect(APP_NAME).toBe("Askwell");
    expect(PLAN_LIMITS).toEqual({
      free: {
        projects: 1,
        messagesPerMonth: 100,
        knowledgeSources: 3,
        widget: {
          customButtonColor: false,
          positions: ["bottom-right"],
          customLabel: false,
          animations: ["fade"],
          customHeaderText: false,
          canHideBadge: false,
        },
      },
      pro: {
        projects: 5,
        messagesPerMonth: 2_000,
        knowledgeSources: 25,
        widget: {
          customButtonColor: true,
          positions: ["top-left", "top-right", "bottom-left", "bottom-right"],
          customLabel: true,
          animations: ["fade", "slide", "scale"],
          customHeaderText: true,
          canHideBadge: true,
        },
      },
    });
  });
});
