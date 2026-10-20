
import updateUserService from "./update-user.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

const updateUser = asyncHandler(async (req, res) => {
  const result = await updateUserService.updateUserDetails(
    req.user.id,
    req.params.id,
    req.body
  );

  res.status(200).json(
    new ApiResponse(200, result, "User updated successfully")
  );
});

export default { updateUser };
