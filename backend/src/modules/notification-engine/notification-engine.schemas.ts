import { z } from 'zod';

export const ALLOWED_CHANNELS = ['IN_APP', 'WEB_PUSH', 'WHATSAPP', 'EMAIL'] as const;
export const RECIPIENT_TYPES = ['EMPLOYEE', 'DIRECT_MANAGER', 'HR', 'ADMIN', 'SPECIFIC_USER', 'ROLE', 'REQUESTER', 'EVENT_ACTOR'] as const;
export const VALID_ROLES_FOR_ROLE_RECIPIENT = ['ADMIN', 'HR', 'MANAGER', 'VIEWER'] as const;

const channelsSchema = z.array(z.enum(ALLOWED_CHANNELS))
  .min(1, 'Ao menos um canal é obrigatório.')
  .refine((channels) => new Set(channels).size === channels.length, {
    message: 'Canais não podem se repetir.',
  });

export const policyStepSchema = z.object({
  stepOrder: z.number().int().min(1),
  delayMinutes: z.number().int().min(0),
  recipientType: z.enum(RECIPIENT_TYPES),
  recipientReference: z.string().optional().nullable(),
  channels: channelsSchema,
  fallbackMode: z.enum(['PARALLEL', 'SEQUENTIAL']).default('PARALLEL'),
  stopOnAcknowledgment: z.boolean().default(true),
  stopOnResolution: z.boolean().default(true),
}).superRefine((step, ctx) => {
  if (step.recipientType === 'SPECIFIC_USER' && !step.recipientReference) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'recipientReference (userId) é obrigatório para SPECIFIC_USER.', path: ['recipientReference'] });
  }
  if (step.recipientType === 'ROLE' && !step.recipientReference) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'recipientReference (role) é obrigatório para ROLE.', path: ['recipientReference'] });
  }
  if (step.recipientType === 'ROLE' && step.recipientReference && !(VALID_ROLES_FOR_ROLE_RECIPIENT as readonly string[]).includes(step.recipientReference)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `role inválida: ${step.recipientReference}`, path: ['recipientReference'] });
  }
  // EMPLOYEE/DIRECT_MANAGER/HR/ADMIN/REQUESTER/EVENT_ACTOR never consult
  // recipientReference (see NotificationAudienceService) — an arbitrary
  // reference for these types is rejected outright rather than silently
  // ignored, so a policy author gets clear feedback instead of a stored
  // value that quietly does nothing.
  if (!['SPECIFIC_USER', 'ROLE'].includes(step.recipientType) && step.recipientReference) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `recipientReference não é utilizado para recipientType ${step.recipientType}; remova o valor.`, path: ['recipientReference'] });
  }
});

const policyBaseSchema = z.object({
  name: z.string().min(3).max(120),
  eventType: z.string().min(3),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
  acknowledgmentRequired: z.boolean().default(false),
  acknowledgmentTimeoutMinutes: z.number().int().min(1).optional().nullable(),
  maxEscalationLevel: z.number().int().min(1).default(1),
  quietHoursBehavior: z.enum(['DEFER', 'ALLOW_HIGH_PRIORITY', 'IGNORE']).default('DEFER'),
  steps: z.array(policyStepSchema).min(1, 'A política precisa de ao menos um step.'),
});

function checkUniqueStepOrders(policy: { steps: { stepOrder: number }[] }, ctx: z.RefinementCtx) {
  const orders = policy.steps.map((s) => s.stepOrder);
  if (new Set(orders).size !== orders.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'stepOrder deve ser único entre os steps.', path: ['steps'] });
  }
}

export const createPolicySchema = policyBaseSchema.superRefine(checkUniqueStepOrders);

export const updatePolicySchema = policyBaseSchema.partial().extend({
  isActive: z.boolean().optional(),
}).superRefine((policy, ctx) => {
  if (policy.steps) checkUniqueStepOrders(policy as { steps: { stepOrder: number }[] }, ctx);
});

export const testPolicySchema = z.object({
  dryRun: z.literal(true, { errorMap: () => ({ message: 'dryRun=true é obrigatório; esta rota nunca envia mensagens reais.' }) }),
  eventId: z.string().optional(),
  aggregateId: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

export const acknowledgeWorkflowSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const resolveWorkflowSchema = z.object({
  reasonCode: z.enum([
    'EMPLOYEE_CONTACTED',
    'ISSUE_RESOLVED',
    'FALSE_ALARM',
    'MANUAL_OVERRIDE',
    'DUPLICATE',
    'OTHER',
  ]),
  notes: z.string().max(500).optional(),
});

export const cancelWorkflowSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const workflowFiltersSchema = z.object({
  status: z.string().optional(),
  eventType: z.string().optional(),
  priority: z.string().optional(),
  recipientUserId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const quietHoursSchema = z.object({
  timezone: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime deve estar no formato HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime deve estar no formato HH:mm'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  isActive: z.boolean().default(true),
});
