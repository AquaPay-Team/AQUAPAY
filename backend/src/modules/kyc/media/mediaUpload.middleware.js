import multer from "multer";
import { fileTypeFromBuffer } from "file-type";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error("Unsupported file type.");
    error.statusCode = 400;
    error.code = "INVALID_FILE_TYPE";

    return callback(error);
  }

  callback(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter,
});

const multerUpload = upload.single("file");

const uploadSingleMedia = (req, res, next) => {
  multerUpload(req, res, async (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          error.statusCode = 413;
          error.message = "File size exceeds the 20 MB limit.";
          error.code = "FILE_TOO_LARGE";
        } else {
          error.statusCode = 400;
          error.message = "Invalid file upload request.";
          error.code = "INVALID_FILE_UPLOAD";
        }
      }

      return next(error);
    }

    if (!req.file) {
      const missingFileError = new Error("No file was uploaded.");
      missingFileError.statusCode = 400;
      missingFileError.code = "FILE_REQUIRED";

      return next(missingFileError);
    }

    try {
      // Detect the actual file format using its binary signature
      const detectedType = await fileTypeFromBuffer(req.file.buffer);

      if (
        !detectedType ||
        !ALLOWED_MIME_TYPES.includes(detectedType.mime) ||
        detectedType.mime !== req.file.mimetype
      ) {
        const invalidFileError = new Error(
          "File content does not match an allowed file type.",
        );

        invalidFileError.statusCode = 400;
        invalidFileError.code = "INVALID_FILE_CONTENT";

        return next(invalidFileError);
      }

      // Store verified file information for the service layer
      req.file.detectedMimeType = detectedType.mime;
      req.file.detectedExtension = detectedType.ext;

      next();
    } catch (validationError) {
      next(validationError);
    }
  });
};

export { uploadSingleMedia };
export default uploadSingleMedia;
