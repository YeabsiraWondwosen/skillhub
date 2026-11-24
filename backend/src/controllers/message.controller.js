import { Message, Conversation, User, Project } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/helpers.js';
import { uploadMultipleFiles } from '../services/cloudinary.service.js';
import { emitToConversation, emitToUser } from '../services/socket.service.js';
import { notifyNewMessage } from '../services/notification.service.js';
import { getMessageWithAccess, getConversationWithAccess, assertSender, getForwardTargets } from '../utils/messageAccess.js';
import {
  getEligibleContacts,
  assertCanCommunicate,
  RELATIONSHIP_LABELS,
} from '../services/messagingRelationship.service.js';
import { config } from '../config/env.js';

// ─── Get Eligible Contacts (New Conversation list) ───────────────────────────
export const getEligibleContactList = catchAsync(async (req, res) => {
  const contacts = await getEligibleContacts(req.user._id);
  sendResponse(res, 200, 'Eligible contacts fetched', contacts);
});

// ─── Resolve & validate the target user for a new conversation ───────────────
const resolveConversationTarget = async (currentUser, participantId, type, projectId) => {
  if (participantId === currentUser._id.toString()) {
    throw new ApiError(400, 'Cannot start a conversation with yourself');
  }

  const otherUser = await User.findById(participantId).select('firstName lastName avatar role isOnline');
  if (!otherUser) throw new ApiError(404, 'User not found');

  if (type === 'project') {
    if (!projectId) throw new ApiError(400, 'projectId is required for project conversations');

    const project = await Project.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');

    const isMember =
      project.client.toString() === currentUser._id.toString() ||
      project.freelancer.toString() === currentUser._id.toString();
    if (!isMember) {
      throw new ApiError(403, 'You are not a participant of this project');
    }

    const partnerId =
      project.client.toString() === currentUser._id.toString()
        ? project.freelancer
        : project.client;
    if (partnerId.toString() !== participantId.toString()) {
      throw new ApiError(403, 'You can only start a project conversation with the other project member');
    }
    return { otherUser, project, partnerId };
  }

  // Direct conversations require a legitimate relationship unless one already exists.
  await assertCanCommunicate(currentUser._id, participantId);
  return { otherUser, project: null, partnerId: participantId };
};

// ─── Get or Create Conversation ───────────────────────────────────────────────
export const getOrCreateConversation = catchAsync(async (req, res) => {
  const { participantId, type = 'direct', projectId, initialMessage } = req.body;

  const { otherUser, project, partnerId } = await resolveConversationTarget(
    req.user,
    participantId,
    type,
    projectId
  );

  // Check for existing direct conversation
  let conversation = null;
  if (type === 'direct') {
    conversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [req.user._id, participantId], $size: 2 },
    });
  } else if (type === 'project' && project) {
    conversation = await Conversation.findOne({ type: 'project', project: project._id });
  }

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [req.user._id, partnerId],
      type,
      project: type === 'project' ? project._id : null,
      unreadCounts: [
        { user: req.user._id, count: 0 },
        { user: partnerId, count: 0 },
      ],
      metadata: {
        title: `${req.user.firstName} & ${otherUser.firstName}`,
      },
    });
  } else if (conversation.deletedFor.some((id) => id.toString() === req.user._id.toString())) {
    // Reuse the existing one-to-one conversation instead of creating a duplicate,
    // and bring it back into the current user's list.
    conversation.deletedFor.pull(req.user._id);
    await conversation.save();
  }

  if (initialMessage) {
    await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      content: initialMessage,
    });
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessageAt: new Date(),
    });
  }

  await conversation.populate('participants', 'firstName lastName avatar isOnline lastSeen');
  sendResponse(res, 200, 'Conversation ready', conversation);
});

