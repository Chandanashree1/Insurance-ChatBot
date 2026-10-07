const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const {
    lookupPolicyForClaim,
    fileClaim,
    listPendingClaims,
    decideClaimController,
    getClaimStatus
} = require("../controllers/Claimcontroller");


// ======================================================
// FILE UPLOAD (CLAIM PHOTO)
// ======================================================
//
// Stored on disk, only the relative path is saved to the DB.
// Served statically - see the note in the final message about
// mounting /uploads in server.js.
// ======================================================

const uploadDir = path.join(__dirname, "..", "uploads", "claims");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed"));
        }
        cb(null, true);
    }
});


// ======================================================
// UNDERWRITER-SIDE (claim filing)
// ======================================================

router.get("/claims/policy/:policyNumber", lookupPolicyForClaim);
router.post("/claims", upload.single("image"), fileClaim);

router.get("/claims/pending", listPendingClaims);
router.patch("/claims/:claimId/decision", decideClaimController);


// ======================================================
// CUSTOMER-SIDE (status lookup)
// ======================================================

router.get("/claims/number/:claimNumber", getClaimStatus);


module.exports = router;