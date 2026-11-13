"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { ArrowRight, Check, ChevronDown, ChevronRight, Download, Eye, ImagePlus, LoaderCircle, Plus, Sparkles, Trash2, Upload, WandSparkles, X } from "lucide-react";
import type { generateAvatar } from "@/trigger/generate-avatar";
import { insforgeAuthCookieNames } from "@/lib/insforge/auth-cookies";
import { formatAvatarErrorDiagnostic, type AvatarErrorDiagnostic } from "@/lib/avatars/errors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const people = [
  { name: "Alexa", role: "Friendly presenter", image: "/avatars/Alexa.png", style: "Casual" },
  { name: "John", role: "Podcast host", image: "/avatars/john.png", style: "Podcast" },
  { name: "Mia", role: "Creative storyteller", image: "/avatars/mia.png", style: "3D Cartoon" },
  { name: "Sara", role: "Studio presenter", image: "/avatars/sara.png", style: "Stylized" },
];
const styles = ["Podcast", "Casual", "3D Cartoon", "Stylized"] as const;
const filters = ["All avatars", ...styles];
const terminalFailureStatuses = ["FAILED", "CRASHED", "CANCELED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT"];

type Avatar = {
  id: string; name: string; source: "upload" | "ai" | "default"; style: string | null;
  status: "ready" | "queued" | "generating" | "completed" | "failed";
  prompt: string | null; source_image_key: string | null; trigger_run_id: string | null; generation_attempt: number;
  source_image_url: string | null; image_16_9_url: string | null; image_9_16_url: string | null;
  error_message?: string | null; error_service: AvatarErrorDiagnostic["service"] | null;
  error_phase: string | null; error_status: number | null; error_code: string | null; created_at: string;
};
type Generation = { avatarId: string; runId: string; generationAttempt: number; publicAccessToken: string | null };
type GenerateResponse = Partial<Generation> & {
  avatarId?: string;
  error?: string;
  realtimeUnavailable?: boolean;
  runLinkPending?: boolean;
  retryable?: boolean;
  submissionStatus?: "unknown" | "rejected";
  diagnostic?: AvatarErrorDiagnostic;
};

let avatarRefreshPromise: Promise<string | null> | null = null;

function readAccessTokenCookie() {
  const prefix = `${insforgeAuthCookieNames.accessToken}=`;
  for (const cookie of document.cookie.split(";")) {
    const entry = cookie.trim();
    if (!entry.startsWith(prefix)) continue;
    const value = entry.slice(prefix.length);
    try { return decodeURIComponent(value); }
    catch { return value; }
  }
  return null;
}

function avatarFailureText(avatar: Avatar) {
  if (!avatar.error_message) return null;
  if (!avatar.error_service && !avatar.error_phase && !avatar.error_status && !avatar.error_code) return avatar.error_message;
  return formatAvatarErrorDiagnostic({
    service: avatar.error_service ?? "application",
    phase: avatar.error_phase ?? "avatar_generation",
    status: avatar.error_status,
    code: avatar.error_code,
    message: avatar.error_message,
  });
}

async function refreshAvatarSession(rejectedToken?: string) {
  const currentToken = readAccessTokenCookie();
  if (rejectedToken && currentToken && currentToken !== rejectedToken) return currentToken;
  if (avatarRefreshPromise) return avatarRefreshPromise;

  avatarRefreshPromise = (async () => {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const result = await response.json() as { accessToken?: string };
    return readAccessTokenCookie() ?? result.accessToken ?? null;
  })().catch(() => null).finally(() => { avatarRefreshPromise = null; });

  return avatarRefreshPromise;
}

async function authorizationHeader() {
  const token = readAccessTokenCookie() ?? await refreshAvatarSession();
  if (!token) throw new Error("Sign in to manage avatars.");
  return token;
}

