/**
 * Domain utilities for Organization auto-linking
 * Best practice: normalize domains for consistent matching
 */

/**
 * Extract domain from email address
 * @example extractDomainFromEmail("user@acme.com") => "acme.com"
 * @example extractDomainFromEmail("invalid") => null
 */
export function extractDomainFromEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf('@');

  if (atIndex === -1 || atIndex === trimmed.length - 1) {
    return null;
  }

  const domain = trimmed.slice(atIndex + 1);
  return normalizeDomain(domain);
}

/**
 * Normalize domain string for consistent storage and matching
 * - Remove http(s):// and www. prefix
 * - Convert to lowercase
 * - Remove trailing slash and path
 * - Remove spaces and invalid characters
 *
 * @example normalizeDomain("https://www.Acme.com/about") => "acme.com"
 * @example normalizeDomain("ACME.COM") => "acme.com"
 * @example normalizeDomain("user@acme.com") => "acme.com" (extracts from email)
 */
export function normalizeDomain(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  let domain = input.trim().toLowerCase();

  // If input looks like email, extract domain part
  if (domain.includes('@')) {
    const atIndex = domain.lastIndexOf('@');
    domain = domain.slice(atIndex + 1);
  }

  // Remove protocol (http://, https://, ftp://, etc)
  domain = domain.replace(/^[a-z]+:\/\//i, '');

  // Remove www. prefix
  domain = domain.replace(/^www\./i, '');

  // Remove path, query, hash (take only hostname)
  const slashIndex = domain.indexOf('/');
  if (slashIndex !== -1) {
    domain = domain.slice(0, slashIndex);
  }

  const questionIndex = domain.indexOf('?');
  if (questionIndex !== -1) {
    domain = domain.slice(0, questionIndex);
  }

  const hashIndex = domain.indexOf('#');
  if (hashIndex !== -1) {
    domain = domain.slice(0, hashIndex);
  }

  // Remove port if present
  const colonIndex = domain.indexOf(':');
  if (colonIndex !== -1) {
    domain = domain.slice(0, colonIndex);
  }

  // Remove spaces and control characters
  domain = domain.replace(/[\s\x00-\x1F\x7F]/g, '');

  // Basic validation: must contain at least one dot and valid characters
  if (!domain || !domain.includes('.')) {
    return null;
  }

  // Validate domain format (basic check)
  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
  if (!domainRegex.test(domain)) {
    return null;
  }

  return domain;
}

/**
 * Check if two domains match (after normalization)
 * @example domainsMatch("ACME.com", "acme.com") => true
 * @example domainsMatch("https://www.acme.com", "acme.com") => true
 */
export function domainsMatch(domain1: string, domain2: string): boolean {
  const normalized1 = normalizeDomain(domain1);
  const normalized2 = normalizeDomain(domain2);

  if (!normalized1 || !normalized2) {
    return false;
  }

  return normalized1 === normalized2;
}

/**
 * Validate that a string is a valid domain format
 * @example isValidDomain("acme.com") => true
 * @example isValidDomain("not-a-domain") => false
 */
export function isValidDomain(input: string): boolean {
  const normalized = normalizeDomain(input);
  return normalized !== null;
}
