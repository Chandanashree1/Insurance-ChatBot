const KNOWN_ISSUES = [
    {
        code: "PAYMENT_DEDUCTED_POLICY_NOT_ACTIVE",
        keywords: [
            "payment deducted",
            "money deducted",
            "payment successful",
            "policy not active",
            "policy pending"
        ],
        searchQuery:
            "payment deducted policy not activated payment successful policy pending"
    },

    {
        code: "POLICY_DOCUMENT_NOT_RECEIVED",
        keywords: [
            "policy document",
            "document not received",
            "policy copy",
            "policy pdf"
        ],
        searchQuery:
            "policy document not received download policy document"
    },

    {
        code: "CLAIM_STATUS_NOT_UPDATED",
        keywords: [
            "claim status",
            "claim pending",
            "claim not updated",
            "claim status not changed"
        ],
        searchQuery:
            "claim status pending claim processing claim status update"
    },

    {
        code: "PREMIUM_PAYMENT_FAILED",
        keywords: [
            "payment failed",
            "premium payment failed",
            "unable to pay",
            "payment unsuccessful"
        ],
        searchQuery:
            "premium payment failed payment unsuccessful retry payment"
    }
];

module.exports = {
    KNOWN_ISSUES
};