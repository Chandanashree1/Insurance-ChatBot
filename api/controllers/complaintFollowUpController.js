const complaintFollowUpService = require("../services/complaintFollowUpService");
const { getConnection } = require("../config/oracle");

// ============================================================
// GET NON-STP COMPLAINTS
// ============================================================

async function getNonStpComplaints(req, res) {

    try {

        const complaints =
            await complaintFollowUpService.getNonStpComplaints();

        return res.status(200).json({

            success: true,

            complaints

        });

    } catch (error) {

        console.error(
            "Get Non-STP Complaints Controller Error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to load complaints."

        });

    }

}


// ============================================================
// GET SINGLE COMPLAINT
// ============================================================

async function getComplaintById(req, res) {

    try {

        const { complaintId } =
            req.params;


        if (!complaintId) {

            return res.status(400).json({

                success: false,

                message:
                    "Complaint ID is required."

            });

        }


        const complaint =
            await complaintFollowUpService
                .getComplaintById(
                    complaintId
                );


        if (!complaint) {

            return res.status(404).json({

                success: false,

                message:
                    "Complaint not found."

            });

        }


        return res.status(200).json({

            success: true,

            complaint

        });

    } catch (error) {

        console.error(
            "Get Complaint Controller Error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to load complaint."

        });

    }

}


// ============================================================
// UPDATE COMPLAINT FOLLOW-UP
// ============================================================

async function updateComplaint(req, res) {

    let connection;

    try {

        const { complaintId } = req.params;

        const {
            status,
            agentNote
        } = req.body;

        connection = await getConnection();

        await connection.execute(
            `
            UPDATE COMPLAINTS
            SET
                STATUS = :status,
                AGENT_NOTE = :agentNote,
                UPDATED_AT = CURRENT_TIMESTAMP
            WHERE COMPLAINT_ID = :complaintId
            `,
            {
                status,
                agentNote,
                complaintId
            },
            {
                autoCommit: true
            }
        );

        return res.status(200).json({
            success: true,
            message: "Complaint updated successfully."
        });

    } catch (error) {

        console.error(
            "Update Complaint Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to update complaint."
        });

    } finally {

        if (connection) {
            await connection.close();
        }

    }
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    getNonStpComplaints,
    getComplaintById,
    updateComplaint
};