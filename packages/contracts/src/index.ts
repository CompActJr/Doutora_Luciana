/** Contratos públicos da API. Nunca incluir modelos internos ou segredos. */
export type HealthResponse = { status: "ok" };
export type ReadinessResponse = { status: "ready" | "unavailable" };

export type UserRole = "admin" | "editor";
export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  disabled: boolean;
  createdAt: string;
};
export type CurrentUserResponse = { user: UserSummary };
export type UsersResponse = { users: UserSummary[] };

export type ResponseReviewStatus = "draft" | "needs_review" | "reviewed";
export type ResponseTemplateInput = {
  title: string;
  category: string;
  questionExamples: string[];
  answer: string;
  variations: string[];
  reviewStatus: ResponseReviewStatus;
};
export type ResponseTemplate = ResponseTemplateInput & {
  id: string;
  isActive: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type ResponseTemplateSummary = Pick<ResponseTemplate,
  "id" | "title" | "category" | "reviewStatus" | "isActive" | "revision" | "updatedAt">;
export type ResponseTemplateResponse = { response: ResponseTemplate };
export type ResponseTemplatesResponse = {
  items: ResponseTemplateSummary[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
};
export type UpdateResponseTemplateInput = Partial<ResponseTemplateInput> & { revision: number; isActive?: boolean };

export type KnowledgeEntryInput = {
  title: string;
  category: string;
  content: string;
  reviewStatus: ResponseReviewStatus;
};
export type KnowledgeEntry = KnowledgeEntryInput & {
  id: string;
  isActive: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type KnowledgeEntrySummary = Omit<KnowledgeEntry, "content" | "createdAt">;
export type KnowledgeEntryResponse = { entry: KnowledgeEntry };
export type KnowledgeEntriesResponse = {
  items: KnowledgeEntrySummary[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
};
export type AssistantSettingsInput = {
  displayName: string;
  introduction: string;
  tone: string;
  boundaries: string;
  handoffTriggers: string[];
  handoffMessage: string;
  schedulingInstructions: string;
};
export type AssistantSettings = AssistantSettingsInput & {
  id: "clinic";
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type AssistantSettingsResponse = { settings: AssistantSettings | null };

export type ContentSnapshot = { schemaVersion: 1; responses: ResponseTemplate[]; knowledge: KnowledgeEntry[]; assistant: AssistantSettings | null };
export type ContentVersionSummary = { id: string; number: number; fingerprint: string; note: string; actorId: string; restoredFrom: string | null; createdAt: string };
export type ContentVersion = ContentVersionSummary & { snapshot: ContentSnapshot };
export type ContentDraftResponse = { snapshot: ContentSnapshot; fingerprint: string; issues: string[]; activeVersionId: string | null };
export type ContentVersionsResponse = { items: ContentVersionSummary[]; total: number; page: number; pageSize: number; activeVersionId: string | null };
export type AiStatusResponse = { available: boolean; model: string | null; whatsappEnabled: false };
export type SimulationMessage = { role: "user" | "assistant"; content: string; requestId?: string; sources?: { id: string; title: string; kind: "response" | "knowledge" }[] };
export type Simulation = { id: string; mode: "demo" | "openai"; versionId: string | null; fingerprint: string; messages: SimulationMessage[]; revision: number; createdAt: string; updatedAt: string };
export type SimulationResponse = { simulation: Simulation };
export type SimulationsResponse = { items: Simulation[] };
export type VariationsResponse = { suggestions: string[]; revision: number };

export type CalendarChoice = { id: string; name: string; timeZone: string; primary: boolean };
export type CalendarStatus = { configured: boolean; connected: boolean; needsReconnect: boolean; email: string | null; calendar: CalendarChoice | null; revision: number; generation: string | null; redirectUri: string };
export type Appointment = { id: string; etag: string; title: string; notes: string; start: string; end: string; allDay: boolean; recurring: boolean; editable: boolean; transparent: boolean };
export type CalendarEventsResponse = { items: Appointment[]; timeZone: string; calendarId: string; connectionRevision: number; fetchedAt: string };
export type AppointmentInput = { title: string; notes: string; startLocal: string; endLocal: string };
