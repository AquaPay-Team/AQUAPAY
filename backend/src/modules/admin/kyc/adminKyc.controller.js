
import adminKycService from "./adminKyc.service.js";

/**
 * GET /api/admin/kyc
 * Fetch KYC applications.
 */
async function getKycApplicationsController(req, res, next) {
  try {
    const { status, page, limit } = req.query;

    const result = await adminKycService.getKycApplications({
      status,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: "KYC applications fetched successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/kyc/:caseId
 * Fetch complete details of one KYC application.
 */
async function getKycApplicationDetailsController(req, res, next) {
  try {
    const { caseId } = req.params;

    const result =
      await adminKycService.getKycApplicationDetails(caseId);

    return res.status(200).json({
      success: true,
      message: "KYC application details fetched successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/kyc/:caseId/documents/:assetId
 * Generate temporary secure access to a KYC document.
 */
async function getKycDocumentAccessController(req, res, next) {
  try {
    const { caseId, assetId } = req.params;

    const result = await adminKycService.getKycDocumentAccess(
      caseId,
      assetId,
    );

    return res.status(200).json({
      success: true,
      message: "KYC document access generated successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

const adminKycController = {
  getKycApplicationsController,
  getKycApplicationDetailsController,
  getKycDocumentAccessController,
};

export {
  getKycApplicationsController,
  getKycApplicationDetailsController,
  getKycDocumentAccessController,
};

export default adminKycController;
