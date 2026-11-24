import { ProjectPlan, Project, Milestone } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError, sendResponse, paginationMeta } from '../utils/apiResponse.js';
import { generateProjectPlan } from '../services/projectPlanner.service.js';
import { isDateOnlyInPast } from '../utils/dateValidation.js';

export const createPlan = catchAsync(async (req, res) => {
  const { projectDescription, projectName, budget, deadline, teamSize } = req.body;

  if (deadline) {
    const deadlineCheck = isDateOnlyInPast(deadline);
    if (!deadlineCheck.valid) {
      throw new ApiError(400, deadlineCheck.message);
    }
  }

  const planData = await generateProjectPlan(projectDescription, { projectName, budget, deadline, teamSize });

  const plan = await ProjectPlan.create({
    user: req.user._id,
    projectDescription,
    projectName: projectName || 'Untitled Project',
    budget,
    deadline,
    teamSize,
    ...planData,
    status: 'completed',
    plannedAt: new Date(),
  });

  sendResponse(res, 201, 'Project plan generated successfully', plan);
});

export const getMyPlans = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const [plans, total] = await Promise.all([
    ProjectPlan.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProjectPlan.countDocuments({ user: req.user._id }),
  ]);

  sendResponse(res, 200, 'Your project plans', plans, paginationMeta(total, page, limit));
});

export const getPlanById = catchAsync(async (req, res) => {
  const plan = await ProjectPlan.findById(req.params.planId)
    .populate('user', 'firstName lastName');

  if (!plan) throw new ApiError(404, 'Project plan not found');
  if (plan.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to view this plan');
  }

  sendResponse(res, 200, 'Project plan retrieved', plan);
});

export const deletePlan = catchAsync(async (req, res) => {
  const plan = await ProjectPlan.findById(req.params.planId);

  if (!plan) throw new ApiError(404, 'Project plan not found');
  if (plan.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to delete this plan');
  }

  await ProjectPlan.findByIdAndDelete(req.params.planId);
  sendResponse(res, 200, 'Project plan deleted successfully');
});

export const convertToProject = catchAsync(async (req, res) => {
  const { planId } = req.params;
  const { projectId } = req.body;

  const plan = await ProjectPlan.findById(planId);
  if (!plan) throw new ApiError(404, 'Project plan not found');
  if (plan.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }

  let project;
  if (projectId) {
    project = await Project.findById(projectId);
    if (!project) throw new ApiError(404, 'Project not found');
    if (project.client.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new ApiError(403, 'Not authorized to modify this project');
    }
  }

  const createdMilestones = [];

  for (const milestoneData of plan.milestones) {
    const dueDate = milestoneData.dueDate || new Date(Date.now() + milestoneData.estimatedDuration * 7 * 24 * 60 * 60 * 1000);

    if (project) {
      const milestone = await Milestone.create({
        project: project._id,
        client: req.user._id,
        freelancer: project.freelancer || req.user._id,
        title: milestoneData.title,
        description: milestoneData.description,
        amount: Math.round((plan.budget || 1000) / plan.totalMilestones),
        dueDate,
        order: milestoneData.order,
        status: 'pending',
      });

      for (let i = 0; i < milestoneData.tasks.length; i++) {
        const taskData = milestoneData.tasks[i];
        project.tasks.push({
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          status: 'todo',
          order: i,
        });
      }

      createdMilestones.push(milestone);
    }
  }

  if (project) {
    await project.save();
  }

  const result = {
    milestones: createdMilestones,
    tasksAdded: project ? plan.milestones.reduce((s, m) => s + m.tasks.length, 0) : 0,
    projectName: project?.title || plan.projectName,
  };

  sendResponse(res, 201, 'Plan converted to project milestones', result);
});

export const getUserProjects = catchAsync(async (req, res) => {
  const projects = await Project.find({
    $or: [{ client: req.user._id }, { freelancer: req.user._id }],
  })
    .select('title status client freelancer')
    .populate('client', 'firstName lastName')
    .populate('freelancer', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  sendResponse(res, 200, 'Your projects', projects);
});
