export const ACCURACY_CLASSES = ['I', 'II', 'III', 'IIII'];

export const ACCURACY_CLASS_LABELS = {
  I: 'Class I — Special accuracy',
  II: 'Class II — High accuracy',
  III: 'Class III — Medium accuracy',
  IIII: 'Class IIII — Ordinary accuracy',
};

/** Conversion factor from each unit to grams (strings keep decimal.js exact). */
export const UNIT_FACTORS = {
  mg: '0.001',
  g: '1',
  kg: '1000',
  t: '1000000',
};

export const VERIFICATION_TYPES = {
  INITIAL: 'initial',
  IN_SERVICE: 'inService',
};

export const RECORD_STATUS = {
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

export const RECORD_STATUS_LABELS = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In process',
  SUBMITTED: 'Awaiting approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/** Statuses in which a technician may still change observations. */
export const EDITABLE_STATUSES = [RECORD_STATUS.DRAFT, RECORD_STATUS.IN_PROGRESS, RECORD_STATUS.REJECTED];

export const COMPLIANCE = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PENDING: 'PENDING',
  NOT_APPLICABLE: 'NA',
};

export const TEST_TYPES = {
  ZERO_SETTING: 'zeroSetting',
  WEIGHING: 'weighingPerformance',
  ECCENTRICITY: 'eccentricity',
  REPEATABILITY: 'repeatability',
  DISCRIMINATION: 'discrimination',
  TARE: 'tare',
};

/**
 * How the error of indication is obtained:
 * - changepoint: small additional weights ΔL are added until the display steps up (R 76-1 A.4.4.3)
 * - direct: E = I − L, acceptable where the display resolution d is finer than e
 */
export const ERROR_METHODS = {
  CHANGEPOINT: 'changepoint',
  DIRECT: 'direct',
};

export const TARE_DEVICES = {
  NONE: 'none',
  SUBTRACTIVE: 'subtractive',
  ADDITIVE: 'additive',
};

export const ATTACHMENT_KINDS = {
  PHOTO: 'photo',
};

export const ROLES = {
  TECHNICIAN: 'technician',
  INSPECTOR: 'inspector',
  ADMIN: 'admin',
};
