const { createPolicyFromQuote, getCustomerPolicies, getPolicyByNumber } = require("../services/policyService");
const PDFDocument = require('pdfkit');


// ======================================================
// CREATE POLICY
// ======================================================

async function createPolicy(req, res) {
    try {
        const { quoteId } = req.body;

        if (!quoteId) {
            return res.status(400).json({
                success: false,
                message: "Quote ID is required"
            });
        }

        const result = await createPolicyFromQuote(quoteId);

        return res.status(201).json({
            success: true,
            message: "Policy created successfully",
            data: result
        });

    } catch (error) {
        console.error("Policy Controller Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}


// ======================================================
// GET CUSTOMER POLICIES
// ======================================================

const getPoliciesByCustomer = async (req, res) => {
    try {
        const { customerId } = req.params;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Customer ID is required"
            });
        }

        const policies = await getCustomerPolicies(customerId);

        return res.status(200).json({
            success: true,
            count: policies.length,
            data: policies.map(policy => ({
                policyId: policy.POLICY_ID,
                policyNumber: policy.POLICY_NUMBER,
                quoteId: policy.QUOTE_ID,
                customerId: policy.CUSTOMER_ID,
                vehicleId: policy.VEHICLE_ID,
                policyType: policy.PRODUCT_TYPE,
                productName: policy.PRODUCT_NAME,
                planName: policy.PLAN_NAME,
                premium: policy.PREMIUM,
                sumInsured: policy.SUM_INSURED,
                coverFrom: policy.COVER_FROM,
                coverTo: policy.COVER_TO,
                status: policy.POLICY_STATUS
            }))
        });

    } catch (err) {
        console.error("Get Customer Policies Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch customer policies",
            error: err.message,
            errorCode: err.errorNum || null
        });
    }
};


// ======================================================
// GET SINGLE POLICY
// GET /api/policies/:policyNumber
// ======================================================

const getPolicy = async (req, res) => {
    try {
        const { policyNumber } = req.params;

        if (!policyNumber) {
            return res.status(400).json({
                success: false,
                message: "Policy number is required"
            });
        }

        const policy = await getPolicyByNumber(policyNumber);

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: "Policy not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: mapPolicyRow(policy)
        });

    } catch (err) {
        console.error("Get Policy Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch policy",
            error: err.message,
            errorCode: err.errorNum || null
        });
    }
};


// ======================================================
// DOWNLOAD POLICY DOCUMENT (PDF)
// GET /api/policies/:policyNumber/document
// ======================================================

const downloadPolicyDocument = async (req, res) => {
    try {
        const { policyNumber } = req.params;

        if (!policyNumber) {
            return res.status(400).json({
                success: false,
                message: "Policy number is required"
            });
        }

        const policyRow = await getPolicyByNumber(policyNumber);

        if (!policyRow) {
            return res.status(404).json({
                success: false,
                message: "Policy not found"
            });
        }

        const policy = mapPolicyRow(policyRow);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Policy-${policyNumber}.pdf`);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        doc.pipe(res);

        generatePolicyPdf(doc, policy);

        doc.end();

    } catch (err) {
        console.error("PDF generation failed:", err);
        res.status(500).json({
            success: false,
            message: "Failed to generate policy document"
        });
    }
};


// ======================================================
// helpers
// ======================================================

function mapPolicyRow(policy) {
    return {
        policyId: policy.POLICY_ID,
        policyNumber: policy.POLICY_NUMBER,
        quoteId: policy.QUOTE_ID,
        customerId: policy.CUSTOMER_ID,
        vehicleId: policy.VEHICLE_ID,
        policyType: policy.PRODUCT_TYPE,
        productName: policy.PRODUCT_NAME,
        planName: policy.PLAN_NAME,
        premium: policy.PREMIUM,
        sumInsured: policy.SUM_INSURED,
        coverFrom: policy.COVER_FROM,
        coverTo: policy.COVER_TO,
        status: policy.POLICY_STATUS
    };
}

function generatePolicyPdf(doc, policy) {
    const primaryColor = '#111827';
    const grey = '#6b7280';

    doc
        .fillColor(primaryColor)
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('Motor Insurance Policy', { align: 'center' });

    doc
        .fillColor(grey)
        .fontSize(11)
        .font('Helvetica')
        .text(`Policy No: ${policy.policyNumber}`, { align: 'center' });

    doc.moveDown(2);

    sectionHeader(doc, 'Policy Details', primaryColor);
    row(doc, 'Product', policy.productName);
    row(doc, 'Plan', policy.planName);
    row(doc, 'Policy Type', policy.policyType);
    row(doc, 'Status', policy.status);
    doc.moveDown();

    sectionHeader(doc, 'Coverage', primaryColor);
    row(doc, 'Cover From', formatDate(policy.coverFrom));
    row(doc, 'Cover To', formatDate(policy.coverTo));
    row(doc, 'Sum Insured', policy.sumInsured ? `OMR ${policy.sumInsured}` : '-');
    doc.moveDown();

    sectionHeader(doc, 'Premium', primaryColor);
    row(doc, 'Total Premium', `OMR ${Number(policy.premium || 0).toFixed(2)}`, true);
    doc.moveDown(2);

    doc
        .fillColor(grey)
        .fontSize(9)
        .text(
            'This document is system-generated and does not require a signature. For queries, contact Dhofar Insurance customer support.',
            { align: 'center' }
        );
}

function sectionHeader(doc, title, color) {
    doc.fillColor(color).fontSize(13).font('Helvetica-Bold').text(title);
    doc.moveDown(0.3);
}

function row(doc, label, value, bold = false) {
    doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10)
        .fillColor('#111827')
        .text(`${label}:`, { continued: true, width: 200 })
        .fillColor(bold ? '#111827' : '#374151')
        .text(`  ${value ?? '-'}`);
}

function formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB');
}


module.exports = { createPolicy, getPoliciesByCustomer, getPolicy, downloadPolicyDocument };