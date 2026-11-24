import Joi from 'joi';

export const sendMessageSchema = Joi.object({
  content: Joi.string().max(5000).when('messageType', {
    is: Joi.valid('text', 'system'),
    then: Joi.required(),
    otherwise: Joi.optional().allow('', null),
  }),
  messageType: Joi.string()
    .valid('text', 'file', 'image', 'offer', 'milestone')
    .default('text'),
  replyTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null),
  metadata: Joi.object().default({}),
});

export const createConversationSchema = Joi.object({
  participantId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  type: Joi.string().valid('direct', 'project').default('direct'),
  projectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).when('type', {
    is: 'project',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  initialMessage: Joi.string().max(5000).allow('', null),
});
