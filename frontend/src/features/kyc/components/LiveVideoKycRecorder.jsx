import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  Mic,
  RefreshCw,
  ShieldCheck,
  Square,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";

const MAX_VIDEO_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE_LABEL = "20 MB";

function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function getFileExtension(mimeType) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("quicktime")) return "mov";
  return "webm";
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export default function LiveVideoKycRecorder({ uploadState = {}, onUpload }) {
  const [phase, setPhase] = useState("idle");
  const [previewUrl, setPreviewUrl] = useState("");
  const [recordedFile, setRecordedFile] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cameraError, setCameraError] = useState("");

  const liveVideoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const previewUrlRef = useRef("");
  const exceededSizeRef = useRef(false);

  const isUploading = uploadState.status === "uploading";
  const isUploaded = uploadState.status === "uploaded";
  const isFailed = uploadState.status === "failed";

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const clearRecordingTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearPreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPreviewUrl("");
  };

  useEffect(() => {
    if (phase === "camera" && liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
      liveVideoRef.current.play().catch(() => {
        setCameraError("Unable to start the camera preview. Please allow camera access and try again.");
        stopCamera();
        setPhase("error");
      });
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "preview" && previewVideoRef.current && previewUrl) {
      previewVideoRef.current.load();
    }
  }, [phase, previewUrl]);

  useEffect(() => {
    if (isUploaded) setPhase("uploaded");
    else if (isFailed && phase === "uploading") setPhase("preview");
  }, [isUploaded, isFailed, phase]);

  useEffect(() => () => {
    clearRecordingTimer();
    stopCamera();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const startRecording = async () => {
    setCameraError("");
    setElapsedSeconds(0);
    exceededSizeRef.current = false;
    chunksRef.current = [];

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported by this browser. Please use an updated browser over HTTPS.");
      setPhase("error");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setCameraError("Live video recording is not supported by this browser. Please use an updated Chrome, Edge, or Safari browser.");
      setPhase("error");
      return;
    }

    const mimeType = getSupportedRecordingMimeType();
    if (!mimeType) {
      setCameraError("This browser does not support a compatible video recording format.");
      setPhase("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      setPhase("camera");

      // Wait for the camera preview element to mount and start before recording.
      await new Promise((resolve, reject) => {
        let poll;
        const finish = (error) => {
          if (poll) window.clearInterval(poll);
          window.clearTimeout(timeout);
          if (error) reject(error);
          else resolve();
        };
        const timeout = window.setTimeout(
          () => finish(new Error("Camera preview timed out.")),
          8000,
        );
        const checkReady = () => {
          const video = liveVideoRef.current;
          if (video && video.srcObject === stream && video.readyState >= 2) {
            finish();
          }
        };
        poll = window.setInterval(checkReady, 100);
        checkReady();
      });

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          chunksRef.current.push(event.data);
          const currentSize = chunksRef.current.reduce((total, chunk) => total + chunk.size, 0);
          if (currentSize > MAX_VIDEO_SIZE && recorder.state === "recording") {
            exceededSizeRef.current = true;
            recorder.stop();
          }
        }
      };

      recorder.onerror = () => {
        setCameraError("A recording error occurred. Please try recording again.");
        clearRecordingTimer();
        stopCamera();
        setPhase("error");
      };

      recorder.onstop = () => {
        clearRecordingTimer();
        stopCamera();

        const actualMimeType = recorder.mimeType || mimeType;
        const blob = new Blob(chunksRef.current, { type: actualMimeType });

        if (exceededSizeRef.current || blob.size > MAX_VIDEO_SIZE) {
          setRecordedFile(null);
          setCameraError(`The recording exceeded the ${MAX_VIDEO_SIZE_LABEL} limit. Please record a shorter video.`);
          setPhase("error");
          return;
        }

        if (!blob.size) {
          setCameraError("No video data was captured. Please try again.");
          setPhase("error");
          return;
        }

        const normalizedMimeType = actualMimeType.split(";")[0];
        const fileName = `aquapay-video-kyc-${Date.now()}.${getFileExtension(normalizedMimeType)}`;
        const file = new File([blob], fileName, { type: normalizedMimeType, lastModified: Date.now() });

        clearPreview();
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setRecordedFile(file);
        setPhase("preview");
      };

      recorder.start(1000);
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((previous) => previous + 1);
      }, 1000);
    } catch (error) {
      stopCamera();
      clearRecordingTimer();
      const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
      const noDevice = error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError";
      setCameraError(
        denied
          ? "Camera or microphone permission was denied. Allow access in your browser settings and try again."
          : noDevice
            ? "No camera or microphone was found on this device."
            : error?.message || "Unable to access the camera. Please try again.",
      );
      setPhase("error");
    }
  };

  const stopRecording = () => {
    clearRecordingTimer();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const retakeRecording = () => {
    clearPreview();
    setRecordedFile(null);
    setElapsedSeconds(0);
    setCameraError("");
    setPhase("idle");
  };

  const uploadRecording = () => {
    if (!recordedFile || isUploading || isUploaded) return;
    if (recordedFile.size > MAX_VIDEO_SIZE) {
      toast.error(`Video must be smaller than ${MAX_VIDEO_SIZE_LABEL}.`);
      return;
    }
    setPhase("uploading");
    onUpload(recordedFile, "consent_video", "videoFile");
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
          <Video className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Live Video KYC *</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Record your KYC video now using your camera and microphone. Videos selected from your gallery are not accepted here.
          </p>
        </div>
        {isUploaded && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />}
      </div>

      {phase === "camera" || phase === "recording" ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl bg-slate-950">
            <video ref={liveVideoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
            <div className={`absolute left-3 top-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white ${phase === "recording" ? "bg-rose-600" : "bg-slate-700"}`}>
              <span className={`h-2 w-2 rounded-full bg-white ${phase === "recording" ? "animate-pulse" : ""}`} />
              {phase === "recording" ? `REC ${formatDuration(elapsedSeconds)}` : "Starting camera…"}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Camera className="h-4 w-4" /> Front camera active</span>
            <span className="inline-flex items-center gap-1.5"><Mic className="h-4 w-4" /> Microphone active</span>
          </div>
          <button type="button" onClick={stopRecording} disabled={phase !== "recording"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60">
            <Square className="h-4 w-4 fill-current" /> Stop Recording
          </button>
        </div>
      ) : null}

      {phase === "preview" || phase === "uploading" || phase === "uploaded" ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl bg-slate-950">
            <video ref={previewVideoRef} src={previewUrl || undefined} controls playsInline className="aspect-video w-full object-contain" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>{recordedFile ? `${(recordedFile.size / (1024 * 1024)).toFixed(2)} MB · ${formatDuration(elapsedSeconds)}` : "Recorded video"}</span>
            <span className="text-emerald-700">Preview your recording before submitting</span>
          </div>
          {isUploaded ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-5 w-5" /> Video uploaded and confirmed by server.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button type="button" onClick={retakeRecording} disabled={isUploading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw className="h-4 w-4" /> Retake Video
              </button>
              <button type="button" onClick={uploadRecording} disabled={isUploading || !recordedFile} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a1945] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#13286b] disabled:opacity-50">
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isUploading ? "Uploading Video…" : isFailed ? "Retry Upload" : "Submit Video KYC"}
              </button>
            </div>
          )}
          {isFailed && <p className="text-xs text-rose-600">{uploadState.error || "Upload failed. You can retry the upload."}</p>}
        </div>
      ) : null}

      {phase === "idle" || phase === "error" ? (
        <div className="space-y-3">
          {phase === "error" && cameraError ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {cameraError}
            </div>
          ) : null}
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <Camera className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Ready to record your KYC video?</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              Keep your face visible, speak clearly, and read the consent statement. Your browser will ask for camera and microphone permission.
            </p>
            <button type="button" onClick={startRecording} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a1945] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#13286b]">
              <Video className="h-4 w-4" /> Start Live Video KYC
            </button>
          </div>
          <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Recording is uploaded only after you preview and submit it. Maximum size: {MAX_VIDEO_SIZE_LABEL}.</p>
        </div>
      ) : null}
    </section>
  );
}
