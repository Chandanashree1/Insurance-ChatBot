const { createPolicyFromQuote, getCustomerPolicies, getPolicyByNumber } = require("../services/policyService");


// ======================================================
// CREATE POLICY
// ======================================================

async function createPolicy(req, res) {

    try {

        const {
            quoteId
        } = req.body;


        if (!quoteId) {

            return res.status(400).json({

                success: false,

                message:
                    "Quote ID is required"

            });

        }


        const result =
            await createPolicyFromQuote(
                quoteId
            );


        return res.status(201).json({

            success: true,

            message:
                "Policy created successfully",

            data: result

        });

    }


    catch (error) {

        console.error(
            "Policy Controller Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

}
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

        console.error(
            "Get Customer Policies Error:",
            err
        );

        return res.status(500).json({

            success: false,

            message: "Failed to fetch customer policies",

            error: err.message,

            errorCode: err.errorNum || null

        });

    }

};


/*
    GET /api/policies/:policyNumber

    Example:
    GET http://localhost:5000/api/policies/POL-2026-00001
*/

const getPolicy = async (req, res) => {

    try {

        const { policyNumber } = req.params;

        if (!policyNumber) {

            return res.status(400).json({

                success: false,

                message: "Policy number is required"

            });

        }

        const policy =
            await getPolicyByNumber(policyNumber);


        if (!policy) {

            return res.status(404).json({

                success: false,

                message: "Policy not found"

            });

        }


        return res.status(200).json({

            success: true,

            data: {

                policyId: policy.POLICY_ID,

                policyNumber: policy.POLICY_NUMBER,

                customerId: policy.CUSTOMER_ID,

                policyType: policy.POLICY_TYPE,

                planName: policy.PLAN_NAME,

                premium: policy.PREMIUM,

                sumInsured: policy.SUM_INSURED,

                startDate: policy.START_DATE,

                endDate: policy.END_DATE,

                status: policy.STATUS

            }

        });

    } catch (err) {

        console.error(
            "Get Policy Error:",
            err
        );

        return res.status(500).json({

            success: false,

            message: "Failed to fetch policy",

            error: err.message,

            errorCode: err.errorNum || null

        });

    }

};



module.exports = { createPolicy, getPoliciesByCustomer, getPolicy };