async function authorizedAvatarFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await authorizationHeader();
  const send = (accessToken: string) => {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${accessToken}`);
    return fetch(input, { ...init, headers });
  };

  const response = await send(token);
  if (response.status !== 401) return response;

  const refreshedToken = await refreshAvatarSession(token);
  return refreshedToken ? send(refreshedToken) : response;
}

async function submitAvatarGeneration(form: FormData): Promise<GenerateResponse> {
  const response = await authorizedAvatarFetch("/api/avatars/generate", { method: "POST", body: form });
  const result = await response.json() as GenerateResponse;
  if (!response.ok || !result.runId || !result.avatarId) {
    const message = result.diagnostic ? formatAvatarErrorDiagnostic(result.diagnostic) : result.error ?? "The generation task could not be started.";
    throw Object.assign(new Error(message), {
      avatarId: result.avatarId,
      generationAttempt: result.generationAttempt,
      retryable: result.retryable,
      submissionStatus: result.submissionStatus,
      diagnostic: result.diagnostic,
    });
  }
  result.runLinkPending = response.headers.get("x-avatar-run-link") === "pending-reconciliation";
  return result;
}

export function AvatarStudio() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("All avatars");
  const [style, setStyle] = useState<(typeof styles)[number]>("Podcast");
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [avatarErrors, setAvatarErrors] = useState<Record<string, string>>({});
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [avatarsError, setAvatarsError] = useState("");
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const [retryableAttempt, setRetryableAttempt] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewFormat, setPreviewFormat] = useState<"landscape" | "portrait">("landscape");
  const [downloadBusy, setDownloadBusy] = useState<"landscape" | "portrait" | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Avatar | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletingAvatarId, setDeletingAvatarId] = useState<string | null>(null);
  const deleteInFlight = useRef(false);
  const [previewAvatar, setPreviewAvatar] = useState<Avatar | null>(null);
  const [draggingFile, setDraggingFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const generationAttemptId = useRef<string | null>(null);
  const fallbackPollCount = useRef(0);
  const autoRecoveryAttempts = useRef(new Set<string>());

  const runId = generation?.runId ?? "";
  const publicAccessToken = generation?.publicAccessToken ?? "";
  const { run, error: realtimeError } = useRealtimeRun<typeof generateAvatar>(runId, {
    accessToken: publicAccessToken ?? "",
    enabled: Boolean(runId && publicAccessToken),
  });

  const fetchAvatars = useCallback(async () => {
    const response = await authorizedAvatarFetch("/api/avatars", { cache: "no-store" });
    if (!response.ok) throw new Error("Your avatars couldn’t be loaded.");
    const data = await response.json() as { avatars: Avatar[] };
    return data.avatars;
  }, []);

  const pendingAvatarIds = useMemo(() => avatars
    .filter((avatar) => avatar.source === "ai" && ["queued", "generating"].includes(avatar.status))
    .map((avatar) => avatar.id)
    .join(","), [avatars]);

  const refreshAvatars = useCallback(async () => {
    setLoading(true); setAvatarsError("");
    try { setAvatars(await fetchAvatars()); }
    catch (reason) { setAvatarsError(reason instanceof Error ? reason.message : "Your avatars couldn’t be loaded."); }
    finally { setLoading(false); }
  }, [fetchAvatars]);

  const resumeAvatar = async (avatar: Avatar, retry = false) => {
    setBusy(true);
    setAvatarErrors((items) => { const next = { ...items }; delete next[avatar.id]; return next; });
    const form = new FormData();
    form.set("avatarId", avatar.id);
    if (retry) form.set("retry", "true");
    try {
      const result = await submitAvatarGeneration(form);
      setGeneration({
        avatarId: result.avatarId!,
        runId: result.runId!,
        generationAttempt: result.generationAttempt ?? avatar.generation_attempt,
        publicAccessToken: result.publicAccessToken ?? null,
      });
      setOpen(true);
      setFallbackFailed(false);
      fallbackPollCount.current = 0;
      setRetryableAttempt(false);
      setAvatars((items) => items.map((item) => item.id === avatar.id
        ? { ...item, trigger_run_id: result.runId!, generation_attempt: result.generationAttempt ?? item.generation_attempt, status: "queued", error_message: null, error_service: null, error_phase: null, error_status: null, error_code: null }
        : item));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "This avatar generation could not be resumed.";
      setAvatarErrors((items) => ({ ...items, [avatar.id]: message }));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    void fetchAvatars().then((items) => { if (active) setAvatars(items); })
      .catch((reason) => { if (active) setAvatarsError(reason instanceof Error ? reason.message : "Your avatars couldn’t be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchAvatars]);

  useEffect(() => {
    let active = true;
    const recoverUnlinked = async () => {
      const queued = avatars.filter((avatar) => avatar.source === "ai" && avatar.status === "queued" && !avatar.trigger_run_id);
      for (const avatar of queued) {
        const recoveryKey = `${avatar.id}:${avatar.generation_attempt}`;
        if (autoRecoveryAttempts.current.has(recoveryKey)) continue;
        autoRecoveryAttempts.current.add(recoveryKey);
        const form = new FormData();
        form.set("avatarId", avatar.id);
        try {
          const result = await submitAvatarGeneration(form);
          if (!active) return;
          setAvatarErrors((items) => { const next = { ...items }; delete next[avatar.id]; return next; });
          setAvatars((items) => items.map((item) => item.id === avatar.id
            ? { ...item, trigger_run_id: result.runId!, generation_attempt: result.generationAttempt ?? item.generation_attempt, error_message: null, error_service: null, error_phase: null, error_status: null, error_code: null }
            : item));
        } catch (reason) {
          if (!active) return;
          const message = reason instanceof Error ? reason.message : "The saved generation could not be resumed.";
          setAvatarErrors((items) => ({ ...items, [avatar.id]: message }));
        }
      }
    };
    void recoverUnlinked();
    return () => { active = false; };
  }, [avatars]);

  useEffect(() => {
    if (!pendingAvatarIds) return;
    let active = true;
    let timer: number | undefined;
    const pollPending = async () => {
      for (const avatarId of pendingAvatarIds.split(",")) {
        if (!active) return;
        try {
          const response = await authorizedAvatarFetch(`/api/avatars/${avatarId}`, { cache: "no-store" });
          if (!response.ok) continue;
          const result = await response.json() as { avatar: Avatar };
          if (active) setAvatars((items) => [result.avatar, ...items.filter((item) => item.id !== result.avatar.id)]);
        } catch {
          // The next bounded page refresh retries transient status lookup failures.
        }
      }
      if (active) timer = window.setTimeout(() => void pollPending(), 3000);
    };
    timer = window.setTimeout(() => void pollPending(), 1500);
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [pendingAvatarIds]);

  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  const generatedAvatar = useMemo(() => avatars.find((avatar) => avatar.id === generation?.avatarId), [avatars, generation?.avatarId]);
  const runStatus = String(run?.status ?? "").toUpperCase();
  const runOutput = run?.output as { image16Url?: string; image916Url?: string } | undefined;
  const preview16Url = generatedAvatar?.image_16_9_url ?? runOutput?.image16Url ?? null;
  const preview916Url = generatedAvatar?.image_9_16_url ?? runOutput?.image916Url ?? null;
  const completed = Boolean(preview16Url && preview916Url) && (runStatus === "COMPLETED" || generatedAvatar?.status === "completed");
  const completedWithoutPreviews = runStatus === "COMPLETED" && !(preview16Url && preview916Url);
  const failed = terminalFailureStatuses.includes(runStatus) || fallbackFailed || completedWithoutPreviews || generatedAvatar?.status === "failed";
  const isRunning = Boolean(generation && !completed && !failed);
  const metadata = run?.metadata as Record<string, unknown> | undefined;
  const progress = typeof metadata?.progress === "number" ? metadata.progress : runStatus === "QUEUED" || runStatus === "PENDING" ? 5 : 12;
  const stage = typeof metadata?.stage === "string" ? metadata.stage : "queued";
  const runErrorDiagnostic = typeof metadata?.error === "string" && typeof metadata?.errorService === "string" && typeof metadata?.errorPhase === "string"
    ? {
        service: metadata.errorService as AvatarErrorDiagnostic["service"],
        phase: metadata.errorPhase,
        status: typeof metadata.errorStatus === "number" ? metadata.errorStatus : null,
        code: typeof metadata.errorCode === "string" ? metadata.errorCode : null,
        message: metadata.error,
      }
    : null;
  const runError = runErrorDiagnostic ? formatAvatarErrorDiagnostic(runErrorDiagnostic) : typeof metadata?.error === "string" ? metadata.error : realtimeError?.message ?? (generatedAvatar ? avatarFailureText(generatedAvatar) : null);
  const stageLabel: Record<string, string> = {
    queued: "Your avatar is in the queue…", preparing: "Preparing your reference photo…",
    generating_16_9: "Creating your landscape avatar…", generating_9_16: "Creating your portrait avatar…",
    saving: "Saving both versions to your library…", completed: "Your avatars are ready.",
  };

  useEffect(() => {
    if (!generation || !["COMPLETED", ...terminalFailureStatuses].includes(runStatus)) return;
    let active = true;
    void fetchAvatars().then((items) => { if (active) setAvatars(items); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Your completed avatar could not be loaded."); });
    return () => { active = false; };
  }, [generation, fetchAvatars, runStatus]);

  useEffect(() => {
    if (!generation || (!realtimeError && run)) return;
    let active = true;
    let timer: number | undefined;
    const pollStatus = async () => {
      if (!active || fallbackPollCount.current >= 20) { if (active) setFallbackFailed(true); return; }
      fallbackPollCount.current += 1;
      try {
        const response = await authorizedAvatarFetch(`/api/avatars/${generation.avatarId}`, { cache: "no-store" });
        if (response.ok) {
          const result = await response.json() as { avatar: Avatar };
          const current = result.avatar;
          if (active) setAvatars((items) => [current, ...items.filter((item) => item.id !== current.id)]);
          if (["ready", "completed"].includes(current.status)) return;
          if (current.status === "failed") { if (active) setFallbackFailed(true); return; }
        }
      } catch { /* Keep the bounded fallback retrying transient network failures. */ }
      timer = window.setTimeout(() => void pollStatus(), 3000);
    };
    void pollStatus();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [generation, realtimeError, run]);

  const chooseFile = (selected?: File) => {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) { setError("Choose an image file to continue."); return; }
    if (selected.size > 10 * 1024 * 1024) { setError("Choose an image under 10 MB."); return; }
    setFile(selected); setFileUrl(URL.createObjectURL(selected)); setError("");
  };

  const downloadAvatar = async (format: "landscape" | "portrait") => {
    if (!generation?.avatarId) return;
    setDownloadBusy(format); setDownloadError("");
    try {
      const response = await authorizedAvatarFetch(`/api/avatars/${generation.avatarId}/download/${format}`, { cache: "no-store" });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error ?? "We couldn’t prepare this download. Please try again.");
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("The downloaded image was empty. Please try again.");
      const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ai-avatar-${format}.${extension}`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) {
      setDownloadError(reason instanceof Error ? reason.message : "We couldn’t prepare this download. Please try again.");
    } finally {
      setDownloadBusy(null);
    }
  };

  const openDialog = () => {
    setOpen(true); setGeneration(null); generationAttemptId.current = null; fallbackPollCount.current = 0; setFallbackFailed(false); setRetryableAttempt(false); setFile(null); setFileUrl(null); setPrompt(""); setStyle("Podcast"); setError(""); setNotice("");
  };
  const closeDialog = () => { setOpen(false); setGeneration(null); setError(""); };

  const uploadAsIs = async () => {
    if (!file) { fileRef.current?.click(); return; }
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.set("image", file);
      const response = await authorizedAvatarFetch("/api/avatars/upload", { method: "POST", body: form });
      const result = await response.json() as { avatar?: Avatar; error?: string };
      if (!response.ok || !result.avatar) throw new Error(result.error ?? "The avatar could not be uploaded.");
      setAvatars((items) => [result.avatar!, ...items]); setNotice(`${result.avatar.name} was added to your avatars.`);
      setFile(null); setFileUrl(null); closeDialog();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The avatar could not be uploaded."); }
    finally { setBusy(false); }
  };

  const generate = async (newAttempt = false) => {
    const isRetry = retryableAttempt && !newAttempt;
    if (newAttempt || !generationAttemptId.current) generationAttemptId.current = crypto.randomUUID();
    if (!file && !(newAttempt && generation)) { setError("Choose a reference image before generating."); return; }
    setRetryableAttempt(true);
    setBusy(true); setError("");
    try {
      const requestedAvatarId = generationAttemptId.current;
      const form = new FormData();
      form.set("avatarId", requestedAvatarId);
      if (file) {
        form.set("image", file);
        form.set("style", style);
        form.set("prompt", prompt);
      } else if (newAttempt && generation) {
        form.set("sourceAvatarId", generation.avatarId);
      }
      if (isRetry) form.set("retry", "true");
      const result = await submitAvatarGeneration(form);
      if (result.realtimeUnavailable) setError("Generation started. Realtime access is unavailable, so status will be checked from your avatar library.");
      else if (result.runLinkPending) setError("Generation started, but its run link could not be saved. This screen is tracking the run; refresh the avatar list after completion.");
      setFallbackFailed(false); fallbackPollCount.current = 0;
      setGeneration({ avatarId: result.avatarId!, runId: result.runId!, generationAttempt: result.generationAttempt ?? 1, publicAccessToken: result.publicAccessToken ?? null });
      generationAttemptId.current = null; setRetryableAttempt(false);
      const existingAvatar = avatars.find((item) => item.id === result.avatarId);
      setAvatars((items) => [{
        id: result.avatarId!,
        name: file?.name.replace(/\.[^.]+$/, "") || existingAvatar?.name || generatedAvatar?.name || "My avatar",
        source: "ai",
        style: file ? style : existingAvatar?.style ?? generatedAvatar?.style ?? style,
        prompt: file ? prompt : existingAvatar?.prompt ?? generatedAvatar?.prompt ?? prompt,
        source_image_key: existingAvatar?.source_image_key ?? generatedAvatar?.source_image_key ?? null,
        trigger_run_id: result.runId!,
        generation_attempt: result.generationAttempt ?? 1,
        status: "queued",
        source_image_url: fileUrl ?? existingAvatar?.source_image_url ?? generatedAvatar?.source_image_url ?? null,
        image_16_9_url: null,
        image_9_16_url: null,
        error_message: null,
        error_service: null,
        error_phase: null,
        error_status: null,
        error_code: null,
        created_at: existingAvatar?.created_at ?? new Date().toISOString(),
      }, ...items.filter((item) => item.id !== result.avatarId)]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The generation task could not be started."); }
    finally { setBusy(false); }
  };

  const visiblePeople = people.filter((person) => filter === "All avatars" || person.style === filter);
  const cardImage = (avatar: Avatar) => avatar.source === "ai" ? avatar.image_16_9_url ?? avatar.image_9_16_url : avatar.source_image_url;
  const previewImage = previewAvatar
    ? previewFormat === "landscape" ? previewAvatar.image_16_9_url : previewAvatar.image_9_16_url
    : null;

  const confirmDeleteAvatar = async () => {
    const target = deleteTarget;
    if (!target || deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeletingAvatarId(target.id);
    setDeleteError("");
    try {
      const response = await authorizedAvatarFetch(`/api/avatars/${encodeURIComponent(target.id)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string; storageCleanup?: "complete" | "incomplete" };
      if (!response.ok) throw new Error(result.error ?? "This failed avatar could not be deleted.");
      setAvatars((items) => items.filter((item) => item.id !== target.id));
      setAvatarErrors((items) => { const next = { ...items }; delete next[target.id]; return next; });
      setDeleteTarget(null);
      setNotice(result.storageCleanup === "incomplete"
        ? "Failed avatar deleted. Some generated files could not be removed."
        : "Failed avatar deleted.");
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "This failed avatar could not be deleted. Please try again.");
    } finally {
      deleteInFlight.current = false;
      setDeletingAvatarId(null);
    }
  };

  return <div className="avatar-studio">
    <header className="avatar-page-heading">
      <div><div className="avatar-eyebrow"><Sparkles size={14} /> YOUR ON-CAMERA PRESENCE</div><h1>AI Avatars</h1><p>Meet the faces behind your next great story.</p></div>
      <button className="avatar-primary-button" onClick={openDialog}><Plus size={17} /> Create New Avatar</button>
    </header>

    {notice && <div className="avatar-notice" role="status"><Check size={14} /> {notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
    <section className="avatar-custom-section">
      <div className="avatar-section-head"><div><span className="avatar-section-kicker">MADE FOR YOU</span><h2>Your custom avatars <span>{avatars.length}</span></h2><p>Personalized faces, ready for every idea.</p></div><button className="avatar-text-button" onClick={openDialog}>Create one <ArrowRight size={14} /></button></div>
      <div className="avatar-custom-grid">
        {!loading && !avatarsError && avatars.length === 0 && <button className="avatar-create-card" onClick={openDialog}><span className="avatar-create-icon"><Plus size={20} /></span><strong>Create your first avatar</strong><small>Upload a photo and make it yours</small><span className="avatar-create-link">Start creating <ArrowRight size={13} /></span></button>}
        {loading && <div className="avatar-loading-card"><LoaderCircle size={19} /> Loading your avatars…</div>}
        {!loading && avatarsError && <div className="avatar-empty-card avatar-load-error"><strong>We couldn’t load your avatars</strong><small>{avatarsError}</small><button className="avatar-use-button" onClick={() => void refreshAvatars()}>Try again <ArrowRight size={13} /></button></div>}
        {!loading && !avatarsError && !avatars.length && <div className="avatar-empty-card"><span><ImagePlus size={18} /></span><strong>Your creations will live here</strong><small>Upload a photo as-is or create a new AI avatar.</small></div>}
        {avatars.map((avatar) => {
          const image = cardImage(avatar);
          const pending = avatar.source === "ai" && ["queued", "generating"].includes(avatar.status);
          const failedAvatar = avatar.source === "ai" && avatar.status === "failed";
          const resume = () => void resumeAvatar(avatar, failedAvatar);
          return <article className="avatar-card avatar-custom-card" key={avatar.id}>
            <div className={`avatar-card-image${!image ? " avatar-card-image-placeholder" : ""}`}>
              {image ? <Image src={image} alt={avatar.name} fill sizes="(max-width: 600px) 46vw, 240px" unoptimized /> : <div className={`avatar-generated-placeholder${failedAvatar ? " avatar-generated-error" : ""}`} role="status">
                {failedAvatar ? <><X size={18} /><span>Generation failed</span></> : <><LoaderCircle size={18} /><span>{avatar.status === "queued" ? "Waiting to generate" : "Generating your avatar"}</span></>}
              </div>}
              {image && avatar.source === "ai" && avatar.status === "completed" && <button
                type="button"
                className="avatar-image-preview-trigger"
                aria-label={`Open full-size preview of ${avatar.name}`}
                aria-haspopup="dialog"
                onClick={() => {
                  setPreviewFormat(avatar.image_16_9_url ? "landscape" : "portrait");
                  setPreviewAvatar(avatar);
                }}
              ><span className="avatar-image-preview-hint"><Eye size={13} /> Preview</span></button>}
              <span className="avatar-custom-badge"><Sparkles size={11} /> {avatar.source === "ai" ? "AI AVATAR" : "YOUR UPLOAD"}</span>
              {avatar.status !== "ready" && avatar.status !== "completed" && <span className={`avatar-state-badge state-${avatar.status}`}>{avatar.status}</span>}
              <button className="avatar-card-action" aria-label={failedAvatar ? `Retry ${avatar.name}` : pending ? `Resume ${avatar.name}` : `Use ${avatar.name}`} onClick={pending || failedAvatar ? resume : () => setSelectedAvatar(avatar.id)}><ArrowRight size={16} /></button>
            </div>
            <div className="avatar-card-info">
              <div><strong>{avatar.name}</strong><small>{avatar.style ?? "Custom avatar"}</small>
                {(avatarErrors[avatar.id] || avatarFailureText(avatar)) && <small className="avatar-inline-error">{avatarErrors[avatar.id] ?? avatarFailureText(avatar)}</small>}
              </div>
              {failedAvatar
                ? <div className="avatar-failed-actions">
                    <button className="avatar-use-button" onClick={resume} disabled={busy || deletingAvatarId !== null}>Retry generation <WandSparkles size={13} /></button>
                    <button className="avatar-delete-button" onClick={() => { setDeleteTarget(avatar); setDeleteError(""); }} disabled={deletingAvatarId !== null} aria-label={`Delete failed avatar ${avatar.name}`}><Trash2 size={13} /><span>Delete</span></button>
                  </div>
                : pending
                  ? <button className="avatar-use-button" onClick={resume} disabled={busy}>Resume <ArrowRight size={13} /></button>
                  : <button className="avatar-use-button" onClick={() => setSelectedAvatar(avatar.id)}>{selectedAvatar === avatar.id ? "Selected" : "Use avatar"} {selectedAvatar === avatar.id ? <Check size={13} /> : <ArrowRight size={13} />}</button>}
            </div>
          </article>;
        })}
      </div>
    </section>

    <section className="avatar-default-section">
      <div className="avatar-section-head avatar-default-head"><div><span className="avatar-section-kicker">A LITTLE INSPIRATION</span><h2>Find your on-screen look</h2><p>Choose a starting point for your next creation.</p></div><button className="avatar-sort-button">Most popular <ChevronDown size={14} /></button></div>
      <div className="avatar-filter-row" role="tablist" aria-label="Filter avatars">{filters.map((item) => <button key={item} role="tab" aria-selected={filter === item} className={filter === item ? "avatar-filter-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}<span className="avatar-result-count">{visiblePeople.length} thoughtfully made</span></div>
      {selectedAvatar && <p className="avatar-selection-note" role="status"><Check size={13} /> Avatar selected for your next creation.</p>}
      <div className="avatar-default-grid">{visiblePeople.map((person, index) => <article className="avatar-card" key={`${person.name}-${index}`}><button className="avatar-card-image" aria-label={`Choose ${person.name}`} onClick={() => setSelectedAvatar(person.name)}><Image src={person.image} alt={`${person.name}, ${person.role}`} fill sizes="(max-width: 540px) 46vw, (max-width: 900px) 30vw, 220px" unoptimized priority /><span className="avatar-style-label"><Sparkles size={10} /> {person.style}</span><span className="avatar-card-arrow">{selectedAvatar === person.name ? <Check size={16} /> : <ArrowRight size={16} />}</span></button><div className="avatar-card-info"><div><strong>{person.name}</strong><small>{person.role}</small></div><button className="avatar-use-button" onClick={() => setSelectedAvatar(person.name)}>{selectedAvatar === person.name ? "Selected" : "Use avatar"} {selectedAvatar === person.name ? <Check size={13} /> : <ArrowRight size={13} />}</button></div></article>)}</div>
      <button className="avatar-load-more">Explore more avatars <ChevronRight size={15} /></button>
    </section>

    {open && <div className="avatar-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}><section className="avatar-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-modal-title">
      <header className="avatar-modal-header"><div className="avatar-modal-icon"><WandSparkles size={18} /></div><div><span className="avatar-modal-brand">AI STUDIO</span><h2 id="avatar-modal-title">Create your avatar</h2><p>A little photo. A whole new on-screen presence.</p></div><button className="avatar-modal-close" onClick={closeDialog} aria-label="Close dialog"><X size={19} /></button></header>
      <div className="avatar-modal-body">
        {completed ? <div className="avatar-preview-stage"><div className="avatar-success"><span><Check size={14} /></span><div><strong>Your avatar is ready</strong><small>Both original formats are saved to your private library.</small></div></div><div className="avatar-preview-switcher" role="tablist" aria-label="Generated avatar format"><button role="tab" aria-selected={previewFormat === "landscape"} className={previewFormat === "landscape" ? "active" : ""} onClick={() => { setPreviewFormat("landscape"); setDownloadError(""); }}>Landscape <span>16:9</span></button><button role="tab" aria-selected={previewFormat === "portrait"} className={previewFormat === "portrait" ? "active" : ""} onClick={() => { setPreviewFormat("portrait"); setDownloadError(""); }}>Portrait <span>9:16</span></button></div><div className={`avatar-preview-frame ${previewFormat}`}><Image src={previewFormat === "landscape" ? preview16Url! : preview916Url!} alt={`Generated avatar in ${previewFormat} ${previewFormat === "landscape" ? "16:9" : "9:16"} format`} fill sizes="(max-width: 720px) 90vw, 650px" unoptimized /></div><div className="avatar-download-row"><div><strong>Download original</strong><small>{previewFormat === "landscape" ? "1024 × 576" : "576 × 1024"} · full resolution</small></div><button className="avatar-download-button" onClick={() => void downloadAvatar(previewFormat)} disabled={downloadBusy !== null}>{downloadBusy === previewFormat ? <LoaderCircle size={15} className="avatar-download-spinner" /> : <Download size={15} />}{downloadBusy === previewFormat ? "Preparing…" : `Download ${previewFormat === "landscape" ? "Landscape" : "Portrait"}`}</button></div>{downloadError && <p className="avatar-download-error" role="alert">{downloadError}</p>}<div className="avatar-format-summary"><span><strong>Landscape</strong><small>16:9 · 1024 × 576</small><button onClick={() => void downloadAvatar("landscape")} disabled={downloadBusy !== null} aria-label="Download landscape avatar">{downloadBusy === "landscape" ? <LoaderCircle size={14} className="avatar-download-spinner" /> : <Download size={14} />} Download</button></span><span><strong>Portrait</strong><small>9:16 · 576 × 1024</small><button onClick={() => void downloadAvatar("portrait")} disabled={downloadBusy !== null} aria-label="Download portrait avatar">{downloadBusy === "portrait" ? <LoaderCircle size={14} className="avatar-download-spinner" /> : <Download size={14} />} Download</button></span></div><button className="avatar-preview-use avatar-preview-select" onClick={() => setSelectedAvatar(generation!.avatarId)}>{selectedAvatar === generation!.avatarId ? <><Check size={13} /> Selected for your next creation</> : <>Use this avatar <ArrowRight size={13} /></>}</button><div className="avatar-preview-actions"><button className="avatar-secondary-button" onClick={() => void generate(true)} disabled={busy}>Generate New One</button><button className="avatar-primary-button" onClick={closeDialog}><Check size={15} /> Close</button></div></div>
          : generation && (isRunning || failed || realtimeError) ? <div className="avatar-generation-stage"><div className={`avatar-generation-orb${failed || realtimeError ? " avatar-generation-error" : ""}`}>{failed || realtimeError ? <X size={24} /> : <LoaderCircle size={25} />}</div><span className="avatar-section-kicker">AI STUDIO</span><h3>{failed || realtimeError ? "That didn’t quite work" : "Making your avatar"}</h3><p>{completedWithoutPreviews ? "The run completed without saving both preview images. Retry the saved generation or start a new one." : failed ? runError || generatedAvatar?.error_message || "Generation failed. Please try again." : realtimeError ? "Realtime is unavailable. Checking saved status…" : stageLabel[stage] ?? "Working on your avatar…"}</p>{error && !failed && !realtimeError && <p className="avatar-form-error" role="status">{error}</p>}{isRunning && <><div className="avatar-progress-track"><span style={{ width: `${Math.max(8, progress)}%` }} /></div><div className="avatar-progress-meta"><span>Creating landscape and portrait versions</span><b>{progress}%</b></div></>}<div className="avatar-generation-actions">{failed && <><button className="avatar-primary-button" onClick={() => { if (generatedAvatar) void resumeAvatar(generatedAvatar, true); }} disabled={busy || !generatedAvatar}><WandSparkles size={15} /> Retry generation</button><button className="avatar-secondary-button" onClick={() => void generate(true)} disabled={busy}><Plus size={15} /> Generate New One</button></>}{!generation.publicAccessToken && !failed && <button className="avatar-primary-button" onClick={() => { if (generatedAvatar) void resumeAvatar(generatedAvatar); }} disabled={busy || !generatedAvatar}><WandSparkles size={15} /> Reconnect status</button>}<button className="avatar-secondary-button" onClick={closeDialog}>Close</button></div></div>
          : <>
            <label className="avatar-field-label">Your reference photo <span>REQUIRED</span></label>
            <button className={`avatar-upload-zone${file ? " avatar-upload-ready" : ""}${draggingFile ? " avatar-upload-dragging" : ""}`} onClick={() => fileRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDraggingFile(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDraggingFile(false); }} onDrop={(event) => { event.preventDefault(); setDraggingFile(false); chooseFile(event.dataTransfer.files[0]); }}>{file && fileUrl ? <><Image className="avatar-upload-thumb" src={fileUrl} width={46} height={52} alt="Selected reference" unoptimized /><span className="avatar-upload-copy"><strong>{file.name}</strong><small>Click to choose a different photo</small></span><Check className="avatar-upload-check" size={18} /></> : <><span className="avatar-upload-icon"><ImagePlus size={19} /></span><span className="avatar-upload-copy"><strong>{draggingFile ? "Drop your photo to add it" : <>Drop your photo here, or <em>browse</em></>}</strong><small>Clear, front-facing photos work best · JPG, PNG · up to 10 MB</small></span><Upload className="avatar-upload-end" size={17} /></>}</button>
            <input ref={fileRef} className="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseFile(event.target.files?.[0])} />
            <label className="avatar-field-label avatar-style-label-heading">Choose a style</label><div className="avatar-style-grid">{styles.map((item, index) => <button key={item} className={`avatar-style-option${style === item ? " avatar-style-selected" : ""}`} onClick={() => setStyle(item)}><span className={`avatar-style-art art-${index}`}><span /></span><span><strong>{item}</strong><small>{["Camera-ready", "Effortless", "Playful", "Artful"][index]}</small></span>{style === item && <span className="avatar-style-check"><Check size={11} /></span>}</button>)}</div>
            <label className="avatar-field-label" htmlFor="avatar-prompt">Make it your own <span>OPTIONAL</span></label><textarea id="avatar-prompt" className="avatar-prompt-input" rows={2} placeholder="e.g. Warm natural lighting, a soft neutral background…" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            {error && <p className="avatar-form-error" role="alert">{error}</p>}
            <div className="avatar-modal-actions"><button className="avatar-secondary-button" onClick={() => void uploadAsIs()} disabled={busy}><Upload size={15} /> Upload as It Is</button><button className="avatar-primary-button avatar-generate-button" onClick={() => void generate()} disabled={!file || busy}><Sparkles size={15} /> {busy ? "Starting…" : retryableAttempt ? "Retry generation" : "Generate with AI"}</button></div>
          </>}
      </div><footer className="avatar-modal-footer"><span><Sparkles size={12} /> AI STUDIO <i /> Your next on-screen presence starts here</span><button onClick={closeDialog}>Close</button></footer>
    </section></div>}

    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(isOpen) => {
      if (!isOpen && !deleteInFlight.current) {
        setDeleteTarget(null);
        setDeleteError("");
      }
    }}>
      <AlertDialogContent className="avatar-delete-dialog" size="sm">
        <AlertDialogHeader className="avatar-delete-dialog-header">
          <AlertDialogTitle>Delete failed avatar?</AlertDialogTitle>
          <AlertDialogDescription>Delete this failed avatar? This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        {deleteError && <p className="avatar-delete-error" role="alert">{deleteError}</p>}
        <AlertDialogFooter className="avatar-delete-dialog-footer">
          <AlertDialogCancel disabled={deletingAvatarId !== null}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            className="avatar-delete-confirm"
            onClick={() => void confirmDeleteAvatar()}
            disabled={!deleteTarget || deletingAvatarId !== null}
          >{deletingAvatarId === deleteTarget?.id ? <><LoaderCircle size={14} className="avatar-delete-spinner" /> Deleting…</> : <><Trash2 size={14} /> Delete</>}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={Boolean(previewAvatar)} onOpenChange={(isOpen) => { if (!isOpen) setPreviewAvatar(null); }}>
      <DialogContent className="avatar-lightbox" overlayClassName="avatar-lightbox-overlay" showCloseButton={false}>
        <header className="avatar-lightbox-header">
          <div>
            <span className="avatar-lightbox-kicker">AI STUDIO · AVATAR PREVIEW</span>
            <DialogTitle>{previewAvatar?.name ?? "Avatar preview"}</DialogTitle>
            <DialogDescription>Full-size private preview</DialogDescription>
          </div>
          <DialogClose className="avatar-lightbox-close" aria-label="Close preview"><X size={18} /></DialogClose>
        </header>
        {previewAvatar && <div className="avatar-lightbox-body">
          {previewAvatar.image_16_9_url && previewAvatar.image_9_16_url
            ? <div className="avatar-lightbox-switcher" role="tablist" aria-label="Preview image format">
                <button type="button" role="tab" aria-selected={previewFormat === "landscape"} className={previewFormat === "landscape" ? "active" : ""} onClick={() => setPreviewFormat("landscape")}>Landscape <span>16:9</span></button>
                <button type="button" role="tab" aria-selected={previewFormat === "portrait"} className={previewFormat === "portrait" ? "active" : ""} onClick={() => setPreviewFormat("portrait")}>Portrait <span>9:16</span></button>
              </div>
            : <span className="avatar-lightbox-single-format">{previewAvatar.image_16_9_url ? "Landscape · 16:9" : "Portrait · 9:16"}</span>}
          <div className={`avatar-lightbox-stage ${previewFormat}`}>
            {previewImage
              ? <Image className="avatar-lightbox-image" src={previewImage} alt={`${previewAvatar.name}, ${previewFormat} avatar preview`} fill sizes="(max-width: 760px) 96vw, 1200px" unoptimized />
              : <p role="status">This image preview is unavailable.</p>}
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </div>;
}
