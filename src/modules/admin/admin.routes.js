const { verifyAdminSetupKey } = require("./adminSetup.middleware");
const router =require("express").Router();
const{
    validateAdminInput,
    createAdminController

} = require("./admin.controller");

router.post(
    "/create",
    verifyAdminSetupKey,
    validateAdminInput,
    createAdminController
);
module.exports = router;
