import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  CreditCard,
  Building2,
  Camera,
  Send,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Smartphone,
  FileSignature,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { parseApiError } from "../../utils/errorHandler";
import { useAuth } from "../../features/auth/useAuth";

// Reusable White-Theme Components
import KycHeader from "../../features/kyc/components/KycHeader";
import KycStepper from "../../features/kyc/components/KycStepper";
import Step1BasicDetails from "../../features/kyc/components/Step1BasicDetails";
import Step2AadhaarAuth from "../../features/kyc/components/Step2AadhaarAuth";
import Step1OtpVerification from "../../features/kyc/components/Step1OtpVerification";
import Step3PanVerification from "../../features/kyc/components/Step3PanVerification";
import Step4BankDetails from "../../features/kyc/components/Step4BankDetails";
import Step5MediaUploads from "../../features/kyc/components/Step5MediaUploads";
import Step6Agreements from "../../features/kyc/components/Step6Agreements";
import Step7ReviewSubmit from "../../features/kyc/components/Step7ReviewSubmit";
import KycSuccessView from "../../features/kyc/components/KycSuccessView";
import KycRejectedView from "../../features/kyc/components/KycRejectedView";
import { useStep1Otp } from "../../features/kyc/hooks/useStep1Otp";
import { useAadhaarSession } from "../../features/kyc/hooks/useAadhaarSession";
import { useKycStatusFlow } from "../../features/kyc/hooks/useKycStatusFlow";

// KYC Backend API Services
import {
  getKycStatus,
  saveBasicDetails,
  requestBasicDetailsOtp,
  verifyPanDetails,
  saveBankDetails,
  uploadKycMedia,
  acceptAgreement,
  submitKycApplication,
} from "../../api/kyc.api";

