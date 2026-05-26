const Message = require('./Message');

// Track connected chat clients: { ws, userId, userName, userRole }
const chatClients = new Set();

const handleChatConnection = (ws, userId, userName, userRole) => {
  const client = { ws, userId, userName, userRole };
  chatClients.add(client);

  console.log(`[Chat] ${userName} connected (${chatClients.size} online)`);

  // Send last 50 messages to the new client
  Message.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .then(messages => {
      ws.send(JSON.stringify({
        type: 'CHAT_HISTORY',
        messages: messages.reverse().map(formatMessage),
        onlineUsers: getOnlineUsers(),
      }));
    })
    .catch(console.error);

  // Broadcast updated online users list
  broadcastOnlineUsers();

  // Handle incoming messages
  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data.toString());

      if (parsed.type === 'CHAT_MESSAGE') {
        const text = parsed.text?.trim();
        if (!text || text.length === 0 || text.length > 1000) return;

        // Save to MongoDB
        const message = await Message.create({
          senderId:   userId,
          senderName: userName,
          senderRole: userRole,
          text,
        });

        // Broadcast to all connected chat clients
        broadcastToAll({
          type: 'CHAT_MESSAGE',
          message: formatMessage(message),
          onlineUsers: getOnlineUsers(),
        });
      }
    } catch (err) {
      console.error('[Chat] Error handling message:', err.message);
    }
  });

  ws.on('close', () => {
    chatClients.delete(client);
    console.log(`[Chat] ${userName} disconnected (${chatClients.size} online)`);
    broadcastOnlineUsers();
  });
};

const broadcastToAll = (data) => {
  const message = JSON.stringify(data);
  chatClients.forEach(({ ws }) => {
    if (ws.readyState === 1) ws.send(message);
  });
};

const broadcastOnlineUsers = () => {
  broadcastToAll({
    type: 'ONLINE_USERS',
    onlineUsers: getOnlineUsers(),
  });
};

const getOnlineUsers = () => {
  return [...chatClients].map(c => ({
    userId: c.userId,
    userName: c.userName,
    userRole: c.userRole,
  }));
};

const formatMessage = (m) => ({
  id:         m._id.toString(),
  senderId:   m.senderId,
  senderName: m.senderName,
  senderRole: m.senderRole,
  text:       m.text,
  createdAt:  m.createdAt.toISOString(),
});

module.exports = { handleChatConnection };