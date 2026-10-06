const complaintFollowUpService = require("../services/complaintFollowUpService");

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

async function updateComplaintFollowUp(req, res) {

    try {

        const { complaintId } =
            req.params;

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


        const updated =
            await complaintFollowUpService
                .updateComplaintFollowUp(
                    complaintId,
                    status,
                    agentNote
                );


        if (!updated) {

            return res.status(404).json({

                success: false,

                message:
                    "Complaint not found."

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Complaint follow-up updated successfully."

        });

    } catch (error) {

        console.error(
            "Update Complaint Follow-Up Controller Error:",
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
    updateComplaintFollowUp
};