const multer = require('multer');
const { ApiError } = require('./errorHandler');

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_MIMES = [...IMAGE_MIMES, 'application/pdf'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function uploader(allowedMimes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => {
      if (allowedMimes.includes(file.mimetype)) return cb(null, true);
      return cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
    },
  });
}

module.exports = {
  uploadImage: uploader(IMAGE_MIMES).single('file'),
  uploadDocument: uploader(DOCUMENT_MIMES).single('file'),
};
