import { Message, Conversation } from '../models/index.js';
import { ApiError } from './apiResponse.js';

/**
 * Load a message together with its conversation and verify the requesting user
 * is a participant of the conversation.
 * Used by every message action endpoint so permissions are enforced centrally.
 */
export const getMessageWithAccess = async (messageId, userId) => {
  const message = await Message.findById(messageId);
  if (!message) throw new ApiError(404, 'Message not found');

  const conversation = await Conversation.findById(message.conversation);
  if (!conversation) throw new ApiError(404, 'Conversation not found');

  const isParticipant = conversation.participants.some(
    (p) => p.toString() === userId.toString()
  );
  if (!isParticipant) throw new ApiError(403, 'Not authorized');

  return { message, conversation };
};

/**
 * Load a conversation and verify the requesting user is a participant.
 */
export const getConversationWithAccess = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, 'Conversation not found');

  const isParticipant = conversation.participants.some(
    (p) => p.toString() === userId.toString()
  );
  if (!isParticipant) throw new ApiError(403, 'Not authorized');

  return conversation;
};

/**
 * Verify the requesting user is the sender of the message.
 */
export const assertSender = (message, userId) => {
  if (message.sender.toString() !== userId.toString()) {
    throw new ApiError(403, 'Only the sender can perform this action');
  }
};

/**
 * Resolve one or more target conversations for forwarding and verify
 * membership for each. Returns an array of target conversation documents.
 */
export const getForwardTargets = async (targetIds, userId) => {
  const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
  if (!ids.length) throw new ApiError(400, 'targetConversationId is required');

  const unique = [...new Set(ids.map((id) => id?.toString()))];
  const conversations = await Conversation.find({ _id: { $in: unique } });
  if (conversations.length !== unique.length) {
    throw new ApiError(404, 'One or more target conversations not found');
  }

  for (const conv of conversations) {
    const isParticipant = conv.participants.some(
      (p) => p.toString() === userId.toString()
    );
    if (!isParticipant) throw new ApiError(403, 'Not authorized to send to this conversation');
  }

  return conversations;
};
