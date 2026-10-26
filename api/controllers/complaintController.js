const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");

const complaintRagService = require("../services/complaintRagService");

const { analyzeComplaint } = require("../services/huggingFaceService");


// ============================================================
// GENERATE COMPLAINT ID
// ============================================================

function generateComplaintId() {
    generateComplaintId.counter = (generateComplaintId.counter || 0) + 1;
    const currentYear = new Date().getFullYear();
    return `CMP-${currentYear}-${String(generateComplaintId.counter).padStart(5, "0")}`;
}

// ============================================================
// POLICY NUMBER HELPERS
// ============================================================

// "  pol-2026-00006 " -> "POL-2026-00006"
function normalizePolicyNumber(value) {
    return String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

/*
 * Finds the policy the customer typed.
 *
 * Returns null when there is no match. When the customer is logged in
 * the policy must belong to them, so a complaint can't be attached to
 * somebody else's policy by typing their number.
 */
async function findPolicyId(connection, policyNumber, customerId) {

    if (!policyNumber) {
        return null;
    }

    let sql = `
        SELECT POLICY_ID
        FROM POLICY
        WHERE UPPER(POLICY_NUMBER) = :policyNumber
    `;

    const binds = { policyNumber };

    const numericCustomerId = Number(customerId);

    if (
        customerId !== null &&
        customerId !== undefined &&
        customerId !== "" &&
        Number.isFinite(numericCustomerId)
    ) {
        sql += ` AND CUSTOMER_ID = :customerId`;
        binds.customerId = numericCustomerId;
    }

    const result = await connection.execute(
        sql,
        binds,
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return result.rows.length > 0
        ? result.rows[0].POLICY_ID
        : null;
}


// ============================================================
// CUSTOMER MESSAGES
// ============================================================

// CALLBACK MESSAGE (NON-STP)
function getCallbackMessage(language) {

    return language === "ar"

        ? "شكراً لتسجيل شكواك. لم نتمكن من العثور على حل فوري لهذه المشكلة. سيتصل بك أحد وكلائنا للمساعدة."

        : "Thank you for registering your complaint. We couldn't find an immediate solution for this issue. Our support agent will call you back to assist you.";
}

/*
 * The customer needs the complaint ID to check the status later, so it
 * is added to the reply. If the policy number didn't match a policy, say
 * so - the number they typed is still saved for the agent to verify.
 */
function withReference(message, complaintId, policyFound, language) {

    const idLine =
        language === "ar"
            ? `رقم شكواك هو ${complaintId}. يمكنك استخدامه لمتابعة حالة الشكوى.`
            : `Your complaint ID is ${complaintId}. You can use it to check the status of your complaint.`;

    const policyLine =
        policyFound
            ? ""
            : language === "ar"
                ? " ملاحظة: لم نتمكن من مطابقة رقم البوليصة الذي أدخلته، وسيقوم فريقنا بالتحقق منه."
                : " Note: we couldn't match the policy number you entered, so our team will verify it.";

    return `${message} ${idLine}${policyLine}`;
}


// ============================================================
// REGISTER COMPLAINT
// ============================================================

async function registerComplaint(req, res) {

    let connection;

    try {

        const {
            customerId,
            subject,
            fullName,
            email,
            mobile,
            product,
            policyNumber,
            message,
            language = "en"
        } = req.body;


        // ====================================================
        // LOG REQUEST
        // ====================================================

        console.log("");
        console.log("========================================");
        console.log("COMPLAINT REQUEST");
        console.log("========================================");
        console.log(req.body);


        // ====================================================
        // VALIDATION
        // ====================================================

        if (!subject || !message) {

            return res.status(400).json({

                success: false,

                message:
                    "Subject and complaint description are required."

            });
        }


        // ====================================================
        // CREATE COMPLETE COMPLAINT TEXT
        // ====================================================

        const complaintText = `
            Subject: ${subject}
            Product: ${product || ""}
            Policy Number: ${policyNumber || ""}
            Complaint: ${message}
        `.trim();


        console.log("");
        console.log("========================================");
        console.log("COMPLAINT TEXT");
        console.log("========================================");

        console.log(
            complaintText
        );


        // ====================================================
        // STEP 1
        // AI DECIDES STP / NON-STP
        // ====================================================

        console.log("");
        console.log("========================================");
        console.log("STEP 1: AI COMPLAINT ANALYSIS");
        console.log("========================================");


        const aiDecision =
            await analyzeComplaint(
                complaintText
            );


        console.log("");
        console.log("========================================");
        console.log("AI DECISION");
        console.log("========================================");

        console.log(
            "Route:",
            aiDecision?.route
        );

        console.log(
            "Reason:",
            aiDecision?.reason
        );


        // ====================================================
        // VALIDATE AI ROUTE
        // ====================================================

        const route =
            aiDecision?.route === "STP"
                ? "STP"
                : "NON_STP";


        const reason =
            aiDecision?.reason ||
            "Complaint analyzed by AI.";


        // ====================================================
        // STEP 2
        // SAVE COMPLAINT IN DATABASE
        // ====================================================

        console.log("");
        console.log("========================================");
        console.log("STEP 2: SAVE COMPLAINT");
        console.log("========================================");


        connection =
            await getConnection();


        // ----------------------------------------------------
        // FIND THE POLICY
        // ----------------------------------------------------

        const typedPolicyNumber =
            normalizePolicyNumber(policyNumber);

        const policyId =
            await findPolicyId(
                connection,
                typedPolicyNumber,
                customerId
            );

        const policyFound = policyId !== null;

        console.log("Policy number typed:", policyNumber);
        console.log("Policy number normalized:", typedPolicyNumber);
        console.log("Policy ID:", policyId);


        // ----------------------------------------------------
        // INSERT
        //
        // COMPLAINT_ID is a text column now (CMP-...), so it must be
        // supplied here - the database no longer fills it in. A
        // collision on the primary key (ORA-00001) is retried with a
        // new id.
        // ----------------------------------------------------

        const initialStatus =
            route === "NON_STP"
                ? "OPEN"
                : "RESOLVED";

        let complaintId;

        for (let attempt = 1; attempt <= 3; attempt++) {

            complaintId =
                generateComplaintId();

            try {

                await connection.execute(
                    `
                    INSERT INTO COMPLAINTS (
                        COMPLAINT_ID,
                        CUSTOMER_ID,
                        SUBJECT,
                        FULL_NAME,
                        EMAIL,
                        MOBILE,
                        PRODUCT,
                        POLICY_ID,
                        POLICY_NUMBER,
                        COMPLAINT_MESSAGE,
                        ROUTE,
                        STATUS,
                        AI_REASON,
                        CREATED_AT,
                        UPDATED_AT
                    )
                    VALUES (
                        :complaintId,
                        :customerId,
                        :subject,
                        :fullName,
                        :email,
                        :mobile,
                        :product,
                        :policyId,
                        :policyNumber,
                        :complaintMessage,
                        :route,
                        :status,
                        :aiReason,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    `,
                    {
                        complaintId,
                        customerId:
                            customerId !== null && customerId !== undefined && customerId !== ""
                                ? String(customerId)
                                : null,
                        subject,
                        fullName: fullName || null,
                        email: email || null,
                        mobile: mobile || null,
                        product: product || null,
                        policyId,
                        policyNumber: typedPolicyNumber || null,
                        complaintMessage: message,
                        route,
                        status: initialStatus,
                        aiReason: reason
                    },
                    {
                        autoCommit: true
                    }
                );

                break;

            } catch (insertError) {

                if (insertError.errorNum === 1 && attempt < 3) {

                    console.warn(
                        "Complaint ID collision, retrying with a new ID:",
                        complaintId
                    );

                    continue;
                }

                throw insertError;
            }
        }


        console.log(
            "Complaint ID:",
            complaintId
        );

        console.log(
            "Route saved:",
            route
        );

        console.log(
            "Status saved:",
            initialStatus
        );


        // ====================================================
        // STEP 3
        // NON-STP
        //
        // Do NOT call RAG.
        // ====================================================

        if (route === "NON_STP") {

            console.log("");
            console.log("========================================");
            console.log("FINAL ROUTE: NON_STP");
            console.log("========================================");


            return res.status(200).json({

                success: true,

                complaintFound: false,

                complaintId,

                policyFound,

                route: "NON_STP",

                reason,

                status: "OPEN",

                message:
                    withReference(
                        getCallbackMessage(language),
                        complaintId,
                        policyFound,
                        language
                    )

            });
        }


        // ====================================================
        // STEP 4
        // STP
        //
        // Now use RAG.
        // ====================================================

        if (route === "STP") {

            console.log("");
            console.log("========================================");
            console.log("STEP 3: STP -> SEARCH RAG");
            console.log("========================================");


            const ragResult =
                await complaintRagService.searchComplaint(
                    complaintText
                );


            console.log("");
            console.log("========================================");
            console.log("RAG RESULT");
            console.log("========================================");

            console.log(
                ragResult
            );


            // =================================================
            // STP BUT RAG DID NOT FIND RESOLUTION
            // =================================================

            if (
                !ragResult ||
                ragResult.found !== true
            ) {

                console.log("");
                console.log("========================================");
                console.log("AI SAID STP BUT RAG NOT FOUND");
                console.log("========================================");


                // Complaint cannot actually be resolved
                // automatically, so move it to NON_STP.

                await connection.execute(
                    `
                    UPDATE COMPLAINTS
                    SET
                        ROUTE = 'NON_STP',
                        STATUS = 'OPEN',
                        AI_REASON = :reason,
                        UPDATED_AT = CURRENT_TIMESTAMP
                    WHERE COMPLAINT_ID = :complaintId
                    `,
                    {
                        reason:
                            "Complaint was identified as STP, but no matching knowledge-base resolution was found.",

                        complaintId
                    },
                    {
                        autoCommit: true
                    }
                );


                return res.status(200).json({

                    success: true,

                    complaintFound: false,

                    complaintId,

                    policyFound,

                    route: "NON_STP",

                    reason:
                        "The complaint was identified as potentially STP, but no matching knowledge-base resolution was found.",

                    status: "OPEN",

                    message:
                        withReference(
                            getCallbackMessage(language),
                            complaintId,
                            policyFound,
                            language
                        )

                });
            }


            // =================================================
            // STP + RAG FOUND
            // =================================================

            console.log("");
            console.log("========================================");
            console.log("FINAL ROUTE: STP");
            console.log("========================================");


            return res.status(200).json({

                success: true,

                complaintFound: true,

                complaintId,

                policyFound,

                route: "STP",

                reason,

                status: "RESOLVED",

                message:
                    withReference(
                        ragResult.resolution,
                        complaintId,
                        policyFound,
                        language
                    ),

                knowledgeBase: {

                    complaintId:
                        ragResult.complaintId,

                    title:
                        ragResult.title

                }

            });
        }


        // ====================================================
        // SAFETY FALLBACK
        // ====================================================

        return res.status(200).json({

            success: true,

            complaintFound: false,

            complaintId,

            policyFound,

            route: "NON_STP",

            reason:
                "Complaint route could not be determined.",

            status: "OPEN",

            message:
                withReference(
                    getCallbackMessage(language),
                    complaintId,
                    policyFound,
                    language
                )

        });


    } catch (error) {

        // ====================================================
        // ERROR HANDLING
        // ====================================================

        console.error("");
        console.error(
            "========================================"
        );

        console.error(
            "COMPLAINT CONTROLLER ERROR"
        );

        console.error(
            "========================================"
        );

        console.error(
            error
        );


        if (connection) {

            try {

                await connection.rollback();

            } catch (rollbackError) {

                console.error(
                    "Rollback Error:",
                    rollbackError.message
                );
            }
        }


        return res.status(500).json({

            success: false,

            message:
                "We are unable to process your complaint right now. Our support agent will call you back to assist you."

        });

    } finally {

        // ====================================================
        // CLOSE DB CONNECTION
        // ====================================================

        if (connection) {

            try {

                await connection.close();

            } catch (closeError) {

                console.error(
                    "Connection Close Error:",
                    closeError.message
                );
            }
        }
    }
}
// ============================================================
// GET COMPLAINT STATUS
// ============================================================

async function getComplaintStatus(req, res) {

    let connection;

    try {

        // Status can change anytime, so don't let the browser cache it
        res.set("Cache-Control", "no-store, no-cache, must-revalidate");

        const complaintId = (req.params.complaintId || "").trim();

        if (!complaintId) {
            return res.status(400).json({
                success: false,
                message: "Complaint ID is required."
            });
        }

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT COMPLAINT_ID,
                   SUBJECT,
                   PRODUCT,
                   ROUTE,
                   STATUS,
                   CREATED_AT,
                   UPDATED_AT
            FROM COMPLAINTS
            WHERE UPPER(COMPLAINT_ID) = UPPER(:complaintId)
            `,
            { complaintId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No complaint found for this complaint ID."
            });
        }

        const c = result.rows[0];

        return res.status(200).json({
            success: true,
            data: {
                complaintId: c.COMPLAINT_ID,
                subject: c.SUBJECT,
                product: c.PRODUCT,
                route: c.ROUTE,
                status: c.STATUS,
                createdAt: c.CREATED_AT,
                updatedAt: c.UPDATED_AT
            }
        });

    } catch (error) {

        console.error("Get Complaint Status Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch complaint status."
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error("Connection Close Error:", closeError.message);
            }
        }
    }
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {

    registerComplaint,
    getComplaintStatus

};