// ─── Get My Conversations ─────────────────────────────────────────────────────
export const getMyConversations = catchAsync(async (req, res) => {
  const conversations = await Conversation.find({
    participants: req.user._id,
    isActive: true,
    deletedFor: { $ne: req.user._id },
  })
    .populate('participants', 'firstName lastName avatar isOnline lastSeen role')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 });

  // Add unread count for current user and per-user settings
  const enriched = conversations.map((conv) => {
    const obj = conv.toObject();
    const unread = conv.unreadCounts.find(
      (u) => u.user.toString() === req.user._id.toString()
    );
    obj.myUnreadCount = unread?.count || 0;

    // Find this user's settings
    const mySettings = conv.userSettings?.find(
      (s) => s.user.toString() === req.user._id.toString()
    );
    obj.userSettings = mySettings ? [mySettings] : [];

    // Compute a safe preview for the last message, handling deletions
    const last = conv.lastMessage;
    if (last) {
      const deletedForMe = (last.deletedFor || []).some(
        (id) => id.toString() === req.user._id.toString()
      );
      if (last.isDeleted || deletedForMe) {
        obj.lastMessagePreview = 'This message was deleted';
      } else {
        obj.lastMessagePreview =
          last.content || (last.attachments?.length ? 'Attachment' : 'No messages yet');
      }
    } else {
      obj.lastMessagePreview = 'No messages yet';
    }

    // Filter out archived conversations from main list
    return obj;
  }).filter((conv) => {
    const mySettings = conv.userSettings?.[0];
    return !mySettings?.isArchived;
  });

  sendResponse(res, 200, 'Conversations fetched', enriched);
});

// ─── Get Messages in Conversation ────────────────────────────────────────────
export const getMessages = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const { page, limit, skip } = parsePagination(req.query);

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, 'Conversation not found');

  const isParticipant = conversation.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );
  if (!isParticipant) throw new ApiError(403, 'Not authorized');

  const hiddenForUser = { deletedFor: { $ne: req.user._id } };
  const total = await Message.countDocuments({
    conversation: conversationId,
    isDeleted: false,
    ...hiddenForUser,
  });

  const messages = await Message.find({
    conversation: conversationId,
    isDeleted: false,
    ...hiddenForUser,
  })
    .populate('sender', 'firstName lastName avatar')
    .populate('replyTo', 'content sender')
    .populate('forwardedFrom.sender', 'firstName lastName avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Mark messages as read
  const unreadIds = messages
    .filter((m) => m.sender._id.toString() !== req.user._id.toString())
    .filter((m) => !m.readBy.some((r) => r.user.toString() === req.user._id.toString()))
    .map((m) => m._id);

  if (unreadIds.length > 0) {
    await Message.updateMany(
      { _id: { $in: unreadIds } },
      { $push: { readBy: { user: req.user._id, readAt: new Date() } } }
    );
    // Reset unread count
    await Conversation.updateOne(
      { _id: conversationId, 'unreadCounts.user': req.user._id },
      { $set: { 'unreadCounts.$.count': 0 } }
    );
  }

  sendResponse(res, 200, 'Messages fetched', messages.reverse(), paginationMeta(total, page, limit));
});

// ─── Send Message ─────────────────────────────────────────────────────────────
export const sendMessage = catchAsync(async (req, res) => {
  const { conversationId } = req.params;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, 'Conversation not found');

  const isParticipant = conversation.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );
  if (!isParticipant) throw new ApiError(403, 'Not authorized');

  // ── Block enforcement (per-user conversation settings) ──────────────────
  const mySettings = conversation.userSettings?.find(
    (s) => s.user.toString() === req.user._id.toString()
  );
  if (mySettings?.isBlocked) {
    throw new ApiError(403, 'You blocked this user. Unblock them to send messages.');
  }
  const otherBlockedMe = (conversation.userSettings || []).some(
    (s) =>
      s.user.toString() !== req.user._id.toString() &&
      s.isBlocked &&
      s.blockedBy?.toString() === req.user._id.toString()
  );
  if (otherBlockedMe) {
    throw new ApiError(403, 'This user blocked you. You cannot send them messages.');
  }

  // Validate reply target belongs to the same conversation
  let replyTo = null;
  if (req.body.replyTo) {
    const replyTarget = await Message.findById(req.body.replyTo);
    if (!replyTarget || replyTarget.conversation.toString() !== conversationId.toString()) {
      throw new ApiError(400, 'Reply target is not part of this conversation');
    }
    replyTo = replyTarget._id;
  }

  const attachments = req.files?.length
    ? await uploadMultipleFiles(req.files, 'messages')
    : [];

  const message = await Message.create({
    conversation: conversationId,
    sender: req.user._id,
    content: req.body.content || '',
    messageType: req.body.messageType || 'text',
    replyTo: replyTo || null,
    metadata: req.body.metadata || {},
    attachments,
  });

  await message.populate('sender', 'firstName lastName avatar');
  if (message.replyTo) {
    await message.populate('replyTo', 'content sender');
  }

  // Update conversation
  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: message._id,
    lastMessageAt: new Date(),
    $inc: { 'unreadCounts.$[other].count': 1 },
  }, {
    arrayFilters: [{ 'other.user': { $ne: req.user._id } }],
  });

  // Emit to conversation room
  emitToConversation(conversationId, 'message:new', message);

  // Push notification to other participants
  const otherParticipants = conversation.participants.filter(
    (p) => p.toString() !== req.user._id.toString()
  );

  for (const participantId of otherParticipants) {
    await notifyNewMessage(
      participantId,
      req.user._id,
      `${req.user.firstName} ${req.user.lastName}`,
      conversationId
    );
  }

  sendResponse(res, 201, 'Message sent', message);
});

