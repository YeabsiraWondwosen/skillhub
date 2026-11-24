import { Catalog, Conversation, Application, Job, Project, User } from '../models/index.js';
import { ApiError } from '../utils/apiResponse.js';

/**
 * Single source of truth for who a user is allowed to message on SkillHub.
 *
 * A user may communicate with another user only when at least one legitimate
 * relationship exists between them:
 *   1. Existing conversation (continues to work even if the underlying
 *      relationship status later changes — see conversation policy).
 *   2. Accepted proposal/application.
 *   3. Active contract (job with a hired freelancer in a working state).
 *   4. Active project/engagement.
 *   5. Published service — the other user publicly offers a service on the
 *      marketplace, so potential clients may ask questions before ordering.
 *
 * Users who merely registered on the platform have NO relationship and must
 * not appear as contacts.
 */

// Job states that represent a real, active contract with a hired freelancer.
export const ACTIVE_CONTRACT_JOB_STATUSES = [
  'freelancer_selected',
  'payment_pending',
  'funded',
  'in_progress',
  'delivery_submitted',
  'client_review',
  'paused',
];

// Project states that do NOT represent an ongoing engagement.
export const INACTIVE_PROJECT_STATUSES = ['completed', 'cancelled', 'disputed'];

export const RELATIONSHIP_TYPES = {
  conversation: 'conversation',
  acceptedProposal: 'acceptedProposal',
  contract: 'contract',
  project: 'project',
  publishedService: 'publishedService',
};

// User-facing labels shown in the "New Conversation" UI.
export const RELATIONSHIP_LABELS = {
  [RELATIONSHIP_TYPES.conversation]: 'Existing Conversation',
  [RELATIONSHIP_TYPES.acceptedProposal]: 'Accepted Proposal',
  [RELATIONSHIP_TYPES.contract]: 'Active Contract',
  [RELATIONSHIP_TYPES.project]: 'Active Project',
  [RELATIONSHIP_TYPES.publishedService]: 'Published Service',
};

// When a user is connected by several relationships, show the strongest one.
const RELATIONSHIP_PRIORITY = {
  [RELATIONSHIP_TYPES.contract]: 4,
  [RELATIONSHIP_TYPES.project]: 3,
  [RELATIONSHIP_TYPES.acceptedProposal]: 2,
  [RELATIONSHIP_TYPES.conversation]: 1,
  [RELATIONSHIP_TYPES.publishedService]: 1,
};

const USER_SELECT = 'firstName lastName avatar role isOnline lastSeen isVerifiedFreelancer';

/**
 * Load all relationship data for a user and reduce it into a map of
 * `otherUserId -> { relationshipType, relationshipId }` using the strongest
 * relationship for each peer.
 */
