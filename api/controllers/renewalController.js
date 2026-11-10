const { lookupPolicies, createRenewalQuote, payRenewalQuote } = require("../services/renewalService");

async function lookupRenewal(req, res) {
    try {
        const { customerId, method, plateNumber, plateCode,
                mobileNumber, civilId, policyNumber } = req.body;

        if (!customerId) {
            return res.status(401).json({ success: false, message: "Please log in to renew a policy" });
        }
        if (!plateNumber || !plateCode) {
            return res.status(400).json({ success: false, message: "Plate number and code are required" });
        }
        if (method === "mobile" && !mobileNumber) {
            return res.status(400).json({ success: false, message: "Mobile number is required" });
        }
        if (method === "civil" && !civilId) {
            return res.status(400).json({ success: false, message: "Civil ID is required" });
        }
        if (method === "policy" && !policyNumber) {
            return res.status(400).json({ success: false, message: "Policy number is required" });
        }
        if (!["mobile", "civil", "policy", "plate"].includes(method)) {
            return res.status(400).json({ success: false, message: "Choose how to confirm your details" });
        }

        const policies = await lookupPolicies(
            { customerId, method, plateNumber, plateCode, mobileNumber, civilId, policyNumber }
        );

        if (policies.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No policy was found under your account for those details"
            });
        }

        return res.status(200).json({ success: true, data: { policies } });

    } catch (error) {
        console.error("Renewal Lookup Error:", error);
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
}

async function createRenewal(req, res) {
    try {
        const { customerId, policyId, vehicleValue, mobileNumber } = req.body;

        if (!customerId || !policyId) {
            return res.status(400).json({ success: false, message: "customerId and policyId are required" });
        }

        const result = await createRenewalQuote({ customerId, policyId, vehicleValue, mobileNumber });

        return res.status(201).json({
            success: true,
            message: "Renewal quote generated successfully",
            data: result
        });
    } catch (error) {
        console.error("Renewal Quote Error:", error);
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
}

async function payRenewal(req, res) {
    try {
        const { customerId, quoteId, optionId } = req.body;
        if (!customerId || !quoteId || !optionId) {
            return res.status(400).json({ success: false, message: "customerId, quoteId and optionId are required" });
        }
        const result = await payRenewalQuote({
            customerId, quoteId: Number(quoteId), optionId: Number(optionId)
        });
        return res.status(201).json({ success: true, message: "Policy renewed successfully", data: result });
    } catch (error) {
        console.error("Renewal Pay Error:", error);
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
}

module.exports = { lookupRenewal, createRenewal, payRenewal };