/** App-level view contracts; these intentionally do not mirror an SDK response. */
export type AuthProvider = "google" | "github";

export type GenerationMode = "text" | "image";

export type GenerationDraft = {
  mode: GenerationMode;
  prompt: string;
};

export type SavedGeneration = {
  id: string;
  mode: GenerationMode;
  prompt: string;
  textOutput?: string;
  imageUrl?: string;
  imageKey?: string;
  model: string;
  createdAt: string;
};

export type IntegrationStatus = "pending" | "ready" | "error";
