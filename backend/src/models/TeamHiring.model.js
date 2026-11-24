import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const teamMemberSchema = new Schema(
  {
    freelancer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true },
    roleDescription: { type: String, maxlength: 1000 },
    hourlyRate: { type: Number, min: 0 },
    weeklyHours: { type: Number, min: 0, max: 60 },
    responsibilities: [String],
    requiredSkills: [String],
    status: {
      type: String,
      enum: ['pending', 'invited', 'accepted', 'declined', 'active', 'paused', 'removed'],
      default: 'pending',
    },
    invitation: {
      email: String,
      message: String,
      invitedAt: Date,
      expiresAt: Date,
      token: String,
    },
    permissions: {
      canManageMembers: { type: Boolean, default: false },
      canManageBudget: { type: Boolean, default: false },
      canManageMilestones: { type: Boolean, default: false },
      canViewAllTasks: { type: Boolean, default: true },
      canInviteOthers: { type: Boolean, default: false },
    },
    performance: {
      tasksCompleted: { type: Number, default: 0 },
      tasksTotal: { type: Number, default: 0 },
      avgRating: { type: Number, min: 0, max: 5, default: 0 },
      reviewCount: { type: Number, default: 0 },
      reliabilityScore: { type: Number, min: 0, max: 100, default: 50 },
    },
    joinedAt: { type: Date },
    removedAt: { type: Date },
    removedReason: String,
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true, timestamps: true }
);

const teamTaskSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedRole: String,
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'review', 'done', 'blocked'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    dueDate: Date,
    estimatedHours: Number,
    actualHours: Number,
    dependencies: [{ type: Schema.Types.ObjectId }],
    comments: [
      {
        author: { type: Schema.Types.ObjectId, ref: 'User' },
        content: { type: String, maxlength: 2000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    completedAt: Date,
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true, timestamps: true }
);

const teamMessageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 5000 },
    type: {
      type: String,
      enum: ['text', 'announcement', 'system', 'file'],
      default: 'text',
    },
    attachments: [
      {
        name: String,
        url: String,
        type: String,
        size: Number,
      },
    ],
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: true, timestamps: true }
);

const teamBudgetSchema = new Schema(
  {
    totalBudget: { type: Number, required: true, min: 0 },
    spentBudget: { type: Number, default: 0, min: 0 },
    allocations: [
      {
        member: { type: Schema.Types.ObjectId, ref: 'User' },
        amount: { type: Number, min: 0 },
        hourlyRate: Number,
        weeklyHours: Number,
        reason: String,
      },
    ],
    expenses: [
      {
        description: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 },
        paidTo: { type: Schema.Types.ObjectId, ref: 'User' },
        category: { type: String, enum: ['salary', 'tools', 'infrastructure', 'other'], default: 'salary' },
        date: { type: Date, default: Date.now },
        receiptUrl: String,
        approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        approvedAt: Date,
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      },
    ],
    currency: { type: String, default: 'ETB' },
    budgetAlerts: {
      enabled: { type: Boolean, default: true },
      threshold: { type: Number, min: 0, max: 100, default: 80 },
    },
  },
  { _id: false }
);

const teamHiringSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 5000 },
    requiredRoles: [
      {
        title: { type: String, required: true },
        description: String,
        skills: [String],
        minExperience: Number,
        maxRate: Number,
        hoursPerWeek: Number,
        urgency: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        filled: { type: Boolean, default: false },
      },
    ],
    members: [teamMemberSchema],
    tasks: [teamTaskSchema],
    messages: [teamMessageSchema],
    budget: teamBudgetSchema,
    status: {
      type: String,
      enum: ['planning', 'recruiting', 'active', 'on_hold', 'completed', 'cancelled'],
      default: 'planning',
    },
    startDate: Date,
    endDate: Date,
    timezone: String,
    communicationChannels: [
      {
        platform: { type: String, enum: ['slack', 'discord', 'teams', 'zoom', 'other'] },
        url: String,
        name: String,
      },
    ],
    teamRules: {
      meetingSchedule: String,
      codeReviewPolicy: String,
      responseTimeExpectation: String,
      escalationProcess: String,
    },
    milestones: [
      {
        title: { type: String, required: true },
        description: String,
        dueDate: Date,
        budget: Number,
        status: { type: String, enum: ['pending', 'in_progress', 'completed', 'overdue'], default: 'pending' },
        completedAt: Date,
      },
    ],
    aiRecommendations: {
      generatedAt: Date,
      suggestedRoles: [
        {
          title: String,
          skills: [String],
          reason: String,
          estimatedRate: Number,
        },
      ],
      riskFactors: [String],
      estimatedTimeline: String,
      teamCompositionScore: Number,
    },
  },
  { timestamps: true }
);

teamHiringSchema.index({ client: 1, status: 1 });
teamHiringSchema.index({ project: 1 });
teamHiringSchema.index({ 'members.freelancer': 1 });
teamHiringSchema.index({ 'members.status': 1 });

export default model('TeamHiring', teamHiringSchema);
