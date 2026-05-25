/**
 * Team Staff Module Constants (CommonJS version for Node.js)
 */

const ACCESS_TYPES = {
  READ: 'read',
  READ_WRITE: 'read_write',
  NO_ACCESS: 'no_access',
  ALL_ACCESS: 'all_access'
};

const MODULES = [
  'Inbox',
  'LeadCRM',
  'Campaigns',
  'Flows',
  'Drip Campaigns',
  'G+Automation',
  'Whatsapp Templates',
  'Integrations',
  'AI Buddy',
  'Gallery',
  'Contact List',
  'Contact Groups',
  'Pipelines',
  'Follow-up',
  'Form Builder',
  'Tags',
  'Input Fields',
  'Form Contact',
  'Whatsapp Forms'
];

const STAFF_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

module.exports = {
  ACCESS_TYPES,
  MODULES,
  STAFF_STATUS
};
