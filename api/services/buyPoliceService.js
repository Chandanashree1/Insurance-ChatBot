const sessions = new Map();

function startFlow(userId) {
    sessions.set(userId, {
        step: 1,
        answers: {
            policyType: "",
            plan: "",
            age: "",
            gender: "",
            disease: ""
        }
    });
}

function getFlow(userId) {
    return sessions.get(userId);
}

function updateFlow(userId, data) {

    const session = sessions.get(userId);

    if (!session) return null;

    session.answers = {
        ...session.answers,
        ...data
    };

    session.step++;

    return session;
}

function endFlow(userId) {
    sessions.delete(userId);
}

module.exports = {
    startFlow,
    getFlow,
    updateFlow,
    endFlow
};