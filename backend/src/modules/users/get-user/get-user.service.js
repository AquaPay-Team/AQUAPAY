
import getUserModel from "./get-user.model.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";
import authorizationService from "../../authorization/authorization.service.js";

const VALID_KYC_STATUSES = new Set([
  "pending",
  "submitted",
  "under_review",
  "approved",
  "verified",
  "rejected",
]);

const ALLOWED_ACCOUNT_STATUSES = new Set(["active", "inactive", "blocked"]);

async function getActor(actorId) {
  const parentId = Number(actorId);

  if (!actorId || !Number.isSafeInteger(parentId) || parentId <= 0) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const actor = await getUserModel.findActorRole(parentId);

  if (!actor) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Active authenticated user not found",
      [],
      "UNAUTHORIZED",
    );
  }

  return actor;
}

function isAdmin(actor) {
  return Number(actor.role_id) === 1 || actor.role_slug === "AD";
}

async function getUsers(actorId, options = {}) {
  const actor = await getActor(actorId);

  const kycStatus = options.kycStatus ? String(options.kycStatus).toLowerCase().trim() : undefined;

  if (
    kycStatus !== undefined &&
    kycStatus !== null &&
    (
      typeof kycStatus !== "string" ||
      !VALID_KYC_STATUSES.has(kycStatus)
    )
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Invalid KYC status",
      [],
      "VALIDATION_ERROR",
    );
  }

  const userOptions = { ...options };

  if (kycStatus) {
    userOptions.kycStatus = kycStatus;
  }

  // Validate pagination parameters if provided
  if (options.page !== undefined) {
    const parsedPage = Number(options.page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Page must be a positive integer", [], "VALIDATION_ERROR");
    }
    userOptions.page = parsedPage;
  }

  if (options.limit !== undefined) {
    const parsedLimit = Number(options.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Limit must be between 1 and 100", [], "VALIDATION_ERROR");
    }
    userOptions.limit = parsedLimit;
  }

  // Validate account status if provided
  if (options.status) {
    const st = String(options.status).toLowerCase().trim();
    if (!ALLOWED_ACCOUNT_STATUSES.has(st)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid account status", [], "VALIDATION_ERROR");
    }
    userOptions.status = st;
  }

  // Search by name, mobile number, email, shop, or ID
  const search = typeof options.search === "string" ? options.search.trim() : "";
  if (search) userOptions.search = search;
  else delete userOptions.search;

  let selectedRoleId;
  if (options.roleId !== undefined && options.roleId !== null && options.roleId !== "") {
    selectedRoleId = Number(options.roleId);
    if (!Number.isSafeInteger(selectedRoleId) || selectedRoleId <= 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid role ID", [], "VALIDATION_ERROR");
    }
    const permitted = await authorizationService.canCreateRole(actor.role_id, selectedRoleId);
    if (!permitted) {
      throw new ApiError(httpStatus.FORBIDDEN, "You are not authorized to view users in this role", [], "FORBIDDEN");
    }
    userOptions.roleId = selectedRoleId;
    return getUserModel.findUsersInDescendantScope(actor.id, selectedRoleId, userOptions);
  }

  if (isAdmin(actor)) {
    return getUserModel.findAllUsers(userOptions);
  }

  return getUserModel.findChildrenByParentId(
    actor.id,
    userOptions,
  );
}

async function getUserById(actorId, userId) {
  const actor = await getActor(actorId);

  const childId = Number(userId);

  if (!userId || !Number.isSafeInteger(childId) || childId <= 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Invalid user ID",
      [],
      "VALIDATION_ERROR",
    );
  }

  if (isAdmin(actor)) {
    const user = await getUserModel.findUserById(childId);

    if (!user) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "User not found",
        [],
        "NOT_FOUND",
      );
    }

    return user;
  }

  const child = await getUserModel.findDescendantUserById(
    childId,
    actor.id,
  );

  if (!child) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Child user not found or not created by you",
      [],
      "NOT_FOUND",
    );
  }

  const rolePermitted = await authorizationService.canCreateRole(actor.role_id, child.role_id);
  if (!rolePermitted) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "User not found or outside your authorized hierarchy",
      [],
      "NOT_FOUND",
    );
  }

  return child;
}

async function getDescendantRoles(actorId) {
  const actor = await getActor(actorId);
  return getUserModel.findDescendantRoles(actor.id);
}

async function getUserStats(actorId) {
  const actor = await getActor(actorId);
  return getUserModel.getUserStats(actor.id, isAdmin(actor));
}

const getUserService = {
  getUsers,
  getUserById,
  getDescendantRoles,
  getUserStats,
};

export { getUsers, getUserById, getDescendantRoles, getUserStats };

export default getUserService;