// ─── Edit Message ─────────────────────────────────────────────────────────────
export const editMessage = catchAsync(async (req, res) => {
  const { message, conversation } = await getMessageWithAccess(req.params.messageId, req.user._id);

  if (message.isDeleted) throw new ApiError(400, 'Cannot edit a deleted message');
  if ((message.deletedFor || []).some((id) => id.toString() === req.user._id.toString())) {
    throw new ApiError(400, 'Cannot edit a message you deleted for yourself');
  }

  assertSender(message, req.user._id);

  const timeDiff = Date.now() - message.createdAt.getTime();
  const editWindowMs = config.messaging.editWindowMinutes * 60 * 1000;
  if (timeDiff > editWindowMs) {
    throw new ApiError(400, `Messages can only be edited within ${config.messaging.editWindowMinutes} minutes`);
  }

  message.content = req.body.content;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  await message.populate('sender', 'firstName lastName avatar');
  if (message.replyTo) await message.populate('replyTo', 'content sender');
  if (message.forwardedFrom?.sender) await message.populate('forwardedFrom.sender', 'firstName lastName avatar');

  emitToConversation(message.conversation.toString(), 'message:edited', message);
  sendResponse(res, 200, 'Message edited', message);
});

// ─── Delete Message (for me / for everyone) ───────────────────────────────────
export const deleteMessage = catchAsync(async (req, res) => {
  const { message, conversation } = await getMessageWithAccess(req.params.messageId, req.user._id);
  const scope = req.query.scope === 'me' ? 'me' : (req.query.scope === 'everyone' ? 'everyone' : 'everyone');

  // ── Delete for me: only hides the message for this user ──────────────────
  if (scope === 'me') {
    if (!(message.deletedFor || []).some((id) => id.toString() === req.user._id.toString())) {
      message.deletedFor.push(req.user._id);
      await message.save();
    }
    emitToUser(req.user._id.toString(), 'message:deletedForMe', {
      messageId: message._id,
      conversationId: message.conversation.toString(),
    });
    return sendResponse(res, 200, 'Message deleted for you', message);
  }

  // ── Delete for everyone: only the sender (or admin/moderator) ────────────
  const isAdmin = ['admin', 'moderator'].includes(req.user.role);
  if (!isAdmin) assertSender(message, req.user._id);

  if (message.isDeleted) throw new ApiError(400, 'Message is already deleted');

  if (!isAdmin) {
    const timeDiff = Date.now() - message.createdAt.getTime();
    const deleteWindowMs = config.messaging.deleteWindowMinutes * 60 * 1000;
    if (timeDiff > deleteWindowMs) {
      throw new ApiError(
        400,
        `Messages can only be deleted for everyone within ${config.messaging.deleteWindowMinutes} minutes of sending`
      );
    }
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.deletedBy = req.user._id;
  message.content = '';
  message.attachments = [];
  await message.save();

  emitToConversation(message.conversation.toString(), 'message:deleted', {
    messageId: message._id,
    conversationId: message.conversation.toString(),
  });
  sendResponse(res, 200, 'Message deleted for everyone', message);
});

// ─── Forward Message ─────────────────────────────────────────────────────────
export const forwardMessage = catchAsync(async (req, res) => {
  const { messageId } = req.params;
  const { targetConversationId, targetConversationIds } = req.body;

  const original = await Message.findById(messageId).populate('sender', 'firstName lastName avatar');
  if (!original) throw new ApiError(404, 'Message not found');
  if (original.isDeleted) throw new ApiError(400, 'Cannot forward a deleted message');

  const originalConv = await Conversation.findById(original.conversation);
  if (!originalConv) throw new ApiError(404, 'Original conversation not found');

  const isOriginalParticipant = originalConv.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );
  if (!isOriginalParticipant) throw new ApiError(403, 'Not authorized to forward this message');

  const rawTargets = targetConversationIds ?? targetConversationId;
  const targetConvs = await getForwardTargets(rawTargets, req.user._id);

  const forwardedMessages = [];
  for (const targetConv of targetConvs) {
    const forwarded = await Message.create({
      conversation: targetConv._id,
      sender: req.user._id,
      content: original.content,
      messageType: original.messageType,
      attachments: original.attachments,
      forwardedFrom: {
        conversation: original.conversation,
        sender: original.sender._id,
      },
    });

    await forwarded.populate('sender', 'firstName lastName avatar');
    await forwarded.populate('forwardedFrom.sender', 'firstName lastName avatar');
    forwardedMessages.push(forwarded);

    await Conversation.findByIdAndUpdate(targetConv._id, {
      lastMessage: forwarded._id,
      lastMessageAt: new Date(),
      $inc: { 'unreadCounts.$[other].count': 1 },
    }, {
      arrayFilters: [{ 'other.user': { $ne: req.user._id } }],
    });

    emitToConversation(targetConv._id.toString(), 'message:new', forwarded);

    const otherParticipants = targetConv.participants.filter(
      (p) => p.toString() !== req.user._id.toString()
    );
    for (const participantId of otherParticipants) {
      await notifyNewMessage(
        participantId,
        req.user._id,
        `${req.user.firstName} ${req.user.lastName}`,
        targetConv._id
      );
    }
  }

  emitToUser(req.user._id.toString(), 'message:forwarded', {
    messageId: original._id,
    targetConversationIds: targetConvs.map((c) => c._id),
  });

  sendResponse(res, 201, 'Message forwarded', forwardedMessages.length === 1 ? forwardedMessages[0] : forwardedMessages);
});

