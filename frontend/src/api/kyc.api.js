import api from "./axios";

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

// Step 2 & 3: Document Verification (DigiLocker / Aadhaar / PAN)
export const initiateAadhaarVerification = async (consent = true) => {
  const response = await api.post("/kyc/digilocker/aadhaar/initiate", { consent });
  return response.data;
};

export const getAadhaarVerificationStatus = async (sessionId) => {
  const params = sessionId ? { sessionId } : {};
  const response = await api.get("/kyc/digilocker/aadhaar/status", { params });
  return response.data;
};

export const verifyPanDetails = async ({ panNumber, consent = true }) => {
  const response = await api.post("/kyc/pan/verify", { panNumber, consent });
  return response.data;
};

export const initiatePanVerification = async (consent = true) => {
  const response = await api.post("/kyc/digilocker/pan/initiate", { consent });
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

// Step 5: Media Uploads (shop_image, selfie, consent_video)
export const uploadKycMedia = async (file, assetType) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("assetType", assetType);

  const response = await api.post("/kyc/media/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

// Step 6: Agreements
export const getAgreementDetails = async () => {
  const response = await api.get("/kyc/agreement");
  return response.data;
};

export const acceptAgreement = async ({
  accepted = true,
  agreementCode = "AQUAPAY_AGENT_AGREEMENT",
  agreementVersion = "v1.0",
} = {}) => {
  const response = await api.post("/kyc/agreement/accept", {
    accepted,
    agreementCode,
    agreementVersion,
  });
  return response.data;
};

// Step 7: Final Submission
export const getSubmissionStatus = async () => {
  const response = await api.get("/kyc/submission-status");
  return response.data;
};

export const submitKycApplication = async ({ confirm = true, notes = "" } = {}) => {
  const response = await api.post("/kyc/submit", { confirm, notes });
  return response.data;
};

