// services/conversationService.js

const conversations = new Map();

const MAX_HISTORY = 20;

/**
 * Get conversation history for a user.
 * Creates a new conversation if one doesn't exist.
 */
function getHistory(userId) {

    if (!conversations.has(userId)) {
        conversations.set(userId, []);
    }

    return conversations.get(userId);
}

/**
 * Add a message to the conversation.
 */
function addMessage(userId, role, content) {

    const history = getHistory(userId);

    history.push({
        role,
        content
    });

    // Keep only the latest messages
    if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
    }
}

/**
 * Clear a user's conversation.
 */
function clearHistory(userId) {
    conversations.delete(userId);
}

//Check whether conversation exists.
function hasConversation(userId) {
    return conversations.has(userId);
}

/**
 * Get all active conversations.
 * (Useful for debugging)
 */
function getConversationCount() {
    return conversations.size;
}

module.exports = {
    getHistory,
    addMessage,
    clearHistory,
    hasConversation,
    getConversationCount
};