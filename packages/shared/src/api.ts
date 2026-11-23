import { z } from "zod";
import { WIDGET_ANIMATIONS, WIDGET_POSITIONS } from "./plans";

export const MAX_CHAT_MESSAGE_LENGTH = 1_000;
export const MAX_KNOWLEDGE_FILE_BYTES = 10 * 1024 * 1024;

const idSchema = z.uuid();
const publicKeySchema = z.string().regex(/^pk_[A-Za-z0-9_-]+$/);
const nonBlankText = z.string().trim().min(1);
const noInput = z.strictObject({});
const idParams = z.strictObject({ id: idSchema });
const projectNameBody = z.strictObject({ name: nonBlankText });

const widgetConfigFields = {
  buttonColor: z.string().regex(/^#[\da-f]{6}$/i),
  position: z.enum(WIDGET_POSITIONS),
  label: nonBlankText,
  animation: z.enum(WIDGET_ANIMATIONS),
  headerText: nonBlankText,
  showBadge: z.boolean(),
};

export const widgetConfigSchema = z.strictObject(widgetConfigFields);

const widgetConfigPatch = widgetConfigSchema.partial().refine(
  (config) => Object.values(config).some((value) => value !== undefined),
  { message: "Provide at least one widget setting." },
);

export const apiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum([
      "INVALID_INPUT",
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "PLAN_REQUIRED",
      "LIMIT_REACHED",
      "RATE_LIMITED",
      "MESSAGE_BLOCKED",
      "INVALID_SIGNATURE",
      "INTERNAL_ERROR",
    ]),
    message: z.string().min(1),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiErrorCode = ApiError["error"]["code"];

export const apiRequestSchemas = {
  "GET /api/widget/config": z.strictObject({
    query: z.strictObject({ key: publicKeySchema }),
  }),
  "POST /api/widget/chat": z.strictObject({
    body: z.strictObject({
      key: publicKeySchema,
      visitorId: nonBlankText,
      conversationId: idSchema.optional(),
      message: z.string().min(1).max(MAX_CHAT_MESSAGE_LENGTH).refine((message) => message.trim().length > 0),
    }),
  }),
  "GET /api/projects": noInput,
  "POST /api/projects": z.strictObject({ body: projectNameBody }),
  "PATCH /api/projects/:id": z.strictObject({ params: idParams, body: projectNameBody }),
  "DELETE /api/projects/:id": z.strictObject({ params: idParams }),
  "POST /api/projects/:id/knowledge": z.strictObject({
    params: idParams,
    body: z.strictObject({
      title: nonBlankText,
      text: z.string().refine((text) => text.trim().length > 0),
    }),
  }),
  "POST /api/projects/:id/knowledge/upload-url": z.strictObject({
    params: idParams,
    body: z.strictObject({
      title: nonBlankText,
      fileName: z.string().regex(/^[^/\\\p{Cc}]+\.(pdf|md|txt)$/iu),
      sizeBytes: z.number().int().min(1).max(MAX_KNOWLEDGE_FILE_BYTES),
    }),
  }),
  "POST /api/projects/:id/knowledge/finalize": z.strictObject({
    params: idParams,
    body: z.strictObject({ sourceId: idSchema }),
  }),
  "DELETE /api/knowledge/:id": z.strictObject({ params: idParams }),
  "GET /api/projects/:id/conversations": z.strictObject({ params: idParams }),
  "GET /api/conversations/:id": z.strictObject({ params: idParams }),
  "PATCH /api/projects/:id/config": z.strictObject({ params: idParams, body: widgetConfigPatch }),
  // Pass the original HTTP request to Clerk's verifyWebhook before reading event data.
  "POST /api/clerk/webhook": z.strictObject({
    headers: z.strictObject({
      "svix-id": z.string().min(1),
      "svix-timestamp": z.string().regex(/^\d+$/),
      "svix-signature": z.string().min(1),
    }),
    rawBody: z.string().min(1),
  }),
  "GET /api/posthog-config": noInput,
} as const;

export type ApiRoute = keyof typeof apiRequestSchemas;
export type ApiRequest<Route extends ApiRoute> = z.input<(typeof apiRequestSchemas)[Route]>;
export type ParsedApiRequest<Route extends ApiRoute> = z.output<(typeof apiRequestSchemas)[Route]>;

export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

export type Project = {
  id: string;
  name: string;
  publicKey: string;
  messagesUsed: number;
  messageLimit: number;
  periodStart: string;
  createdAt: string;
};

export type KnowledgeSource = {
  id: string;
  projectId: string;
  title: string;
  type: "text" | "pdf" | "md" | "txt";
  status: "uploading" | "processing" | "ready" | "failed";
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  createdAt: string;
  firstMessagePreview: string | null;
  messageCount: number;
};

export type ConversationMessage = {
  id: string;
  role: "visitor" | "bot";
  body: string;
  createdAt: string;
};

type SuccessResponses = {
  "GET /api/widget/config": WidgetConfig;
  "POST /api/widget/chat": { conversationId: string; reply: string };
  "GET /api/projects": { projects: Project[] };
  "POST /api/projects": { project: Project };
  "PATCH /api/projects/:id": { project: Project };
  "DELETE /api/projects/:id": undefined;
  "POST /api/projects/:id/knowledge": { source: KnowledgeSource };
  "POST /api/projects/:id/knowledge/upload-url": { sourceId: string; signedUrl: string };
  "POST /api/projects/:id/knowledge/finalize": { source: KnowledgeSource };
  "DELETE /api/knowledge/:id": undefined;
  "GET /api/projects/:id/conversations": { conversations: ConversationSummary[] };
  "GET /api/conversations/:id": { conversationId: string; messages: ConversationMessage[] };
  "PATCH /api/projects/:id/config": WidgetConfig;
  "POST /api/clerk/webhook": { received: true };
  "GET /api/posthog-config": { key: string; host: string };
};

export type ApiSuccess<Route extends ApiRoute> = SuccessResponses[Route];
export type ApiResponse<Route extends ApiRoute> = ApiSuccess<Route> | ApiError;
