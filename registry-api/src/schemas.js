const { z } = require('zod');
const { SERIAL_REGEX } = require('./utils/serial');

const DOCUMENT_TYPES = ['official_transcript', 'certificate_copy', 'verification_letter'];
const DELIVERY_METHODS = ['pickup', 'email', 'courier'];
const STATUSES = ['pending', 'approved', 'rejected', 'ready'];

const loginSchema = z.object({
  username: z.string({ required_error: 'username is required' }).trim().min(1, 'username is required'),
  password: z.string({ required_error: 'password is required' }).min(1, 'password is required'),
});

const createRequestSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES, { errorMap: () => ({ message: `documentType must be one of: ${DOCUMENT_TYPES.join(', ')}` }) }),
  deliveryMethod: z.enum(DELIVERY_METHODS, { errorMap: () => ({ message: `deliveryMethod must be one of: ${DELIVERY_METHODS.join(', ')}` }) }),
  reason: z.string({ required_error: 'reason is required' }).trim().min(5, 'reason must be at least 5 characters').max(200, 'reason must be at most 200 characters'),
});

const idParamSchema = z.object({ id: z.string().uuid('id must be a valid request id') });

const listQuerySchema = z.object({
  status: z.enum(STATUSES, { errorMap: () => ({ message: `status must be one of: ${STATUSES.join(', ')}` }) }).optional(),
});

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected'], { errorMap: () => ({ message: 'status must be either approved or rejected' }) }),
  reason: z.string().trim().max(200, 'reason must be at most 200 characters').optional(),
}).refine((d) => d.status !== 'rejected' || (d.reason && d.reason.length >= 3), {
  path: ['reason'],
  message: 'A reason is required when rejecting a request',
});

const issueDocumentSchema = z.object({
  requestId: z.string({ required_error: 'requestId is required' }).uuid('requestId must be a valid request id'),
});

const serialParamSchema = z.object({
  serial: z.string().trim().toUpperCase().regex(SERIAL_REGEX, 'Serial must look like MUST-TR-2026-A7K93Q'),
});

module.exports = {
  loginSchema, createRequestSchema, idParamSchema, listQuerySchema,
  reviewSchema, issueDocumentSchema, serialParamSchema,
};
