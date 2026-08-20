const INSURANCE_FORMS = {

    HEALTH: {
        name: "Health Insurance",

        fields: [
            {
                name: "fullName",
                label: "Full Name",
                type: "text",
                required: true
            },
            {
                name: "civilId",
                label: "Civil ID",
                type: "text",
                required: true
            },
            {
                name: "dateOfBirth",
                label: "Date of Birth",
                type: "date",
                required: true
            },
            {
                name: "gender",
                label: "Gender",
                type: "select",
                options: ["Male", "Female"],
                required: true
            },
            {
                name: "mobileNumber",
                label: "Mobile Number",
                type: "tel",
                required: true
            },
            {
                name: "email",
                label: "Email",
                type: "email",
                required: true
            },
            {
                name: "plan",
                label: "Plan",
                type: "select",
                options: ["Basic", "Standard", "Premium"],
                required: true
            },
            {
                name: "coverageAmount",
                label: "Coverage Amount",
                type: "select",
                options: ["5,000", "10,000", "20,000"],
                required: true
            },
            {
                name: "existingMedicalCondition",
                label: "Existing Medical Condition",
                type: "radio",
                options: ["Yes", "No"],
                required: true
            },
            {
                name: "nationality",
                label: "Nationality",
                type: "text",
                required: true
            },
            {
                name: "area",
                label: "Pincode / Area",
                type: "text",
                required: true
            }
        ]
    },


    MOTOR: {
        name: "Motor Insurance",

        fields: [
            {
                name: "civilId",
                label: "Civil ID",
                type: "text",
                required: true
            },
            {
                name: "fullName",
                label: "Full Name",
                type: "text",
                required: true
            },
            {
                name: "mobileNumber",
                label: "Mobile Number",
                type: "tel",
                required: true
            },
            {
                name: "email",
                label: "Email",
                type: "email",
                required: true
            },
            {
                name: "vehicleRegistrationNumber",
                label: "Vehicle Registration Number",
                type: "text",
                required: true
            },
            {
                name: "vehicleMakeModel",
                label: "Vehicle Make & Model",
                type: "text",
                required: true
            },
            {
                name: "manufacturingYear",
                label: "Manufacturing Year",
                type: "number",
                required: true
            },
            {
                name: "vehicleType",
                label: "Vehicle Type",
                type: "select",
                options: [
                    "Car",
                    "Motorcycle",
                    "Commercial"
                ],
                required: true
            },
            {
                name: "insuranceType",
                label: "Insurance Type",
                type: "select",
                options: [
                    "Third Party",
                    "Comprehensive"
                ],
                required: true
            },
            {
                name: "previousInsurance",
                label: "Previous Insurance",
                type: "radio",
                options: ["Yes", "No"],
                required: true
            },
            {
                name: "policyExpiryDate",
                label: "Policy Expiry Date",
                type: "date",
                required: false
            }
        ]
    },


    TRAVEL: {
        name: "Travel Insurance",

        fields: [
            {
                name: "civilId",
                label: "Civil ID",
                type: "text",
                required: true
            },
            {
                name: "fullName",
                label: "Full Name",
                type: "text",
                required: true
            },
            {
                name: "mobileNumber",
                label: "Mobile Number",
                type: "tel",
                required: true
            },
            {
                name: "email",
                label: "Email",
                type: "email",
                required: true
            },
            {
                name: "destinationCountry",
                label: "Destination Country",
                type: "text",
                required: true
            },
            {
                name: "travelStartDate",
                label: "Travel Start Date",
                type: "date",
                required: true
            },
            {
                name: "travelEndDate",
                label: "Travel End Date",
                type: "date",
                required: true
            },
            {
                name: "numberOfTravellers",
                label: "Number of Travellers",
                type: "number",
                required: true
            },
            {
                name: "travelType",
                label: "Travel Type",
                type: "select",
                options: [
                    "Single Trip",
                    "Multi Trip"
                ],
                required: true
            },
            {
                name: "plan",
                label: "Plan",
                type: "select",
                options: [
                    "Basic",
                    "Standard",
                    "Premium"
                ],
                required: true
            }
        ]
    }

};

module.exports = INSURANCE_FORMS;