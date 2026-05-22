const crypto = require('crypto');

/**
 * Deterministically maps a domain name string to a UUID format.
 * This allows us to store domains in PostgreSQL UUID columns without schema changes.
 * @param {string} domain 
 * @returns {string} A valid UUID string
 */
function domainToUUID(domain) {
  if (!domain) return null;
  const hash = crypto.createHash('md5').update(domain).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

module.exports = domainToUUID;