// ─── Get Unread Count ─────────────────────────────────────────────────────────
export const getUnreadCount = catchAsync(async (req, res) => {
  const conversations = await Conversation.find({ participants: req.user._id });
  const total = conversations.reduce((sum, conv) => {
    const unread = conv.unreadCounts.find((u) => u.user.toString() === req.user._id.toString());
    return sum + (unread?.count || 0);
  }, 0);
  sendResponse(res, 200, 'Unread count', { total });
});

// ─── Start Conversation (simple wrapper) ─────────────────────────────────────
export const startConversation = catchAsync(async (req, res) => {
  const { participantId } = req.body;

  if (!participantId) throw new ApiError(400, 'participantId is required');
  if (participantId === req.user._id.toString()) {
    throw new ApiError(400, 'Cannot start a conversation with yourself');
  }

  const otherUser = await User.findById(participantId).select('firstName lastName avatar role isOnline');
  if (!otherUser) throw new ApiError(404, 'User not found');

  // Only allow conversation creation when a legitimate relationship exists.
  await assertCanCommunicate(req.user._id, participantId);

  // Find existing direct conversation
  let conversation = await Conversation.findOne({
    type: 'direct',
    participants: { $all: [req.user._id, participantId], $size: 2 },
  });

  if (conversation && conversation.deletedFor.some((id) => id.toString() === req.user._id.toString())) {
    // Reuse the existing conversation and restore it to the user's list.
    conversation.deletedFor.pull(req.user._id);
    await conversation.save();
  }

  // Create if doesn't exist
  if (!conversation) {
    conversation = await Conversation.create({
      participants: [req.user._id, participantId],
      type: 'direct',
      unreadCounts: [
        { user: req.user._id, count: 0 },
        { user: participantId, count: 0 },
      ],
      metadata: {
        title: `${req.user.firstName} & ${otherUser.firstName}`,
      },
    });
  }

  await conversation.populate('participants', 'firstName lastName avatar isOnline lastSeen role');
  sendResponse(res, 200, 'Conversation ready', conversation);
});
