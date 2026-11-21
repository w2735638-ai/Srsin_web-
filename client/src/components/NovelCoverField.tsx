import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { prepareNovelCover, type PreparedNovelCover } from "@/lib/novelCoverImage";

export type PendingNovelCover = PreparedNovelCover & { previewUrl: string };

type Props = {
  value: string;
  pending: PendingNovelCover | null;
  onChange: (value: string) => void;
  onPendingChange: (cover: PendingNovelCover | null) => void;
  onProcessingChange?: (processing: boolean) => void;
  disabled?: boolean;
};

export function NovelCoverField({ value, pending, onChange, onPendingChange, onProcessingChange, disabled = false }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [failedPreviewSource, setFailedPreviewSource] = useState("");

  useEffect(() => () => {
    if (pending?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(pending.previewUrl);
  }, [pending?.previewUrl]);

  const onSelectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setError("");
    setStatus("");
    setFailedPreviewSource("");
    setProcessing(true);
    onProcessingChange?.(true);
    try {
      const prepared = await prepareNovelCover(file);
      const previewUrl = URL.createObjectURL(prepared.blob);
      onPendingChange({ ...prepared, previewUrl });
      setStatus(`Ready to save · ${prepared.width} × ${prepared.height} · ${(prepared.blob.size / 1024).toFixed(0)} KB`);
    } catch (reason) {
      onPendingChange(null);
      setError(reason instanceof Error ? reason.message : "The image could not be prepared.");
    } finally {
      setProcessing(false);
      onProcessingChange?.(false);
    }
  };

  const onUrlChange = (nextValue: string) => {
    onPendingChange(null);
    setError("");
    setStatus("");
    setFailedPreviewSource("");
    onChange(nextValue);
  };

  const previewSource = pending?.previewUrl || value.trim();
  const previewFailed = Boolean(previewSource && failedPreviewSource === previewSource);

  return (
    <div className="novel-cover-field">
      <label className="field-label" htmlFor="novel-cover-url">Cover image <span className="optional-label">optional</span></label>
      <div className="cover-source-row">
        <input
          id="novel-cover-url"
          className="form-input"
          type="text"
          inputMode="url"
          autoCapitalize="off"
          value={value}
          onChange={event => onUrlChange(event.target.value)}
          placeholder="Paste a direct https:// image URL"
          maxLength={2000}
          disabled={disabled || processing}
        />
        <input ref={fileInput} className="cover-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void onSelectFile(event)} disabled={disabled || processing} />
        <button type="button" className="button button-quiet cover-file-button" onClick={() => fileInput.current?.click()} disabled={disabled || processing}>
          {processing ? <LoaderCircle size={15} className="cover-spinner" /> : <ImagePlus size={15} />}
          {processing ? "Preparing…" : "Choose image"}
        </button>
      </div>
      <p className="cover-upload-help">JPEG, PNG or WebP. Device images are resized and compressed before saving.</p>
      {previewSource ? (
        <>
          <div className={previewFailed ? "cover-preview-row cover-preview-failed" : "cover-preview-row"}>
            <img src={previewSource} alt="Novel cover preview" style={previewFailed ? { visibility: "hidden" } : undefined} onLoad={() => setFailedPreviewSource(current => current === previewSource ? "" : current)} onError={() => setFailedPreviewSource(previewSource)} />
            <div className="cover-preview-copy"><strong>{previewFailed ? "Cover preview unavailable" : pending ? "New cover ready" : "Current cover"}</strong><span>{pending ? `${pending.width} × ${pending.height} · ${(pending.blob.size / 1024).toFixed(0)} KB` : "This image appears on the library cards and story page."}</span></div>
            <button type="button" className="cover-clear-button" onClick={() => { onPendingChange(null); onChange(""); setStatus(""); setError(""); setFailedPreviewSource(""); }} disabled={disabled || processing} aria-label="Remove cover image"><X size={16} /></button>
          </div>
          {previewFailed ? <p className="form-error cover-preview-error" role="alert">This URL did not load as an image. Paste a direct image URL or choose an image file from your device.</p> : null}
        </>
      ) : null}
      {status ? <p className="cover-upload-status" role="status">{status}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
