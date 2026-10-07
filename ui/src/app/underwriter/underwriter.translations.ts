export const uwTranslations = {
  en: {
    // Login
    underwriterLogin: 'Underwriter Login',
    username: 'Username',
    password: 'Password',
    usernamePlaceholder: 'underwriter',
    login: 'Login',
    invalidCredentials: 'Invalid username or password',

    // Header
    underwriterDashboard: 'Underwriter Dashboard',
    logout: 'Logout',

    // Proposal list
    proposalsPendingReview: 'Proposals Pending Review',
    noPlanSelected: 'No plan selected — KYC verification failed before plan selection',
    vehicleValue: 'Vehicle Value',
    noProposals: 'No proposals pending review.',

    // Decision panel
    underwritingDecision: 'Underwriting Decision',
    selectProposalPrompt: 'Select a proposal from the list to review.',
    noteOptional: 'Note (optional)',
    notePlaceholder: 'Add a note for the customer...',
    counterOfferLabel: 'Counter-offer Premium (only if countering)',
    counterOfferPlaceholder: 'e.g. 75.000',
    approve: 'Approve',
    counterOffer: 'Counter-offer',
    decline: 'Decline',
    decisionsThisSession: 'Decisions this session',

    // Statuses / decisions
    statusPending: 'Pending',
    statusApproved: 'Approved',
    statusCounterOffer: 'Counter-offer',
    statusDeclined: 'Declined',

    //complaints
    nonStpComplaints: 'Non-STP Complaints',
    complaintWord: 'Complaint',
    noComplaints: 'No non-STP complaints.',
    complaintDecision: 'Complaint Decision',
    selectComplaintPrompt: 'Select a complaint from the list to view details.',
    customer: 'Customer',
    email: 'Email',
    mobile: 'Mobile',
    product: 'Product',
    policyNumber: 'Policy Number',
    subject: 'Subject',
    complaintLabel: 'Complaint',
    route: 'Route',
    status: 'Status',
    aiReason: 'AI Reason',
    call: 'Call',
    notAvailable: 'N/A'
  },

  ar: {
    // Login
    underwriterLogin: 'تسجيل دخول المكتتب',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    usernamePlaceholder: 'underwriter',
    login: 'تسجيل الدخول',
    invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة',

    // Header
    underwriterDashboard: 'لوحة تحكم المكتتب',
    logout: 'تسجيل الخروج',

    // Proposal list
    proposalsPendingReview: 'الطلبات قيد المراجعة',
    noPlanSelected: 'لم يتم اختيار خطة — فشل التحقق من الهوية قبل اختيار الخطة',
    vehicleValue: 'قيمة المركبة',
    noProposals: 'لا توجد طلبات قيد المراجعة.',

    // Decision panel
    underwritingDecision: 'قرار الاكتتاب',
    selectProposalPrompt: 'اختر طلبًا من القائمة لمراجعته.',
    noteOptional: 'ملاحظة (اختيارية)',
    notePlaceholder: 'أضف ملاحظة للعميل...',
    counterOfferLabel: 'قسط العرض المضاد (فقط عند تقديم عرض مضاد)',
    counterOfferPlaceholder: 'مثال: 75.000',
    approve: 'موافقة',
    counterOffer: 'عرض مضاد',
    decline: 'رفض',
    decisionsThisSession: 'قرارات هذه الجلسة',

    // Statuses / decisions
    statusPending: 'قيد المراجعة',
    statusApproved: 'تمت الموافقة',
    statusCounterOffer: 'عرض مضاد',
    statusDeclined: 'مرفوض',

    //complaints
    nonStpComplaints: 'شكاوى خارج النطاق الآلي',
    complaintWord: 'شكوى',
    noComplaints: 'لا توجد شكاوى خارج النطاق الآلي.',
    complaintDecision: 'قرار الشكوى',
    selectComplaintPrompt: 'اختر شكوى من القائمة لعرض التفاصيل.',
    customer: 'العميل',
    email: 'البريد الإلكتروني',
    mobile: 'الجوال',
    product: 'المنتج',
    policyNumber: 'رقم الوثيقة',
    subject: 'الموضوع',
    complaintLabel: 'الشكوى',
    route: 'المسار',
    status: 'الحالة',
    aiReason: 'سبب الذكاء الاصطناعي',
    call: 'اتصال',
    notAvailable: 'غير متوفر'
  }
};

export type UwKey = keyof typeof uwTranslations.en;
export type UwLang = 'en' | 'ar';