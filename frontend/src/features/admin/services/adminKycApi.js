import api from "../../../api/axios";

const root = "/admin/kyc";

export async function listAdminKycApplications(params = {}) {
  const { data } = await api.get(root, { params });
  return data.data;
}

export async function getAdminKycDetails(caseId) {
  const { data } = await api.get(`${root}/${caseId}`);
  return data.data;
}

export async function getAdminKycDetailsByUserId(userId) {
  const { data } = await api.get(`${root}/user/${userId}`);
  return data.data;
}

export async function getAdminKycDocument(caseId, assetId) {
  const { data } = await api.get(`${root}/${caseId}/documents/${assetId}`);
  return data.data;
}

export async function approveAdminKyc(caseId) {
  const { data } = await api.patch(`${root}/${caseId}/approve`);
  return data.data;
}

export async function rejectAdminKyc(caseId, rejectionReason) {
  const { data } = await api.patch(`${root}/${caseId}/reject`, { rejectionReason });
  return data.data;
}
