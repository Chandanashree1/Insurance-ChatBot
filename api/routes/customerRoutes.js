const express = require("express");

const router = express.Router();

const {findCustomer,createCustomer} = require("../services/oracleservice");


/*
=========================================================
CREATE / FIND CUSTOMER
POST /api/customers
=========================================================
*/

router.post("/", async (req, res) => {

    try {

        const {
            mobileNumber,
            fullName,
            civilIdLicenseNo,
            email
        } = req.body;


        // ---------------------------------------------
        // Validate required fields
        // ---------------------------------------------

        if (
            !mobileNumber ||
            !fullName ||
            !civilIdLicenseNo
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Mobile number, full name and Civil ID/License number are required"
            });

        }


        // ---------------------------------------------
        // Check whether customer already exists
        // ---------------------------------------------

        const existingCustomer = await findCustomer(
            mobileNumber,
            civilIdLicenseNo
        );


        if (existingCustomer.length > 0) {

            return res.status(200).json({
                success: true,
                message: "Customer already exists",
                isNewCustomer: false,
                data: existingCustomer[0]
            });

        }


        // ---------------------------------------------
        // Create new customer
        // ---------------------------------------------

        const newCustomer = await createCustomer({
            mobileNumber,
            fullName,
            civilIdLicenseNo,
            email
        });


        return res.status(201).json({
            success: true,
            message: "Customer created successfully",
            isNewCustomer: true,
            data: newCustomer
        });


    } catch (error) {

        console.error("Customer API Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create customer"
        });

    }

});


module.exports = router;
