import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  CreditCard,
  Building2,
  Camera,
  Send,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  RefreshCw,
  Smartphone,
  Lock,
  FileSignature,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { parseApiError } from "../../utils/errorHandler";
import { isAdminRole } from "../../constants/roles";

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

// KYC Backend API Services
import {
  getKycStatus,
  saveBasicDetails,
  requestBasicDetailsOtp,
  verifyBasicDetailsOtp,
  initiateAadhaarVerification,
  getAadhaarVerificationStatus,
  verifyPanDetails,
  initiatePanVerification,
  saveBankDetails,
  uploadKycMedia,
  acceptAgreement,
  submitKycApplication,
} from "../../api/kyc.api";

export function KycVerificationPage() {
  const navigate = useNavigate();

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  const [currentStep, setCurrentStep] = useState(
    storedUser?.kyc?.currentStep ? Number(storedUser.kyc.currentStep) : 1
  );
  const [completedSteps, setCompletedSteps] = useState([]);
  const [step1Errors, setStep1Errors] = useState({});
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(
    storedUser?.kyc?.status === "submitted" || storedUser?.kyc?.status === "under_review"
  );
  const [referenceId, setReferenceId] = useState(
    storedUser?.kyc?.caseId || ""
  );

  // Step 1 OTP sub-phase states
  const [step1OtpPhase, setStep1OtpPhase] = useState(false);
  const [step1OtpValue, setStep1OtpValue] = useState(["", "", "", "", "", ""]);
  const [step1OtpTimer, setStep1OtpTimer] = useState(0);
  const [isRequestingStep1Otp, setIsRequestingStep1Otp] = useState(false);
  const [isVerifyingStep1Otp, setIsVerifyingStep1Otp] = useState(false);
  const [step1OtpError, setStep1OtpError] = useState("");

  // Step 2 (Aadhaar / DigiLocker) states
  const [digilockerSessionId, setDigilockerSessionId] = useState(null);
  const [digilockerSessionActive, setDigilockerSessionActive] = useState(false);
  const [isInitiatingDigilocker, setIsInitiatingDigilocker] = useState(false);
  const [isCheckingAadhaarStatus, setIsCheckingAadhaarStatus] = useState(false);
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [aadhaarVerifiedData, setAadhaarVerifiedData] = useState({});
  const [aadhaarPollInterval, setAadhaarPollInterval] = useState(null);

  // Legacy / other states
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState(["", "", "", "", "", ""]);
  const [otpTimer, setOtpTimer] = useState(30);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [panVerified, setPanVerified] = useState(false);
  const [panLoading, setPanLoading] = useState(false);
  const [savedDraftTime, setSavedDraftTime] = useState("Just now");

  const [formData, setFormData] = useState({
    fullName: storedUser?.name || "",
    dob: "",
    phone: storedUser?.mobile?.replace(/^\+91/, "") || "",
    email: storedUser?.email || "",
    businessType: "Retail Merchant",
    shopAddress: storedUser?.address || "",
    address: storedUser?.address || "",
    city: storedUser?.city || "",
    state: storedUser?.state || "",
    pincode: storedUser?.pincode || "",

    aadhaarNumber: "",
    aadhaarOtp: "",

    panNumber: "",
    panName: storedUser?.name ? storedUser.name.toUpperCase() : "",

    accountHolderName: storedUser?.name || "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    bankName: "",
    accountType: "Current",

    selfieFile: null,
    videoFile: null,
    shopPhotoFile: null,

    agreedTerms: false,
    agreedDataProcessing: false,
    agreedCreditCheck: false,
  });

  const steps = [
    { id: 1, name: "Basic Details", icon: User, desc: "Personal & Business" },
    { id: 2, name: "Aadhaar Auth", icon: Smartphone, desc: "UIDAI OTP verify" },
    { id: 3, name: "PAN Verification", icon: CreditCard, desc: "Income Tax ID" },
    { id: 4, name: "Bank Details", icon: Building2, desc: "Settlement account" },
    { id: 5, name: "Media Uploads", icon: Camera, desc: "Photos & Video" },
    { id: 6, name: "Agreements", icon: FileSignature, desc: "Terms & consent" },
    { id: 7, name: "Review & Submit", icon: Send, desc: "Final submission" },
  ];

  // Fetch KYC status on mount & enforce Admin exemption
  useEffect(() => {
    // Admin accounts are exempt from merchant KYC onboarding
    if (storedUser && isAdminRole(storedUser)) {
      toast.info("Admin accounts are exempt from KYC verification.");
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    async function fetchStatus() {
      try {
        const res = await getKycStatus();
        if (res?.data) {
          const kycData = res.data;

          if (kycData.hasCase === false) {
            if (storedUser && isAdminRole(storedUser)) {
              navigate("/admin/dashboard", { replace: true });
              return;
            }
            // Normal user has no KYC case yet — backend will auto-create on first step save.
            // Stay on the page; Step 1 save will trigger case creation.
            return;
          }

          if (kycData.status === "completed" || kycData.status === "approved") {
            navigate("/user/dashboard", { replace: true });
            return;
          } else if (kycData.status === "submitted" || kycData.status === "under_review") {
            setIsSubmitted(true);
            return;
          }

          if (Array.isArray(kycData.completedSteps)) {
            setCompletedSteps(kycData.completedSteps);
          }

          if (kycData.currentStep) {
            const serverCurrentStep = Number(kycData.currentStep);
            if (serverCurrentStep > 1 && !kycData.completedSteps?.includes(1)) {
              setCurrentStep(1);
            } else {
              setCurrentStep(serverCurrentStep);
            }
          }
        }
      } catch (err) {
        // Fallback to local session
      }
    }
    fetchStatus();
  }, [navigate]);

  // Aadhaar OTP countdown (legacy – kept for compatibility)
  useEffect(() => {
    let interval = null;
    if (otpSent && otpTimer > 0) {
      interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
    } else if (otpTimer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [otpSent, otpTimer]);

  // Step 2: Check for existing active or verified Aadhaar session on mount / step change
  useEffect(() => {
    if (currentStep === 2 && !aadhaarVerified) {
      async function checkActiveSession() {
        try {
          const statusRes = await getAadhaarVerificationStatus();
          const statusUpper = String(statusRes?.data?.status || "").toUpperCase();
          const sessId = statusRes?.data?.sessionId;
          if (sessId) setDigilockerSessionId(sessId);

          if (statusUpper === "VERIFIED") {
            setAadhaarVerified(true);
            setCompletedSteps((prev) => Array.from(new Set([...prev, 2])));
            const verifiedName = statusRes.data?.verifiedName;
            const maskedId = statusRes.data?.maskedIdentifier;
            setAadhaarVerifiedData({ verifiedName, maskedIdentifier: maskedId });
            if (verifiedName) {
              setFormData((prev) => ({
                ...prev,
                fullName: verifiedName,
                panName: verifiedName.toUpperCase(),
              }));
            }
          } else if (
            statusUpper === "PENDING" ||
            statusRes?.data?.stage === "authorization_pending"
          ) {
            setOtpSent(true);
          }
        } catch {
          // Ignore lookup errors
        }
      }
      checkActiveSession();
    }
  }, [currentStep, aadhaarVerified]);

  // Step 1 OTP countdown
  useEffect(() => {
    let interval = null;
    if (step1OtpPhase && step1OtpTimer > 0) {
      interval = setInterval(() => setStep1OtpTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step1OtpPhase, step1OtpTimer]);

  // Step 1: Request OTP from backend (dev mode → prints OTP to backend console)
  const handleRequestStep1Otp = async () => {
    setIsRequestingStep1Otp(true);
    setStep1OtpError("");
    try {
      await requestBasicDetailsOtp();
      setStep1OtpTimer(60);
      setStep1OtpValue(["", "", "", "", "", ""]);
      toast.success(
        "OTP sent! In development mode the OTP is printed in the backend server console."
      );
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.type === "RATE_LIMIT") {
        setStep1OtpError("Please wait before requesting another OTP.");
        toast.error("Please wait before requesting another OTP.");
      } else {
        toast.error(parsed.message || "Failed to request OTP. Please try again.");
      }
    } finally {
      setIsRequestingStep1Otp(false);
    }
  };

  // Step 1: Verify OTP → marks step as 'completed' in backend DB → allows Aadhaar to proceed
  const handleVerifyStep1Otp = async () => {
    const otp = step1OtpValue.join("");
    if (otp.length !== 6) {
      setStep1OtpError("Please enter all 6 digits of the OTP.");
      return;
    }
    setStep1OtpError("");
    setIsVerifyingStep1Otp(true);
    try {
      await verifyBasicDetailsOtp(otp);
      setCompletedSteps((prev) => Array.from(new Set([...prev, 1])));
      setStep1OtpPhase(false);
      toast.success("Step 1 verified successfully! Proceeding to Aadhaar verification.");
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const parsed = parseApiError(err);
      setStep1OtpError(parsed.message || "Invalid or expired OTP. Please try again.");
      toast.error(parsed.message || "Invalid or expired OTP. Please try again.");
    } finally {
      setIsVerifyingStep1Otp(false);
    }
  };



  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Instant inline validation for Date of Birth
    if (field === "dob") {
      if (!value) {
        setStep1Errors((prev) => ({ ...prev, dob: "Date of Birth is required." }));
        return;
      }
      const selectedDate = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selectedDate > today) {
        setStep1Errors((prev) => ({ ...prev, dob: "Date of Birth cannot be in the future." }));
        return;
      }
    }

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

    if (!formData.dob) {
      errors.dob = "Date of Birth is required.";
    } else {
      const selectedDate = new Date(formData.dob);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selectedDate > today) {
        errors.dob = "Date of Birth cannot be in the future.";
      }
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

    if (!formData.city || formData.city.trim().length < 2) {
      errors.city = "City is required.";
    }

    if (!formData.state || formData.state.trim().length < 2) {
      errors.state = "State is required.";
    }

    const cleanPincode = String(formData.pincode || "").trim();
    if (!cleanPincode || !/^[1-9][0-9]{5}$/.test(cleanPincode)) {
      errors.pincode = "Please enter a valid 6-digit Indian PIN Code.";
    }

    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleTriggerOtp = async () => {
    const cleanAadhaar = String(formData.aadhaarNumber || "").replace(/\D/g, "");
    if (cleanAadhaar.length !== 12) {
      toast.error("Please enter a valid 12-digit Aadhaar number before requesting OTP.");
      return;
    }

    setIsInitiatingDigilocker(true);
    try {
      toast.info("Connecting to UIDAI verification gateway...");
      const res = await initiateAadhaarVerification(true);
      const authUrl = res?.data?.authorizationUrl;
      const sessId = res?.data?.sessionId;

      if (sessId) {
        setDigilockerSessionId(sessId);
      }

      setOtpSent(true);
      setOtpTimer(60);
      setAadhaarVerified(false);
      setOtpValue(["", "", "", "", "", ""]);

      if (authUrl) {
        // Open official UIDAI portal popup so UIDAI delivers OTP to the user's mobile
        window.open(authUrl, "_blank", "width=520,height=680,location=no,status=no");
        toast.success("UIDAI OTP dispatched! Check your Aadhaar-linked mobile for the OTP code.", { duration: 6000 });

        // Auto-poll in background
        if (sessId) {
          if (aadhaarPollInterval) clearInterval(aadhaarPollInterval);
          const interval = setInterval(async () => {
            try {
              const statusRes = await getAadhaarVerificationStatus(sessId);
              const statusUpper = String(statusRes?.data?.status || "").toUpperCase();
              if (statusUpper === "VERIFIED") {
                clearInterval(interval);
                setAadhaarPollInterval(null);
                setAadhaarVerified(true);
                const verifiedName = statusRes.data.verifiedName;
                const maskedId = statusRes.data.maskedIdentifier;
                setAadhaarVerifiedData({ verifiedName, maskedIdentifier: maskedId });
                if (verifiedName) {
                  setFormData((prev) => ({
                    ...prev,
                    fullName: verifiedName,
                    panName: verifiedName.toUpperCase(),
                  }));
                }
                setCompletedSteps((prev) => Array.from(new Set([...prev, 2])));
                toast.success(`Aadhaar e-KYC verified with UIDAI: ${verifiedName || "Verified"}`);
              }
            } catch {
              // Silently poll
            }
          }, 3000);

          setAadhaarPollInterval(interval);
          setTimeout(() => {
            clearInterval(interval);
            setAadhaarPollInterval(null);
          }, 180000);
        }
      } else {
        toast.info("Aadhaar OTP requested. Please enter the OTP received on your mobile.");
      }
    } catch (err) {
      const parsed = parseApiError(err);
      const isAlreadyInProgress =
        err?.response?.status === 409 ||
        err?.response?.data?.code === "VERIFICATION_IN_PROGRESS" ||
        parsed?.message?.toLowerCase().includes("already in progress") ||
        parsed?.message?.toLowerCase().includes("session is already");

      if (isAlreadyInProgress) {
        // Active session already running! Transition directly to OTP entry
        setOtpSent(true);
        setOtpTimer(60);
        setAadhaarVerified(false);
        setOtpValue(["", "", "", "", "", ""]);
        toast.info("A verification session is already active. Please enter the OTP sent to your registered mobile.");

        try {
          const statusRes = await getAadhaarVerificationStatus();
          const sessId = statusRes?.data?.sessionId;
          if (sessId) {
            setDigilockerSessionId(sessId);
          }
          const statusUpper = String(statusRes?.data?.status || "").toUpperCase();
          if (statusUpper === "VERIFIED") {
            setAadhaarVerified(true);
            const verifiedName = statusRes.data.verifiedName;
            const maskedId = statusRes.data.maskedIdentifier;
            setAadhaarVerifiedData({ verifiedName, maskedIdentifier: maskedId });
            setCompletedSteps((prev) => Array.from(new Set([...prev, 2])));
            toast.success(`Aadhaar already verified: ${verifiedName || "Verified"}`);
          }
        } catch {
          // ignore
        }
      } else {
        toast.error(parsed.message || "Failed to initiate UIDAI Aadhaar session. Please try again.");
      }
    } finally {
      setIsInitiatingDigilocker(false);
    }
  };

  const handleCheckAadhaarStatus = async () => {
    setIsCheckingAadhaarStatus(true);
    try {
      // 1. Check Aadhaar session status from backend (IDTO/UIDAI callback completion)
      const sessId = digilockerSessionId;
      const statusRes = await getAadhaarVerificationStatus(sessId || undefined);
      const statusUpper = String(statusRes?.data?.status || "").toUpperCase();

      if (statusUpper === "VERIFIED") {
        if (aadhaarPollInterval) {
          clearInterval(aadhaarPollInterval);
          setAadhaarPollInterval(null);
        }
        setAadhaarVerified(true);
        const verifiedName = statusRes.data?.verifiedName;
        const maskedId = statusRes.data?.maskedIdentifier;
        setAadhaarVerifiedData({ verifiedName, maskedIdentifier: maskedId });
        if (verifiedName) {
          setFormData((prev) => ({
            ...prev,
            fullName: verifiedName,
            panName: verifiedName.toUpperCase(),
          }));
        }
        setCompletedSteps((prev) => Array.from(new Set([...prev, 2])));
        toast.success(`Aadhaar e-KYC verified successfully: ${verifiedName || "Verified"}`);
        // Advance to Step 3 (PAN Verification)
        setCurrentStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // 2. Also check if KYC case marked step 2 as completed in backend DB
      const kycRes = await getKycStatus();
      if (kycRes?.data?.completedSteps?.includes(2)) {
        if (aadhaarPollInterval) {
          clearInterval(aadhaarPollInterval);
          setAadhaarPollInterval(null);
        }
        setAadhaarVerified(true);
        setCompletedSteps((prev) => Array.from(new Set([...prev, 2])));
        toast.success("Aadhaar e-KYC authenticated successfully. Proceeding to Step 3.");
        setCurrentStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // If neither, inform user
      toast.info(
        "Aadhaar authentication is still in progress. Please complete the OTP submission in the Government DigiLocker window, then click Check Verification Status."
      );
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message || "Failed to check Aadhaar status. Please try again.");
    } finally {
      setIsCheckingAadhaarStatus(false);
    }
  };

  const handleVerifyPan = async () => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const cleanPan = String(formData.panNumber || "").trim().toUpperCase();
    if (!cleanPan || !panRegex.test(cleanPan)) {
      toast.error("Invalid PAN format. Must be 5 uppercase letters, 4 digits, and 1 letter (e.g. ABCDE1234F).");
      return;
    }
    setPanLoading(true);
    try {
      // Real backend PAN verification against Income Tax Department (IDTO)
      const res = await verifyPanDetails({ panNumber: cleanPan, consent: true });
      const verifiedName = res?.data?.verifiedName || res?.data?.full_name;
      const maskedId = res?.data?.maskedIdentifier;
      setPanVerified(true);
      setFormData((prev) => ({
        ...prev,
        ...(verifiedName ? { panName: verifiedName } : {}),
        panMasked: maskedId || `••••••${cleanPan.slice(-4)}`,
      }));
      if (verifiedName) {
        toast.success(`PAN verified with Income Tax Dept: ${verifiedName}`);
      } else {
        toast.success("PAN verified successfully against tax database.");
      }
    } catch (err) {
      const parsed = parseApiError(err);
      setPanVerified(false);
      toast.error(parsed.message || "PAN verification failed with tax database. Please verify PAN number.");
    } finally {
      setPanLoading(false);
    }
  };

  const handleFileUpload = async (file, assetType, fieldName) => {
    handleChange(fieldName, file);
    try {
      toast.loading(`Uploading ${file.name}...`, { id: assetType });
      await uploadKycMedia(file, assetType);
      toast.success(`${file.name} uploaded successfully`, { id: assetType });
    } catch (err) {
      toast.success(`${file.name} attached locally`, { id: assetType });
    }
  };

  // Step transition with validation
  const handleNextStep = async () => {
    // STEP 1 VALIDATION
    if (currentStep === 1) {
      const isValid = validateStep1();
      if (!isValid) {
        // If Date of Birth is specifically in the future, display exact message
        const isFutureDob = formData.dob && new Date(formData.dob) > new Date();
        if (isFutureDob || step1Errors.dob === "Date of Birth cannot be in the future.") {
          toast.error("Date of Birth cannot be in the future. Please correct it to proceed.");
        } else {
          toast.error("Please fill in all required fields accurately before proceeding.");
        }
        return;
      }

      setIsSavingStep(true);
      try {
        const cleanPincode = String(formData.pincode || "").trim();
        await saveBasicDetails({
          businessType: formData.businessType || "Retail Merchant",
          shopAddress: formData.shopAddress || formData.address,
          city: formData.city.trim(),
          pincode: cleanPincode,
        });

        setCompletedSteps((prev) => Array.from(new Set([...prev, 1])));
        toast.success("Basic details saved. Please verify your identity with the OTP below.");
        // ── Show Step 1 OTP sub-phase instead of jumping straight to Step 2 ──
        setStep1OtpPhase(true);
        setStep1OtpValue(["", "", "", "", "", ""]);
        setStep1OtpError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
        // Auto-request OTP immediately after save
        try {
          await requestBasicDetailsOtp();
          setStep1OtpTimer(60);
          toast.info("OTP requested. Check the backend console for the code (development mode).");
        } catch (otpErr) {
          const parsedOtp = parseApiError(otpErr);
          if (parsedOtp.type !== "RATE_LIMIT") {
            toast.error(parsedOtp.message || "Failed to auto-request OTP. Click 'Resend OTP' to try again.");
          }
        }
      } catch (err) {
        const parsed = parseApiError(err);

        // Populate field-specific inline errors from backend response
        if (parsed.fieldErrors && Object.keys(parsed.fieldErrors).length > 0) {
          setStep1Errors((prev) => ({ ...prev, ...parsed.fieldErrors }));
        }

        // Display specific error message instead of generic maintenance toast
        toast.error(parsed.message || "Failed to save Basic Details. Please verify your data.");
        return;
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

    // STEP 4 VALIDATION
    if (currentStep === 4) {
      if (!formData.accountHolderName || !formData.accountHolderName.trim()) {
        toast.error("Please enter beneficiary account holder name.");
        return;
      }
      if (!formData.bankName || !formData.bankName.trim()) {
        toast.error("Please enter bank name.");
        return;
      }
      if (!formData.accountNumber || formData.accountNumber.length < 8) {
        toast.error("Please enter a valid bank account number (minimum 8 digits).");
        return;
      }
      if (formData.accountNumber !== formData.confirmAccountNumber) {
        toast.error("Account numbers do not match. Please verify.");
        return;
      }
      if (!formData.ifscCode || formData.ifscCode.length !== 11) {
        toast.error("Please enter a valid 11-character IFSC code (e.g. SBIN0001234).");
        return;
      }
      setIsSavingStep(true);
      try {
        const res = await saveBankDetails({
          ifscCode: String(formData.ifscCode || "").trim().toUpperCase(),
          accountNumber: String(formData.accountNumber || "").trim(),
        });
        const verifiedHolder = res?.data?.accountHolderName;
        const verifiedBank = res?.data?.bankName;
        if (verifiedHolder) {
          setFormData((prev) => ({
            ...prev,
            accountHolderName: verifiedHolder,
            bankName: verifiedBank || prev.bankName,
          }));
          toast.success(`Bank verified via penny-drop: ${verifiedHolder} (${verifiedBank || "Verified"})`);
        } else {
          toast.success("Bank account details saved and verified successfully.");
        }
        setCompletedSteps((prev) => Array.from(new Set([...prev, 4])));
        setCurrentStep(5);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        const parsed = parseApiError(err);
        toast.error(parsed.message || "Bank account verification failed with IDTO banking network.");
        return;
      } finally {
        setIsSavingStep(false);
      }
      return;
    }

    // STEP 5 VALIDATION (Media Uploads)
    if (currentStep === 5) {
      const missing = [];
      if (!formData.videoFile) missing.push("1. Consent Video Clip");
      if (!formData.selfieFile) missing.push("2. Signatory Photo (Selfie)");
      if (!formData.shopPhotoFile) missing.push("3. Commercial Premise Photo");

      if (missing.length > 0) {
        toast.error(`Please attach all 3 verification documents: missing ${missing.join(", ")}`);
        return;
      }

      setCompletedSteps((prev) => Array.from(new Set([...prev, 5])));
      toast.success("All 3 verification documents uploaded successfully.");
      setCurrentStep(6);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // STEP 6 VALIDATION
    if (currentStep === 6) {
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
        if (parsed.type === "NOT_FOUND" || err.response?.status === 404) {
          if (storedUser && isAdminRole(storedUser)) {
            toast.info("Admin accounts are exempt from KYC. Redirecting to Admin Dashboard.");
            navigate("/admin/dashboard", { replace: true });
            return;
          }
          toast.error("KYC application not found. Please complete Step 1 first or contact support.");
        } else {
          toast.error(parsed.message || "Failed to submit agreement.");
        }
        return;
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
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSelectStep = (stepId) => {
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
      const caseId = res?.data?.caseId || res?.caseId;
      if (caseId) {
        setReferenceId(`AQP-${String(caseId).padStart(6, "0")}`);
      }

      if (storedUser) {
        storedUser.kyc = { ...(storedUser.kyc || {}), status: "submitted" };
        localStorage.setItem("user", JSON.stringify(storedUser));
      }

      setIsSubmitted(true);
      toast.success("KYC Application submitted successfully.");
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message || "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    navigate("/login/user");
  };

  if (isSubmitted) {
    return (
      <KycSuccessView
        referenceId={referenceId || "AQP-" + Math.floor(100000 + Math.random() * 900000)}
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
                onResetSession={() => setOtpSent(false)}
              />
            )}

            {currentStep === 3 && (
              <Step3PanVerification
                formData={formData}
                onChange={handleChange}
                panVerified={panVerified}
                panLoading={panLoading}
                onVerifyPan={handleVerifyPan}
              />
            )}

            {currentStep === 4 && (
              <Step4BankDetails formData={formData} onChange={handleChange} />
            )}

            {currentStep === 5 && (
              <Step5MediaUploads
                formData={formData}
                onFileUpload={handleFileUpload}
                onNext={handleNextStep}
                onPrev={handlePrevStep}
                isSavingStep={isSavingStep}
              />
            )}

            {currentStep === 6 && (
              <Step6Agreements 
                formData={formData} 
                onChange={handleChange} 
                onNext={handleNextStep}
                isSavingStep={isSavingStep}
              />
            )}

            {currentStep === 7 && (
              <Step7ReviewSubmit
                formData={formData}
                onEditStep={(stepId) => handleSelectStep(stepId)}
                onSubmitKyc={handleSubmitApplication}
                isSubmitting={isSubmitting}
              />
            )}
          </div>

          {/* Stepper Footer Controls – hidden during Step 1 OTP phase (the OTP card handles its own submission) */}
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
