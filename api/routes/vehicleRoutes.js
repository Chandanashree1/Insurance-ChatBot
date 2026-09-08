const express = require("express");
const router = express.Router();

const { getVehicle } = require("../services/oracleservice");

router.get("/vehicles/:plateNumber/:plateCode", async (req, res) => {

    try {

        const { plateNumber, plateCode } = req.params;

        if (!plateNumber || !plateCode) {
            return res.status(400).json({
                success: false,
                message: "Plate number and plate code are required"
            });
        }

        const vehicle = await getVehicle(
            plateNumber,
            plateCode
        );

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: vehicle
        });

    } catch (error) {

        console.error("Vehicle API Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve vehicle information"
        });

    }

});

module.exports = router;