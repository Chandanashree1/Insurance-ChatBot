const complaintFollowUpService = require("../services/complaintFollowUpService");

const ALLOWED_STATUSES = [
    "PENDING",
    "OPEN",
    "IN_PROGRESS",
    "COMPLETED"
];

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
// Saves agent message + changes status (e.g. COMPLETED)
// ============================================================

async function updateComplaint(req, res) {

    try {

        const { complaintId } = req.params;

        const {
            status,
            agentNote
        } = req.body;


        if (!complaintId) {

            return res.status(400).json({

                success: false,

                message:
                    "Complaint ID is required."

            });

        }


        if (!status) {

            return res.status(400).json({

                success: false,

                message:
                    "Status is required."

            });

        }


        const normalizedStatus =
            String(status).trim().toUpperCase();


        if (!ALLOWED_STATUSES.includes(normalizedStatus)) {

            return res.status(400).json({

                success: false,

                message:
                    `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}`

            });

        }


        const result =
            await complaintFollowUpService.updateComplaint(
                complaintId,
                normalizedStatus,
                agentNote
            );


        if (!result.success) {

            return res.status(404).json(result);

        }


        return res.status(200).json({

            success: true,

            message:
                result.message,

            status:
                normalizedStatus

        });

    } catch (error) {

        console.error(
            "Update Complaint Controller Error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to update complaint."

        });

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