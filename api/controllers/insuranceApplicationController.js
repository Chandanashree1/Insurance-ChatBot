const submitInsuranceApplication = async (req, res) => {

    try {

        console.log("========== INSURANCE APPLICATION ==========");

        console.log("BODY:", req.body);
        console.log("FILES:", req.files);

        if (!req.body || !req.body.application) {
            return res.status(400).json({
                success: false,
                message: "Application data is required"
            });
        }

        const application = JSON.parse(req.body.application);

        console.log("Application:", application);

        const documents = req.files || [];

        console.log("Documents:", documents);

        // TODO:
        // Save application to Oracle/MongoDB here
        // Save document information here

        return res.status(200).json({
            success: true,
            message: "Insurance application submitted successfully",
            application,
            documents: documents.map(file => ({
                originalName: file.originalname,
                fileName: file.filename,
                path: file.path
            }))
        });

    } catch (error) {

        console.error(
            "Insurance Application Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to submit insurance application"
        });
    }
};

module.exports = {
    submitInsuranceApplication
};