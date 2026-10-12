const oracledb = require("oracledb");
const { getConnection } = require("../config/oracle");

const complaintRagService = require("../services/complaintRagService");

const { analyzeComplaint } = require("../services/huggingFaceService");


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


        const policyResult = await connection.execute(
            `
                SELECT POLICY_ID
                FROM POLICY
                WHERE POLICY_NUMBER = :policyNumber
                `,
            {
                policyNumber: policyNumber || null
            },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        const policyId =
            policyResult.rows.length > 0
                ? policyResult.rows[0].POLICY_ID
                : null;

        console.log("Policy Number:", policyNumber);
        console.log("Policy ID:", policyId);

        const insertResult = await connection.execute(
    `
    INSERT INTO COMPLAINTS (
        CUSTOMER_ID,
        SUBJECT,
        FULL_NAME,
        EMAIL,
        MOBILE,
        PRODUCT,
        POLICY_ID,
        COMPLAINT_MESSAGE,
        ROUTE,
        STATUS,
        AI_REASON,
        CREATED_AT,
        UPDATED_AT
    )
    VALUES (
        :customerId,
        :subject,
        :fullName,
        :email,
        :mobile,
        :product,
        :policyId,
        :complaintMessage,
        :route,
        :status,
        :aiReason,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    RETURNING COMPLAINT_ID INTO :complaintId
    `,
    {
        customerId: customerId || null,
        subject,
        fullName: fullName || null,
        email: email || null,
        mobile: mobile || null,
        product: product || null,

        // IMPORTANT
        policyId: policyId,

        complaintMessage: message,
        route,
        status: route === "NON_STP" ? "OPEN" : "RESOLVED",
        aiReason: reason,

        complaintId: {
            dir: oracledb.BIND_OUT,
            type: oracledb.NUMBER
        }
    },
    {
        autoCommit: true
    }
);

        const complaintId =
            insertResult.outBinds.complaintId[0];



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
            route === "NON_STP"
                ? "OPEN"
                : "RESOLVED"
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


            const callbackMessage =
                language === "ar"

                    ? "شكراً لتسجيل شكواك. لم نتمكن من العثور على حل فوري لهذه المشكلة. سيتصل بك أحد وكلائنا للمساعدة."

                    : "Thank you for registering your complaint. We couldn't find an immediate solution for this issue. Our support agent will call you back to assist you.";


            return res.status(200).json({

                success: true,

                complaintFound: false,

                complaintId,

                route: "NON_STP",

                reason,

                status: "OPEN",

                message:
                    callbackMessage

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


                // Update DB because complaint cannot
                // actually be resolved automatically.

                await connection.execute(

                    `
                    UPDATE COMPLAINT
                    SET
                        ROUTE = 'NON_STP',
                        STATUS = 'OPEN',
                        REASON = :reason
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


                const callbackMessage =
                    language === "ar"

                        ? "شكراً لتسجيل شكواك. لم نتمكن من العثور على حل فوري لهذه المشكلة. سيتصل بك أحد وكلائنا للمساعدة."

                        : "Thank you for registering your complaint. We couldn't find an immediate solution for this issue. Our support agent will call you back to assist you.";


                return res.status(200).json({

                    success: true,

                    complaintFound: false,

                    complaintId,

                    route: "NON_STP",

                    reason:
                        "The complaint was identified as potentially STP, but no matching knowledge-base resolution was found.",

                    status: "OPEN",

                    message:
                        callbackMessage

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

                route: "STP",

                reason,

                status: "RESOLVED",

                message:
                    ragResult.resolution,

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

            route: "NON_STP",

            reason:
                "Complaint route could not be determined.",

            status: "OPEN",

            message:
                language === "ar"

                    ? "شكراً لتسجيل شكواك. لم نتمكن من العثور على حل فوري لهذه المشكلة. سيتصل بك أحد وكلائنا للمساعدة."

                    : "Thank you for registering your complaint. We couldn't find an immediate solution for this issue. Our support agent will call you back to assist you."

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
// EXPORT
// ============================================================

module.exports = {

    registerComplaint

};