async function buildRelationshipMap(userId) {
  const userIdStr = userId.toString();
  const map = new Map();

  const add = (other, type, relationshipId) => {
    if (!other) return;
    const key = other.toString();
    const existing = map.get(key);
    if (!existing || RELATIONSHIP_PRIORITY[type] > RELATIONSHIP_PRIORITY[existing.relationshipType]) {
      map.set(key, { relationshipType: type, relationshipId });
    }
  };

  // 1. Existing conversations (not deleted for the current user).
  const conversations = await Conversation.find({
    type: 'direct',
    participants: userId,
    deletedFor: { $ne: userId },
  }).select('participants userSettings').lean();

  const blockedUserIds = new Set();
  for (const conv of conversations) {
    const mySettings = (conv.userSettings || []).find(
      (s) => s.user.toString() === userIdStr
    );
    if (mySettings?.isBlocked) {
      const blocked = conv.participants.find((p) => p.toString() !== userIdStr);
      if (blocked) blockedUserIds.add(blocked.toString());
      continue;
    }
    const other = conv.participants.find((p) => p.toString() !== userIdStr);
    if (other) add(other, RELATIONSHIP_TYPES.conversation, conv._id);
  }

  // 2. Accepted proposals / applications.
  const acceptedApps = await Application.find({
    $or: [{ client: userId }, { freelancer: userId }],
    status: 'accepted',
  }).select('client freelancer').lean();

  for (const app of acceptedApps) {
    const other =
      app.client.toString() === userIdStr ? app.freelancer : app.client;
    add(other, RELATIONSHIP_TYPES.acceptedProposal, app._id);
  }

  // 3. Active contracts — jobs with a hired freelancer in a working state.
  const contracts = await Job.find({
    hiredFreelancer: { $ne: null },
    status: { $in: ACTIVE_CONTRACT_JOB_STATUSES },
    $or: [{ client: userId }, { hiredFreelancer: userId }],
  }).select('client hiredFreelancer').lean();

  for (const job of contracts) {
    const other =
      job.client.toString() === userIdStr ? job.hiredFreelancer : job.client;
    add(other, RELATIONSHIP_TYPES.contract, job._id);
  }

  // 4. Active projects / engagements.
  const projects = await Project.find({
    status: { $nin: INACTIVE_PROJECT_STATUSES },
    $or: [{ client: userId }, { freelancer: userId }],
  }).select('client freelancer').lean();

  for (const project of projects) {
    const other =
      project.client.toString() === userIdStr ? project.freelancer : project.client;
    add(other, RELATIONSHIP_TYPES.project, project._id);
  }

  // 5. Published services — the peer publicly offers a service on the
  //    marketplace, so this user may ask a pre-order question.
  const publishedServices = await Catalog.find({
    freelancer: { $ne: userId },
    status: 'active',
    isActive: true,
  }).select('freelancer').lean();

  for (const catalog of publishedServices) {
    add(catalog.freelancer, RELATIONSHIP_TYPES.publishedService, catalog._id);
  }

  return { map, blockedUserIds };
}

/**
 * Get the list of users the current user may start a conversation with.
 * Each entry describes the real relationship that makes them eligible.
 */
export async function getEligibleContacts(userId) {
  const { map, blockedUserIds } = await buildRelationshipMap(userId);

  if (map.size === 0) return [];

  const otherIds = [...map.keys()];
  const users = await User.find({
    _id: { $in: otherIds },
    isActive: true,
    isBanned: false,
  })
    .select(USER_SELECT)
    .lean();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const contacts = [];
  for (const [otherId, rel] of map) {
    if (blockedUserIds.has(otherId)) continue;
    const user = userMap.get(otherId);
    if (!user) continue;
    contacts.push({
      user,
      relationshipType: rel.relationshipType,
      relationshipId: rel.relationshipId,
      canMessage: true,
    });
  }

  // Stable ordering: strongest relationship first, then by name.
  contacts.sort((a, b) => {
    const p =
      RELATIONSHIP_PRIORITY[b.relationshipType] - RELATIONSHIP_PRIORITY[a.relationshipType];
    if (p !== 0) return p;
    return `${a.user.firstName} ${a.user.lastName}`.localeCompare(
      `${b.user.firstName} ${b.user.lastName}`
    );
  });

  return contacts;
}

/**
 * True when the current user has a legitimate relationship with the target
 * user (or an existing conversation between them). Does not rely on roles or
 * "everyone is a contact" fallbacks.
 */
export async function canCommunicate(currentUserId, otherUserId) {
  if (!otherUserId || currentUserId.toString() === otherUserId.toString()) {
    return false;
  }

  const { map } = await buildRelationshipMap(currentUserId);
  return map.has(otherUserId.toString());
}

/**
 * Throw a 403 when no legitimate relationship exists between the two users.
 */
export async function assertCanCommunicate(currentUserId, otherUserId) {
  if (currentUserId.toString() === otherUserId.toString()) {
    throw new ApiError(400, 'Cannot start a conversation with yourself');
  }

  const allowed = await canCommunicate(currentUserId, otherUserId);
  if (!allowed) {
    throw new ApiError(
      403,
      'You can only message users you have an active relationship with (accepted proposal, active contract, active project, or existing conversation).'
    );
  }
}
