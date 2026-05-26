const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  senderId:   { type: String, required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, default: 'normal_user' },
  text:       { type: String, required: true, maxlength: 1000 },
  createdAt:  { type: Date, default: Date.now },
});

// Index for fast retrieval of recent messages
MessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);