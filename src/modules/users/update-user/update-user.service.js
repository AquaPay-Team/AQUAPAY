
import userModel from "../user.model.js";
import updateUserModel from "./update-user.model.js";
import ApiError from "../../../utils/ApiError.js";

async function updateUserDetails(actorId, targetId, body) {
  const actor = await userModel.findUserForAuth(actorId);

  if (!actor || actor.role_slug !== "AD") {
    throw new ApiError(403, "Only Admin can update users");
  }

  const target = await userModel.findUserSafeById(targetId);

  if (!target) {
    throw new ApiError(404, "User not found");
  }

  const allowedFields = [
    "name",
    "email",
    "mobile",
    "address",
    "state",
    "city",
    "pincode"
  ];

  const data = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  if (Object.keys(data).length === 0) {
    throw new ApiError(400, "No valid fields provided");
  }

  await updateUserModel.updateUser(targetId, data);

  return await userModel.findUserSafeById(targetId);
}

export default { updateUserDetails };
