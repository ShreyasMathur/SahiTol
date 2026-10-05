import { ROLES, RECORD_STATUS } from './constants.js';

const { TECHNICIAN, INSPECTOR, ADMIN } = ROLES;
const ALL = [TECHNICIAN, INSPECTOR, ADMIN];

export const PERMISSIONS = {
  'record:view': ALL,
  'record:create': [TECHNICIAN, ADMIN],
  'record:edit': [TECHNICIAN, ADMIN],
  'record:submit': [TECHNICIAN, ADMIN],
  'record:review': [INSPECTOR, ADMIN],
  'record:revise': [TECHNICIAN, ADMIN],
  'report:export': ALL,
  'weights:view': ALL,
  'weights:manage': [ADMIN],
  'users:manage': [ADMIN],
};

export function can(role, permission) {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}

/** Record workflow: which action moves a record from which statuses, and who may do it. */
export const WORKFLOW = {
  submit: {
    label: 'Submit for approval',
    from: [RECORD_STATUS.DRAFT, RECORD_STATUS.IN_PROGRESS, RECORD_STATUS.REJECTED],
    to: RECORD_STATUS.SUBMITTED,
    permission: 'record:submit',
  },
  approve: {
    label: 'Approve',
    from: [RECORD_STATUS.SUBMITTED],
    to: RECORD_STATUS.APPROVED,
    permission: 'record:review',
  },
  reject: {
    label: 'Reject',
    from: [RECORD_STATUS.SUBMITTED],
    to: RECORD_STATUS.REJECTED,
    permission: 'record:review',
  },
};

export function availableActions(role, status) {
  return Object.entries(WORKFLOW)
    .filter(([, a]) => a.from.includes(status) && can(role, a.permission))
    .map(([key, a]) => ({ key, ...a }));
}
