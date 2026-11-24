import Joi from 'joi';

export const depositSchema = Joi.object({
  amount: Joi.number().min(10).max(50000).precision(2).required().messages({
    'number.min': 'Minimum deposit is 10 ETB',
    'number.max': 'Maximum single deposit is 50,000 ETB',
  }),
  currency: Joi.string().uppercase().default('ETB'),
  provider: Joi.string().valid('stripe', 'chapa').default('chapa'),
});

export const demoDepositSchema = Joi.object({
  amount: Joi.number().min(1).max(100000).precision(2).required().messages({
    'number.min': 'Minimum demo deposit is 1 ETB',
    'number.max': 'Maximum demo deposit is 100,000 ETB',
  }),
  currency: Joi.string().uppercase().default('ETB'),
});

export const telebirrDepositSchema = Joi.object({
  amount: Joi.number().min(10).max(500000).precision(2).required().messages({
    'number.min': 'Minimum deposit is 10 ETB',
    'number.max': 'Maximum single deposit is 500,000 ETB',
  }),
  currency: Joi.string().uppercase().default('ETB'),
  phone: Joi.string().pattern(/^\+?[\d\s-]{8,15}$/).optional().messages({
    'string.pattern.base': 'Invalid phone number format',
  }),
});

export const cbeBirrDepositSchema = Joi.object({
  amount: Joi.number().min(10).max(500000).precision(2).required().messages({
    'number.min': 'Minimum deposit is 10 ETB',
    'number.max': 'Maximum single deposit is 500,000 ETB',
  }),
  currency: Joi.string().uppercase().default('ETB'),
  accountNumber: Joi.string().min(8).max(20).optional().messages({
    'string.min': 'Account number must be at least 8 digits',
  }),
});

export const withdrawSchema = Joi.object({
  amount: Joi.number().min(10).max(50000).precision(2).required().messages({
    'number.min': 'Minimum withdrawal is 10 ETB',
  }),
  currency: Joi.string().uppercase().default('ETB'),
  method: Joi.string().valid('bank_transfer', 'paypal', 'stripe', 'chapa', 'telebirr', 'cbe_birr').required(),
  details: Joi.object().required(),
});

export const createEscrowSchema = Joi.object({
  freelancerId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  projectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  milestoneId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null, ''),
  amount: Joi.number().min(1).max(100000).precision(2).required(),
  currency: Joi.string().uppercase().default('ETB'),
  description: Joi.string().max(500).allow('', null),
});

export const releaseEscrowSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional(),
});

export const refundEscrowSchema = Joi.object({
  reason: Joi.string().max(500).allow('', null),
});

export const fundMilestoneSchema = Joi.object({
  milestoneId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
});

export const releaseMilestoneSchema = Joi.object({
  milestoneId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  rating: Joi.number().integer().min(1).max(5),
});