export function KycVerificationPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const [formData, setFormData] = useState({
    fullName: storedUser?.name || "",
    phone: storedUser?.mobile?.replace(/^\+91/, "") || "",
    email: storedUser?.email || "",
    businessType: "Sole Proprietorship",
    shopAddress: storedUser?.address || "",
    address: storedUser?.address || "",

    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    bankName: "",

    selfieFile: null,
    videoFile: null,
    shopPhotoFile: null,

    agreedTerms: false,
    agreedDataProcessing: false,
    agreedCreditCheck: false,
  });

  const [step1Errors, setStep1Errors] = useState({});
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedDraftTime, setSavedDraftTime] = useState("Just now");

  // Step 3 (PAN) states
  const [panVerified, setPanVerified] = useState(false);
  const [panLoading, setPanLoading] = useState(false);
  const [panError, setPanError] = useState("");

  // Step 2 Aadhaar / DigiLocker Custom Hook
  const {
    otpSent,
    sessionStatus,
    setSessionStatus,
    aadhaarErrorMessage,
    isInitiatingDigilocker,
    isCheckingAadhaarStatus,
    aadhaarVerified,
    setAadhaarVerified,
    aadhaarVerifiedData,
    syncAadhaarVerifiedName,
    handleCheckAadhaarStatus,
    handleTriggerOtp,
    handleResetAadhaarSession,
  } = useAadhaarSession({
    setFormData,
    setCompletedSteps: (cb) => setCompletedSteps(cb),
    setCurrentStep: (cb) => setCurrentStep(cb),
  });

  // KYC Status & Lifecycle Custom Hook
  const {
    currentStep,
    setCurrentStep,
    completedSteps,
    setCompletedSteps,
    kycStatus,
    setKycStatus,
    rejectionReason,
    isLoadingKycStatus,
    kycStatusError,
    isRestarting,
    isRestartFlow,
    setIsRestartFlow,
    isSubmitted,
    setIsSubmitted,
    referenceId,
    setReferenceId,
    uploadStates,
    setUploadStates,
    restartFlagKey,
    handleRefreshStatus,
    handleRestartRejectedKyc,
  } = useKycStatusFlow({
    storedUser,
    navigate,
    setFormData,
    setPanVerified,
    setAadhaarVerified,
    setSessionStatus,
    syncAadhaarVerifiedName,
  });

  // Step 1 OTP Custom Hook
  const {
    step1OtpPhase,
    setStep1OtpPhase,
    step1OtpValue,
    setStep1OtpValue,
    step1OtpTimer,
    setStep1OtpTimer,
    isRequestingStep1Otp,
    isVerifyingStep1Otp,
    step1OtpError,
    setStep1OtpError,
    handleRequestStep1Otp,
    handleVerifyStep1Otp,
  } = useStep1Otp({ setCompletedSteps, setCurrentStep });

  const steps = [
    { id: 1, name: "Basic Details", icon: User, desc: "Personal & Business" },
    { id: 2, name: "Aadhaar Auth", icon: Smartphone, desc: "UIDAI OTP verify" },
    { id: 3, name: "PAN Verification", icon: CreditCard, desc: "Income Tax ID" },
    { id: 4, name: "Bank Details", icon: Building2, desc: "Settlement account" },
    { id: 5, name: "Media Uploads", icon: Camera, desc: "Photos & Video" },
    { id: 6, name: "Agreements", icon: FileSignature, desc: "Terms & consent" },
    { id: 7, name: "Review & Submit", icon: Send, desc: "Final submission" },
  ];

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (step1Errors[field]) {
      setStep1Errors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  // Strict Validation for Step 1
  const validateStep1 = () => {
    const errors = {};

    if (!formData.fullName || formData.fullName.trim().length < 2) {
      errors.fullName = "Full Legal Name is required (minimum 2 characters).";
    }

    const cleanPhone = String(formData.phone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length !== 10) {
      errors.phone = "Please enter a valid 10-digit mobile number.";
    }

    const emailTrimmed = String(formData.email || "").trim();
    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errors.email = "Please enter a valid email address.";
    }

    const shopAddr = (formData.shopAddress || formData.address || "").trim();
    if (!shopAddr || shopAddr.length < 3) {
      errors.shopAddress = "Operating Commercial Address is required.";
    }

    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 3: PAN Verification
  const handleVerifyPan = async () => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const cleanPan = String(formData.panNumber || "").trim().toUpperCase();

    if (!panRegex.test(cleanPan)) {
      setPanError("Invalid PAN format. Must be 5 uppercase letters, 4 digits, and 1 letter (e.g. ABCDE1234F).");
      return;
    }

    setPanLoading(true);
    setPanError("");

    try {
      const res = await verifyPanDetails({
        panNumber: cleanPan,
        pan: cleanPan,
        consent: true,
      });

      const data = res?.data || {};

      if (data.matched === false) {
        setPanVerified(false);
        const msg = data.reason || "PAN name does not match your registered identity name. Please recheck.";
        setPanError(msg);
        toast.error(msg);
        return;
      }

      const isVerified =
        data.status === "VERIFIED" ||
        data.status === "verified" ||
        data.status === "development_unverified" ||
        data.verificationStatus === "COMPLETED" ||
        data.verified === true ||
        Boolean(data.verifiedName || data.full_name);

      if (!isVerified) {
        setPanVerified(false);
        const msg = data.message || "PAN verification could not be confirmed by the tax database.";
        setPanError(msg);
        toast.error(msg);
        return;
      }

      const verifiedName = data.verifiedName || data.full_name;
      const maskedId = data.maskedIdentifier || `••••••${cleanPan.slice(-4)}`;
      setPanVerified(true);
      setCompletedSteps((prev) => Array.from(new Set([...prev, 3])));
      setFormData((prev) => ({
        ...prev,
        panNumber: cleanPan,
        ...(verifiedName ? { panName: verifiedName } : {}),
        panMasked: maskedId,
      }));
      toast.success(`PAN verified with Income Tax Dept: ${verifiedName || "Verified"}`);
    } catch (err) {
      const parsed = parseApiError(err);
      setPanVerified(false);
      setPanError(parsed.message || "PAN verification failed with tax database.");
      toast.error(parsed.message || "PAN verification failed.");
    } finally {
      setPanLoading(false);
    }
  };

  // Step 5: Granular Media Upload
  const handleFileUpload = async (file, assetType, fieldName) => {
    const stateKey = assetType === "selfie" ? "selfie" : assetType === "consent_video" ? "video" : "shop";

    setUploadStates((prev) => ({
      ...prev,
      [stateKey]: { status: "uploading", name: file.name, error: null },
    }));

    try {
      await uploadKycMedia(file, assetType);
      setUploadStates((prev) => ({
        ...prev,
        [stateKey]: { status: "uploaded", name: file.name, error: null },
      }));
      setFormData((prev) => ({ ...prev, [fieldName]: file }));
      toast.success(`${file.name} uploaded successfully.`);
    } catch (err) {
      const parsed = parseApiError(err);
      const errMsg = parsed.message || `Failed to upload ${file.name}.`;
      setUploadStates((prev) => ({
        ...prev,
        [stateKey]: { status: "failed", name: file.name, error: errMsg },
      }));
      toast.error(errMsg);
    }
  };

  // Step navigation with validation
  const handleNextStep = async () => {
    // STEP 1 VALIDATION
    if (currentStep === 1) {
      const isValid = validateStep1();
      if (!isValid) {
        toast.error("Please fill in all required fields accurately before proceeding.");
        return;
      }

      setIsSavingStep(true);
      try {
        await saveBasicDetails({
          businessType: formData.businessType,
          shopAddress: formData.shopAddress || formData.address,
        });

        toast.success("Basic details saved. Please verify your identity with the OTP below.");
        setStep1OtpPhase(true);
        setStep1OtpValue(["", "", "", "", "", ""]);
        setStep1OtpError("");
        window.scrollTo({ top: 0, behavior: "smooth" });

        try {
          await requestBasicDetailsOtp();
          setStep1OtpTimer(60);
          toast.info("A verification code has been requested.");
        } catch (otpErr) {
          const parsedOtp = parseApiError(otpErr);
          if (parsedOtp.type !== "RATE_LIMIT") {
            toast.error(parsedOtp.message || "Failed to auto-request OTP.");
          }
        }
      } catch (err) {
        const parsed = parseApiError(err);
        if (parsed.fieldErrors && Object.keys(parsed.fieldErrors).length > 0) {
          setStep1Errors((prev) => ({ ...prev, ...parsed.fieldErrors }));
        }
        toast.error(parsed.message || "Failed to save Basic Details. Please verify your data.");
      } finally {
        setIsSavingStep(false);
      }
      return;
    }

    // STEP 2 VALIDATION (Aadhaar)
    if (currentStep === 2) {
      if (!aadhaarVerified) {
        if (otpSent) {
          toast.error("Please complete the OTP verification in the DigiLocker window and click 'Check Verification Status'.");
        } else {
          toast.error("Please verify your Aadhaar identity via DigiLocker before proceeding to Step 3.");
        }
        return;
      }
      setCompletedSteps((prev) => Array.from(new Set([...prev, 2])));
      toast.success("Aadhaar e-KYC verified. Proceeding to PAN verification.");
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // STEP 3 VALIDATION (PAN)
    if (currentStep === 3) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      const cleanPan = String(formData.panNumber || "").trim().toUpperCase();
      if (!panRegex.test(cleanPan)) {
        toast.error("Invalid PAN format. Must be 5 uppercase letters, 4 digits, and 1 letter (e.g. ABCDE1234F).");
        return;
      }
      if (!panVerified) {
        toast.error("Please click 'Verify PAN' to authenticate your PAN with the tax database.");
        return;
      }
      setCompletedSteps((prev) => Array.from(new Set([...prev, 3])));
      toast.success("PAN verified successfully.");
      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // STEP 4 VALIDATION (Bank Details)
    if (currentStep === 4) {
      if (completedSteps.includes(4)) {
        setCurrentStep(5);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const cleanAcc = String(formData.accountNumber || "").replace(/\D/g, "");
      const cleanConfirm = String(formData.confirmAccountNumber || "").replace(/\D/g, "");
      if (!cleanAcc || cleanAcc.length < 9 || cleanAcc.length > 18) {
        toast.error("Bank account number must be between 9 and 18 digits.");
        return;
      }
      if (cleanAcc !== cleanConfirm) {
        toast.error("Account numbers do not match. Please verify.");
        return;
      }
      const cleanIfsc = String(formData.ifscCode || "").trim().toUpperCase();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
        toast.error("Invalid IFSC code format. Must follow standard 11-character format (e.g. SBIN0001234).");
        return;
      }

      setIsSavingStep(true);
      try {
        const res = await saveBankDetails({
          ifscCode: cleanIfsc,
          accountNumber: cleanAcc,
        });

        const bankName = res?.data?.bankName || "";

        setFormData((prev) => ({
          ...prev,
          bankName,
          ifscCode: cleanIfsc,
        }));

        toast.success("Bank details saved successfully.");
        setCompletedSteps((prev) => Array.from(new Set([...prev, 4])));
        setCurrentStep(5);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        const parsed = parseApiError(err);
        toast.error(parsed.message || "Bank details verification failed.");
      } finally {
        setIsSavingStep(false);
      }
      return;
    }

    // STEP 5 VALIDATION (Media Uploads)
    if (currentStep === 5) {
      const missing = [];
      if (uploadStates.selfie.status !== "uploaded") missing.push("Signatory Photo (Selfie)");
      if (uploadStates.video.status !== "uploaded") missing.push("Consent Video Clip");
      if (uploadStates.shop.status !== "uploaded") missing.push("Commercial Premise Photo");

      if (missing.length > 0) {
        toast.error(`Please complete all 3 required media uploads: missing ${missing.join(", ")}`);
        return;
      }

      try {
        const statusRes = await getKycStatus();
        if (!statusRes?.data?.completedSteps?.includes(5)) {
          toast.error("Waiting for the server to confirm all three fresh media uploads. Please try again.");
          return;
        }
      } catch (err) {
        toast.error(parseApiError(err).message || "Unable to confirm media uploads.");
        return;
      }
      setCompletedSteps((prev) => Array.from(new Set([...prev, 5])));
      toast.success("All 3 verification documents confirmed by server.");
      setCurrentStep(6);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // STEP 6 VALIDATION (Agreement)
    if (currentStep === 6) {
      if (completedSteps.includes(6)) {
        setCurrentStep(7);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (!formData.agreedTerms) {
        toast.error("Please review and accept the merchant agreement before proceeding.");
        return;
      }
      setIsSavingStep(true);
      try {
        await acceptAgreement({ accepted: true });
        setCompletedSteps((prev) => Array.from(new Set([...prev, 6])));
        toast.success("Merchant agreement executed successfully.");
        setCurrentStep(7);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        const parsed = parseApiError(err);
        toast.error(parsed.message || "Failed to submit agreement.");
      } finally {
        setIsSavingStep(false);
      }
      return;
    }

    if (currentStep < 7) {
      setCompletedSteps((prev) => Array.from(new Set([...prev, currentStep])));
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevStep = () => {
    if (isRestartFlow && currentStep <= 5) {
      toast.info("Steps 1–4 remain verified. Restart continues at Step 5.");
      return;
    }
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSelectStep = (stepId) => {
    if (isRestartFlow && stepId < 5) {
      toast.info("Steps 1–4 remain verified. Continue from Step 5.");
      return;
    }
    if (stepId > 1 && !completedSteps.includes(1)) {
      toast.error("You must complete Step 1 (Basic Details) before moving to subsequent steps.");
      return;
    }

    const precedingDone = steps
      .filter((s) => s.id < stepId)
      .every((s) => completedSteps.includes(s.id));

    if (!precedingDone && stepId > 1) {
      toast.error(`Please complete preceding steps before accessing Step ${stepId}.`);
      return;
    }

    setCurrentStep(stepId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmitApplication = async () => {
    if (!formData.agreedTerms) {
      toast.error("Please agree to the Merchant Agreement before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitKycApplication({ confirm: true });
      if (!["submitted", "under_review"].includes(res?.data?.status)) {
        throw new Error("The backend did not confirm KYC submission. Refresh status before retrying.");
      }
      const caseId = res?.data?.caseId || res?.caseId;
      if (caseId) {
        setReferenceId(`AQP-${String(caseId).padStart(6, "0")}`);
      }

      if (storedUser) {
        const updatedUser = {
          ...storedUser,
          kyc: { ...(storedUser.kyc || {}), status: "submitted" },
        };
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      setIsSubmitted(true);
      setKycStatus("submitted");
      setIsRestartFlow(false);
      if (restartFlagKey) localStorage.removeItem(restartFlagKey);
      toast.success("KYC Application submitted successfully.");
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message || "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  if (isLoadingKycStatus) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center gap-3 text-sm text-slate-600">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Checking your KYC status...
      </div>
    );
  }

  if (kycStatusError) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-7 shadow-sm text-center space-y-4">
          <h1 className="text-lg font-semibold text-slate-900">Unable to load KYC status</h1>
          <p className="text-sm text-slate-600">{kycStatusError}</p>
          <button type="button" onClick={handleRefreshStatus} className="bg-blue-600 text-white text-sm font-medium rounded-xl px-5 py-2.5 hover:bg-blue-700">Try again</button>
        </div>
      </div>
    );
  }

  if (kycStatus === "rejected") {
    return (
      <KycRejectedView
        rejectionReason={rejectionReason}
        completedSteps={completedSteps}
        onRestart={handleRestartRejectedKyc}
        isRestarting={isRestarting}
        onRefresh={handleRefreshStatus}
        onLogout={handleLogout}
      />
    );
  }

  if (kycStatus !== "pending" && !isSubmitted) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-slate-700 gap-4">
        <h2 className="text-lg font-semibold">KYC status unavailable</h2>
        <p className="text-sm">We couldn't confirm your application is editable. No changes were made.</p>
        <button type="button" onClick={handleRefreshStatus} className="rounded-xl bg-blue-600 px-5 py-2.5 text-white text-sm">Refresh status</button>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <KycSuccessView
        onCheckStatus={handleRefreshStatus}
        isCheckingStatus={isLoadingKycStatus}
        referenceId={referenceId || "—"}
        onProceedDashboard={() => {
          navigate("/user/dashboard");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <KycHeader
        savedDraftTime={savedDraftTime}
        onSaveDraft={() => {
          setSavedDraftTime("Just now");
          toast.success("Progress saved");
        }}
        onLogout={handleLogout}
      />

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        {/* Stepper Progress */}
        <KycStepper
          steps={steps}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onSelectStep={handleSelectStep}
          lockedBeforeStep={isRestartFlow ? 5 : 1}
          isSubmitted={isSubmitted}
        />

        {/* Form Card Container */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {/* Card Sub-header */}
          {currentStep !== 5 && currentStep !== 6 && (
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-white text-blue-700 border border-slate-200 shadow-xs">
                  {React.createElement(steps[currentStep - 1].icon, { className: "w-4 h-4" })}
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium">
                    Step {currentStep} of {steps.length}
                  </span>
                  <h2 className="text-base font-semibold text-slate-900">{steps[currentStep - 1].name}</h2>
                </div>
              </div>

              <span className="text-xs text-slate-500 font-medium bg-white px-3 py-1 rounded-full border border-slate-200">
                Session Active
              </span>
            </div>
          )}

          {/* Step Form Body */}
          <div className={currentStep === 5 || currentStep === 6 ? "p-4 sm:p-6 bg-white" : "p-6 md:p-8 min-h-[380px] bg-white"}>
            {currentStep === 1 && !step1OtpPhase && (
              <Step1BasicDetails
                formData={formData}
                onChange={handleChange}
                errors={step1Errors}
              />
            )}

            {currentStep === 1 && step1OtpPhase && (
              <Step1OtpVerification
                otpValue={step1OtpValue}
                onOtpChange={setStep1OtpValue}
                otpTimer={step1OtpTimer}
                onRequestOtp={handleRequestStep1Otp}
                isRequesting={isRequestingStep1Otp}
                onVerify={handleVerifyStep1Otp}
                isVerifying={isVerifyingStep1Otp}
                error={step1OtpError}
                onBack={() => {
                  setStep1OtpPhase(false);
                  setStep1OtpError("");
                  setStep1OtpValue(["", "", "", "", "", ""]);
                }}
              />
            )}

            {currentStep === 2 && (
              <Step2AadhaarAuth
                formData={formData}
                onChange={handleChange}
                onTriggerOtp={handleTriggerOtp}
                isInitiating={isInitiatingDigilocker}
                digilockerSessionActive={otpSent}
                onCheckStatus={handleCheckAadhaarStatus}
                isCheckingStatus={isCheckingAadhaarStatus}
                aadhaarVerified={aadhaarVerified}
                verifiedData={aadhaarVerifiedData}
                sessionStatus={sessionStatus}
                errorMessage={aadhaarErrorMessage}
                onResetSession={handleResetAadhaarSession}
              />
            )}

            {currentStep === 3 && (
              <Step3PanVerification
                formData={formData}
                onChange={handleChange}
                panVerified={panVerified}
                panLoading={panLoading}
                onVerifyPan={handleVerifyPan}
                panError={panError}
              />
            )}

            {currentStep === 4 && (
              <Step4BankDetails
                formData={formData}
                onChange={handleChange}
                isVerified={completedSteps.includes(4)}
              />
            )}

            {currentStep === 5 && (
              <Step5MediaUploads
                formData={formData}
                onFileUpload={handleFileUpload}
                onNext={handleNextStep}
                onPrev={isRestartFlow ? undefined : handlePrevStep}
                isSavingStep={isSavingStep}
                uploadStates={uploadStates}
              />
            )}

            {currentStep === 6 && (
              <Step6Agreements
                isStepCompleted={completedSteps.includes(6)}
                formData={formData}
                onChange={handleChange}
                onNext={handleNextStep}
                isSavingStep={isSavingStep}
              />
            )}

            {currentStep === 7 && (
              <Step7ReviewSubmit
                isRestartFlow={isRestartFlow}
                formData={formData}
                onEditStep={(stepId) => handleSelectStep(stepId)}
                onSubmitKyc={handleSubmitApplication}
                isSubmitting={isSubmitting}
              />
            )}
          </div>

          {/* Stepper Footer Controls */}
          {!isSubmitted && currentStep !== 5 && currentStep !== 6 && !step1OtpPhase && (
            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={currentStep === 1 || isSavingStep}
                className="flex items-center space-x-2 text-xs font-medium text-slate-700 hover:text-slate-900 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous Step</span>
              </button>

              <div className="flex items-center space-x-3">
                {currentStep < 7 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={isSavingStep}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 text-white text-xs font-medium px-6 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
                  >
                    {isSavingStep ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Details...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue to Step {currentStep + 1}</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitApplication}
                    disabled={isSubmitting || !formData.agreedTerms}
                    className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-medium px-7 py-2.5 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Submitting Application...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Verification</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Compliance Footer Note */}
        <div className="mt-8 text-center text-slate-400 text-xs">
          <span>
            Protected by TLS encryption • Data processed in strict accordance with the Reserve Bank of India (RBI) Master Direction on KYC.
          </span>
        </div>
      </main>
    </div>
  );
}

export default KycVerificationPage;
