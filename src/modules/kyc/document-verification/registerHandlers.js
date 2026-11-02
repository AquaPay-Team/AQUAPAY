import digilockerService from "./digilocker/digilocker.service.js";
import aadhaarService from "./aadhaar/aadhaar.service.js";
import panService from "./pan/pan.service.js";

// Importing these service modules triggers their handler registration
// with the DigiLocker service. This is made explicit here instead of
// relying on side-effect imports inside route files.
void digilockerService;
void aadhaarService;
void panService;

export { digilockerService };
