const {
    getPolicyByNumberAdmin,
    submitClaim,
    getPendingClaims,
    decideClaim,
    getClaimByNumber
} = require("../services/Claimservice");


// ======================================================
// LOOK UP A POLICY FOR THE UNDERWRITER CLAIM FORM
// ======================================================
//
// Unscoped by design (see claimService.js) - only reachable
// from the underwriter-side claim form, never from the
// customer-facing chat.
// ======================================================

async function lookupPolicyForClaim(req, res) {
    try {
        const { policyNumber } = req.params;

        if (!policyNumber) {
            return res.status(400).json({
                success: false,
                message: "policyNumber is required"
            });
        }

        const policy = await getPolicyByNumberAdmin(policyNumber);

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: "No policy found with that number"
            });
        }

        return res.status(200).json({
            success: true,
            data: policy
        });

    } catch (err) {
        console.error("Lookup Policy For Claim Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to look up policy"
        });
    }
}


// ======================================================
// FILE A CLAIM
// ======================================================

async function fileClaim(req, res) {
    try {
        const {
            policyNumber,
            incidentDate,
            description,
            claimAmount
        } = req.body;

        if (!policyNumber || !claimAmount) {
            return res.status(400).json({
                success: false,
                message: "policyNumber and claimAmount are required"
            });
        }

        // multer (see routes) puts the uploaded file on req.file
        const imagePath =
            req.file ? `/uploads/claims/${req.file.filename}` : null;

        const claim = await submitClaim({
            policyNumber,
            incidentDate,
            description,
            claimAmount,
            imagePath
        });

        return res.status(201).json({
            success: true,
            data: claim
        });

    } catch (err) {
        console.error("File Claim Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
}


// ======================================================
// UNDERWRITER: PENDING CLAIMS
// ======================================================

async function listPendingClaims(req, res) {
    try {
        const claims = await getPendingClaims();

        return res.status(200).json({
            success: true,
            data: claims.map(c => ({
                claimId: c.CLAIM_ID,
                claimNumber: c.CLAIM_NUMBER,
                policyNumber: c.POLICY_NUMBER,
                customerName: c.CUSTOMER_NAME,
                productName: c.PRODUCT_NAME,
                incidentDate: c.INCIDENT_DATE,
                description: c.DESCRIPTION,
                claimAmount: c.CLAIM_AMOUNT,
                imagePath: c.IMAGE_PATH,
                status: c.CLAIM_STATUS,
                submittedAt: c.SUBMITTED_AT
            }))
        });

    } catch (err) {
        console.error("List Pending Claims Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch claims"
        });
    }
}


// ======================================================
// UNDERWRITER: DECIDE A CLAIM
// ======================================================

async function decideClaimController(req, res) {
    try {
        const { claimId } = req.params;
        const { decision, note, approvedAmount } = req.body;

        if (!["APPROVED", "DECLINED"].includes(decision)) {
            return res.status(400).json({
                success: false,
                message: "Invalid decision value"
            });
        }

        const result = await decideClaim(
            claimId,
            decision,
            note,
            approvedAmount
        );

        return res.status(200).json({ success: true, data: result });

    } catch (err) {
        console.error("Decide Claim Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update claim"
        });
    }
}


// ======================================================
// CUSTOMER-FACING: GET CLAIM STATUS
// ======================================================
//
// customerId MUST come from the authenticated session, never
// from the request body/params, or this scoping is worthless.
// ======================================================

async function getClaimStatus(req, res) {
    try {
        const { claimNumber } = req.params;
        const { customerId } = req.query;

        if (!customerId) {
            return res.status(401).json({
                success: false,
                message: "Login required"
            });
        }

        const claim = await getClaimByNumber(claimNumber, customerId);

        if (!claim) {
            return res.status(404).json({
                success: false,
                message: "No claim found with that number for this customer"
            });
        }

        return res.status(200).json({ success: true, data: claim });

    } catch (err) {
        console.error("Get Claim Status Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch claim status"
        });
    }
}


module.exports = {
    lookupPolicyForClaim,
    fileClaim,
    listPendingClaims,
    decideClaimController,
    getClaimStatus
};