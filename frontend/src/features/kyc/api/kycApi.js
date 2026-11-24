import api from "@/api/axios";

// Status
export const getKycStatus = async () => {
  const response = await api.get("/kyc/status");
  return response.data;
};

// Step 1: Basic Details
export const saveBasicDetails = async (data) => {
  const response = await api.put("/kyc/basic-details", data);
  return response.data;
};

export const requestBasicDetailsOtp = async () => {
  const response = await api.post("/kyc/basic-details/request-otp", {});
  return response.data;
};

export const verifyBasicDetailsOtp = async (otp) => {
  const response = await api.post("/kyc/basic-details/verify-otp", { otp });
  return response.data;
};

// Step 2 & 3: Aadhaar / PAN Verification
export const initiateAadhaarVerification = async (consent = true) => {
  const response = await api.post("/kyc/digilocker/aadhaar/initiate", {
    consent,
  });
  return response.data;
};

export const getAadhaarVerificationStatus = async (sessionId) => {
  const params = sessionId ? { sessionId } : {};
  const response = await api.get("/kyc/digilocker/aadhaar/status", { params });
  return response.data;
};

export const verifyPanDetails = async (payload = {}) => {
  const panNumber = (payload.panNumber || payload.pan || "").trim().toUpperCase();
  const consent = payload.consent !== undefined ? payload.consent : true;
  const response = await api.post(
    "/kyc/pan/verify",
    { panNumber, consent },
    { timeout: 180000 }
  );
  return response.data;
};

export const initiatePanVerification = async (consent = true) => {
  const response = await api.post(
    "/kyc/digilocker/pan/initiate",
    { consent },
    { timeout: 180000 }
  );
  return response.data;
};

// Step 4: Bank Details
export const saveBankDetails = async (bankData) => {
  const response = await api.put("/kyc/bank-details", bankData);
  return response.data;
};

export const getBankDetails = async () => {
  const response = await api.get("/kyc/bank-details");
  return response.data;
};

// Merchant rejected-KYC restart (authenticated account only).
export const restartRejectedKyc = async () => {
  const response = await api.post("/kyc/media/restart", {});
  return response.data;
};

// Step 5: Media Uploads
export const uploadKycMedia = async (file, assetType) => {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("assetType", assetType);

  const response = await api.post("/kyc/media/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 180000,
  });

  return response.data;
};

// Restore individually uploaded media after a reload (no asset URLs).
export const getMediaUploadStatus = async () => {
  const response = await api.get("/kyc/media/status");
  return response.data;
};

// Step 6: Agreements
export const getAgreementDetails = async () => {
  const response = await api.get("/kyc/agreement");
  return response.data;
};

export const acceptAgreement = async ({
  accepted = true,
  agreementCode,
  agreementVersion,
} = {}) => {
  const payload = { accepted };
  if (agreementCode) payload.agreementCode = agreementCode;
  if (agreementVersion) payload.agreementVersion = agreementVersion;

  const response = await api.post("/kyc/agreement/accept", payload);
  return response.data;
};

// Step 7: Final Submission
export const getSubmissionStatus = async () => {
  const response = await api.get("/kyc/submission-status");
  return response.data;
};

export const submitKycApplication = async ({
  confirm = true,
  notes = "",
} = {}) => {
  const response = await api.post("/kyc/submit", { confirm, notes });
  return response.data;
};
