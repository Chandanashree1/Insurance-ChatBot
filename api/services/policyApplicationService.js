const INSURANCE_FORMS = require("../config/insuranceForms");

function getInsuranceForm(policyType) {

    const type = policyType.toUpperCase();

    return INSURANCE_FORMS[type] || null;
}


function validateApplication(policyType, applicationData) {

    const form = getInsuranceForm(policyType);

    if (!form) {
        return {
            valid: false,
            message: "Invalid insurance type."
        };
    }

    const missingFields = [];

    for (const field of form.fields) {

        if (
            field.required &&
            (
                applicationData[field.name] === undefined ||
                applicationData[field.name] === null ||
                applicationData[field.name] === ""
            )
        ) {
            missingFields.push(field.label);
        }
    }

    if (missingFields.length > 0) {
        return {
            valid: false,
            message: "Please complete all required fields.",
            missingFields
        };
    }

    return {
        valid: true,
        message: "Application details are valid."
    };
}


function createApplication(policyType, applicationData) {

    const validation = validateApplication(
        policyType,
        applicationData
    );

    if (!validation.valid) {
        return validation;
    }

    const application = {
        policyType,
        ...applicationData,
        status: "SUBMITTED",
        createdAt: new Date()
    };

    return {
        valid: true,
        application
    };
}


module.exports = {
    getInsuranceForm,
    validateApplication,
    createApplication
};