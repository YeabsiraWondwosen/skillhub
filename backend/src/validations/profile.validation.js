import Joi from 'joi';

export const updateProfileSchema = Joi.object({
  bio: Joi.string().max(2000).allow('', null),
  tagline: Joi.string().max(150).allow('', null),
  hourlyRate: Joi.number().min(0).max(10000).allow(null),
  availability: Joi.string().valid('available', 'partially_available', 'not_available'),
  availabilityHoursPerWeek: Joi.number().min(0).max(168),
  yearsOfExperience: Joi.number().min(0).max(50).allow(null),
  responseTime: Joi.string().valid('within_hour', 'within_24h', 'within_48h', 'within_week'),
  workingHours: Joi.object({
    start: Joi.string().max(10).allow('', null),
    end: Joi.string().max(10).allow('', null),
    timezone: Joi.string().max(50).allow('', null),
  }),
  preferredContractType: Joi.string().valid('hourly', 'fixed', 'milestone'),
  preferredProjectSize: Joi.string().valid('small', 'medium', 'large'),
  visibility: Joi.object({
    showHourlyRate: Joi.boolean(),
    showEarnings: Joi.boolean(),
  }),
  privacy: Joi.object({
    showOnlineStatus: Joi.boolean(),
    allowDirectMessages: Joi.boolean(),
    showPortfolio: Joi.boolean(),
    showReviews: Joi.boolean(),
  }),
  preferredProjectTypes: Joi.array().items(Joi.string().valid('hourly', 'fixed', 'retainer')),
  hiringPreferences: Joi.object({
    allowFreelancerMessages: Joi.boolean(),
    notifyMatchingFreelancers: Joi.boolean(),
    notifyNewProposals: Joi.boolean(),
    notifyServiceUpdates: Joi.boolean(),
    preferredLanguage: Joi.string().valid('en', 'am').max(10),
    preferredPaymentCurrency: Joi.string().max(10),
  }),
  billing: Joi.object({
    defaultPaymentMethod: Joi.string().max(50).allow('', null),
    billingName: Joi.string().max(200).allow('', null),
    company: Joi.string().max(200).allow('', null),
    taxId: Joi.string().max(100).allow('', null),
    billingAddress: Joi.string().max(500).allow('', null),
    defaultInvoiceInfo: Joi.string().max(1000).allow('', null),
  }),
  skills: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().required(),
      level: Joi.string().valid('beginner', 'intermediate', 'advanced', 'expert').default('intermediate'),
      yearsOfExperience: Joi.number().min(0).max(50),
    })
  ).max(30),
  languages: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().required(),
      proficiency: Joi.string().valid('basic', 'conversational', 'professional', 'native').default('professional'),
    })
  ).max(10),
  categories: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).max(5),
  subcategories: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)),
  location: Joi.object({
    country: Joi.string().max(100).allow('', null),
    city: Joi.string().max(100).allow('', null),
    timezone: Joi.string().max(50).allow('', null),
  }),
  isPublic: Joi.boolean(),
});

export const addExperienceSchema = Joi.object({
  title: Joi.string().trim().min(2).max(100).required(),
  company: Joi.string().trim().min(2).max(100).required(),
  location: Joi.string().max(100).allow('', null),
  startDate: Joi.date().required(),
  endDate: Joi.date().allow(null).when('isCurrent', {
    is: true,
    then: Joi.date().allow(null),
    otherwise: Joi.date().greater(Joi.ref('startDate')).required(),
  }),
  isCurrent: Joi.boolean().default(false),
  description: Joi.string().max(1000).allow('', null),
  employmentType: Joi.string().valid('full_time', 'part_time', 'contract', 'freelance', 'internship').allow(null),
  technologies: Joi.array().items(Joi.string().trim()).max(30),
});

export const addEducationSchema = Joi.object({
  institution: Joi.string().trim().min(2).max(200).required(),
  degree: Joi.string().trim().min(2).max(100).required(),
  fieldOfStudy: Joi.string().max(100).allow('', null),
  startDate: Joi.date().required(),
  endDate: Joi.date().allow(null),
  isCurrent: Joi.boolean().default(false),
  description: Joi.string().max(500).allow('', null),
  grade: Joi.string().max(100).allow('', null),
});

export const addCertificationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  issuingOrganization: Joi.string().trim().min(2).max(200).required(),
  issueDate: Joi.date().allow(null),
  expirationDate: Joi.date().allow(null),
  credentialId: Joi.string().max(100).allow('', null),
  credentialUrl: Joi.string().uri().allow('', null),
});

export const addPortfolioSchema = Joi.object({
  title: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().max(1000).allow('', null),
  projectUrl: Joi.string().uri().allow('', null),
  repositoryUrl: Joi.string().uri().allow('', null),
  demoUrl: Joi.string().uri().allow('', null),
  clientName: Joi.string().max(100).allow('', null),
  category: Joi.string().max(100).allow('', null),
  technologies: Joi.array().items(Joi.string().trim()).max(20),
  skillsUsed: Joi.array().items(Joi.string().trim()).max(30),
  completedAt: Joi.date().allow(null),
  isFeatured: Joi.boolean().default(false),
});
