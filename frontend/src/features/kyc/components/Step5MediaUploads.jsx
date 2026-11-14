import React, { useRef, useState } from "react";
import { 
  Upload, 
  CheckCircle2, 
  Lightbulb, 
  User, 
  Mic, 
  CreditCard, 
  Volume2,
  FileText
} from "lucide-react";

export function Step5MediaUploads({ 
  formData, 
  onFileUpload, 
  onNext, 
  onPrev, 
  isSavingStep 
}) {
  const [activeTab, setActiveTab] = useState("consent"); // "consent" | "upload"

  const selfieInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const shopInputRef = useRef(null);

  const [dragActive, setDragActive] = useState({
    selfie: false,
    video: false,
    shop: false,
  });

  const handleDrag = (e, target, status) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive((prev) => ({ ...prev, [target]: status }));
  };

  const handleDrop = (e, assetType, fieldName, target) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive((prev) => ({ ...prev, [target]: false }));
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      onFileUpload(file, assetType, fieldName);
    }
  };

  const handleFileInputChange = (e, assetType, fieldName) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file, assetType, fieldName);
    }
  };

  const selfieFile = formData.selfieFile;
  const videoFile = formData.videoFile;
  const shopPhotoFile = formData.shopPhotoFile;

  const nameVal = formData.fullName || "[Full Name]";
  const aadhaarVal = formData.aadhaarNumber 
    ? String(formData.aadhaarNumber).replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ")
    : "[Aadhaar Number]";
  const panVal = formData.panNumber || "[PAN Number]";

  return (
    <div className="bg-white rounded-2xl max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0a1945] tracking-tight">
            Upload Documents
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Upload your media & business documents to verify your profile
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-4 sm:gap-6 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("consent")}
          className={`pb-3 text-xs sm:text-sm font-semibold transition cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === "consent"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>1. Consent Scripts</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
            Read Aloud
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={`pb-3 text-xs sm:text-sm font-semibold transition cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === "upload"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>2. Upload Files</span>
          {(selfieFile || videoFile || shopPhotoFile) && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>
      </div>

      {/* Instruction Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium px-3 py-1.5 rounded-lg">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          Well-lit area
        </span>
        <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium px-3 py-1.5 rounded-lg">
          <User className="w-3.5 h-3.5 text-blue-500" />
          Face visible
        </span>
        <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium px-3 py-1.5 rounded-lg">
          <Mic className="w-3.5 h-3.5 text-emerald-500" />
          Speak clearly
        </span>
        <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium px-3 py-1.5 rounded-lg">
          <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
          Show ID to camera
        </span>
      </div>

      {/* TAB 1: CONSENT SCRIPTS */}
      {activeTab === "consent" && (
        <div className="space-y-4">
          {/* English Script */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-extrabold text-[10px]">GB</span>
                ENGLISH — Read aloud on camera
              </span>
              <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                <Volume2 className="w-3 h-3" /> Voice Prompt
              </span>
            </div>
            <p className="text-[13.5px] text-slate-800 leading-relaxed font-serif sm:font-sans bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              &quot;My name is <strong className="text-blue-700 underline underline-offset-2">{nameVal}</strong>, my Aadhaar number is <strong className="text-blue-700 underline underline-offset-2">{aadhaarVal}</strong>. My PAN card number is <strong className="text-blue-700 underline underline-offset-2">{panVal}</strong>. I want to use AquaPay. I will ensure I collect all KYC documents from customers for every transaction. I take full responsibility for any fraudulent activity under my ID and will provide required documents for any chargebacks.&quot;
            </p>
          </div>

          {/* Hindi Script */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-extrabold text-[10px]">IN</span>
                हिंदी — ज़ोर से पढ़ें
              </span>
            </div>
            <p className="text-[13.5px] text-slate-800 leading-relaxed bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              &quot;मेरा नाम <strong className="text-blue-700 underline underline-offset-2">{nameVal}</strong> है, मेरा आधार नंबर <strong className="text-blue-700 underline underline-offset-2">{aadhaarVal}</strong> है। मेरा पैन कार्ड नंबर <strong className="text-blue-700 underline underline-offset-2">{panVal}</strong> है। मैं AquaPay का उपयोग करना चाहता हूँ। मैं सुनिश्चित करूँगा कि प्रत्येक लेन-देन में ग्राहक से सभी केवाईसी दस्तावेज़ लूँ। मेरे आईडी के तहत किसी भी धोखाधड़ी की पूरी जिम्मेदारी मेरी होगी।&quot;
            </p>
          </div>

          {/* Gujarati Script */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">IN</span>
                ગુજરાતી — જોરથી વાંચો
              </span>
            </div>
            <p className="text-[13.5px] text-slate-800 leading-relaxed bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              &quot;મારું નામ <strong className="text-blue-700 underline underline-offset-2">{nameVal}</strong> છે, મારો આધાર નંબર <strong className="text-blue-700 underline underline-offset-2">{aadhaarVal}</strong> છે. મારો પાન કાર્ડ નંબર <strong className="text-blue-700 underline underline-offset-2">{panVal}</strong> છે. હું AquaPay નો ઉપયોગ કરવા માંગું છું. હું ખાતરી કરીશ કે દરેક ટ્રાન્ઝેક્શનમાં ગ્રાહક પાસેથી તમામ KYC દસ્તાવેજો લઈશ. મારી ID હેઠળ થતી કોઈપણ છેતરપિંડી માટે સંપૂર્ણ જવાબદારી મારી રહેશે.&quot;
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className="bg-[#0a1945] hover:bg-[#13286b] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
            >
              Proceed to Upload Documents &rarr;
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: EXISTING UPLOAD ZONES */}
      {activeTab === "upload" && (
        <div className="space-y-5 pt-2">
          {/* 1. Selfie Photo */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Selfie Photo
            </label>
            <input
              type="file"
              ref={selfieInputRef}
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={(e) => handleFileInputChange(e, "selfie", "selfieFile")}
            />
            <div
              onDragOver={(e) => handleDrag(e, "selfie", true)}
              onDragLeave={(e) => handleDrag(e, "selfie", false)}
              onDrop={(e) => handleDrop(e, "selfie", "selfieFile", "selfie")}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition ${
                dragActive.selfie
                  ? "border-[#00c5ff] bg-cyan-50/20"
                  : selfieFile
                  ? "border-emerald-400 bg-emerald-50/10"
                  : "border-slate-300 bg-white hover:border-slate-400"
              }`}
            >
              {selfieFile ? (
                <div className="flex flex-col items-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  <span className="text-sm font-semibold text-slate-900 truncate max-w-xs">
                    {typeof selfieFile === "string" ? selfieFile : selfieFile.name}
                  </span>
                  <span className="text-xs text-emerald-700 font-medium">Selfie Attached Successfully</span>
                  <button
                    type="button"
                    onClick={() => selfieInputRef.current?.click()}
                    className="mt-2 text-xs font-semibold text-[#0a1945] hover:underline cursor-pointer"
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-[#0284c7] mb-2 stroke-[1.8]" />
                  <span className="text-sm font-medium text-slate-900">
                    Drag and drop selfie photo here
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5 mb-3">
                    PNG, JPG or JPEG (max. 10 MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => selfieInputRef.current?.click()}
                    className="bg-[#0a1945] hover:bg-[#13286b] active:scale-[0.99] text-white text-xs font-semibold px-6 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Browse Files
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 2. Video KYC upload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-900">
                Video KYC upload
              </label>
              <button
                type="button"
                onClick={() => setActiveTab("consent")}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
              >
                View Consent Scripts
              </button>
            </div>
            <input
              type="file"
              ref={videoInputRef}
              accept="video/mp4,video/quicktime,video/mov,video/webm"
              className="hidden"
              onChange={(e) => handleFileInputChange(e, "consent_video", "videoFile")}
            />
            <div
              onDragOver={(e) => handleDrag(e, "video", true)}
              onDragLeave={(e) => handleDrag(e, "video", false)}
              onDrop={(e) => handleDrop(e, "consent_video", "videoFile", "video")}
              className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition ${
                dragActive.video
                  ? "border-[#00c5ff] bg-cyan-50/20"
                  : videoFile
                  ? "border-emerald-400 bg-emerald-50/10"
                  : "border-slate-300 bg-white hover:border-slate-400"
              }`}
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                {videoFile ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                ) : (
                  <Upload className="w-7 h-7 text-[#0284c7] shrink-0 stroke-[1.8]" />
                )}
                <div className="text-left min-w-0">
                  <span className="block text-sm font-medium text-slate-900 truncate">
                    {videoFile 
                      ? (typeof videoFile === "string" ? videoFile : videoFile.name)
                      : "Drag and drop KYC video here"}
                  </span>
                  <span className="block text-xs text-slate-400">
                    MP4, MOV (max. 50 MB)
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="bg-[#0a1945] hover:bg-[#13286b] active:scale-[0.99] text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-xs transition shrink-0 cursor-pointer self-start sm:self-auto"
              >
                {videoFile ? "Change File" : "Browse Files"}
              </button>
            </div>
          </div>

          {/* 3. Shop / Business Location Photo */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Shop / Business Location Photo
            </label>
            <input
              type="file"
              ref={shopInputRef}
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={(e) => handleFileInputChange(e, "shop_image", "shopPhotoFile")}
            />
            <div
              onDragOver={(e) => handleDrag(e, "shop", true)}
              onDragLeave={(e) => handleDrag(e, "shop", false)}
              onDrop={(e) => handleDrop(e, "shop_image", "shopPhotoFile", "shop")}
              className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition ${
                dragActive.shop
                  ? "border-[#00c5ff] bg-cyan-50/20"
                  : shopPhotoFile
                  ? "border-emerald-400 bg-emerald-50/10"
                  : "border-slate-300 bg-white hover:border-slate-400"
              }`}
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                {shopPhotoFile ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                ) : (
                  <Upload className="w-7 h-7 text-[#0284c7] shrink-0 stroke-[1.8]" />
                )}
                <div className="text-left min-w-0">
                  <span className="block text-sm font-medium text-slate-900 truncate">
                    {shopPhotoFile 
                      ? (typeof shopPhotoFile === "string" ? shopPhotoFile : shopPhotoFile.name)
                      : "Drag and drop shop location photo here"}
                  </span>
                  <span className="block text-xs text-slate-400">
                    PNG, JPG or JPEG (max. 10 MB)
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => shopInputRef.current?.click()}
                className="bg-[#0a1945] hover:bg-[#13286b] active:scale-[0.99] text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-xs transition shrink-0 cursor-pointer self-start sm:self-auto"
              >
                {shopPhotoFile ? "Change File" : "Browse Files"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation Buttons */}
      <div className="pt-4 flex items-center justify-between border-t border-slate-100">
        <button
          type="button"
          onClick={onPrev}
          disabled={isSavingStep}
          className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={isSavingStep}
          className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white text-xs font-semibold px-7 py-2.5 rounded-xl shadow-md transition cursor-pointer"
        >
          {isSavingStep ? "Processing..." : "Continue"}
        </button>
      </div>
    </div>
  );
}

export default Step5MediaUploads;