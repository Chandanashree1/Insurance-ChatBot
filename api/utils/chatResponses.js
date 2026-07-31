const RESPONSES = {

    en: {

        GREETING: {
            reply: `👋 Hello! Welcome to ABC Insurance.

How can I assist you today?`,
            uiType: "GREETING",
            actions: [
                { label: "📄 My Policy", action: "POLICY" },
                { label: "📋 Claim Status", action: "CLAIM" },
                { label: "🔄 Renew Policy", action: "RENEW_POLICY" },
                { label: "📑 Claim Documents", action: "CLAIM_DOCUMENTS" }
            ]
        },

        THANKS: {
            reply: "You're welcome! 😊",
            uiType: "TEXT",
            actions: []
        },

        GOODBYE: {
            reply: "Thank you for choosing ABC Insurance. Have a wonderful day! 👋",
            uiType: "TEXT",
            actions: []
        },

        HELP: {
            reply: `I can help you with:

• Policy Details
• Claim Status
• Policy Renewal
• Premium Information
• Claim Documents
• Insurance FAQs`,
            uiType: "HELP",
            actions: []
        }

    },

    ar: {

        GREETING: {
            reply: `👋 مرحبًا بك في شركة ABC للتأمين.

كيف يمكنني مساعدتك اليوم؟`,
            uiType: "GREETING",
            actions: [
                { label: "📄 وثائقي", action: "POLICY" },
                { label: "📋 حالة المطالبة", action: "CLAIM" },
                { label: "🔄 تجديد الوثيقة", action: "RENEW_POLICY" },
                { label: "📑 مستندات المطالبة", action: "CLAIM_DOCUMENTS" }
            ]
        },

        THANKS: {
            reply: "على الرحب والسعة! 😊",
            uiType: "TEXT",
            actions: []
        },

        GOODBYE: {
            reply: "شكرًا لاختيارك ABC للتأمين. نتمنى لك يومًا سعيدًا! 👋",
            uiType: "TEXT",
            actions: []
        },

        HELP: {
            reply: `يمكنني مساعدتك في:

• تفاصيل الوثيقة
• حالة المطالبة
• تجديد الوثيقة
• معلومات القسط
• مستندات المطالبة
• الأسئلة الشائعة`,
            uiType: "HELP",
            actions: []
        }

    }

};

module.exports = RESPONSES;