import {
  extractDomainFromEmail,
  normalizeDomain,
  domainsMatch,
  isValidDomain
} from '../domain';

describe('Domain utilities', () => {
  describe('extractDomainFromEmail', () => {
    it('should extract domain from valid email', () => {
      expect(extractDomainFromEmail('user@acme.com')).toBe('acme.com');
      expect(extractDomainFromEmail('john.doe@example.co.uk')).toBe('example.co.uk');
    });

    it('should return null for invalid email', () => {
      expect(extractDomainFromEmail('invalid')).toBe(null);
      expect(extractDomainFromEmail('no-at-sign.com')).toBe(null);
      expect(extractDomainFromEmail('user@')).toBe(null);
      expect(extractDomainFromEmail('')).toBe(null);
    });

    it('should handle uppercase and whitespace', () => {
      expect(extractDomainFromEmail(' USER@ACME.COM ')).toBe('acme.com');
    });
  });

  describe('normalizeDomain', () => {
    it('should remove protocol', () => {
      expect(normalizeDomain('https://acme.com')).toBe('acme.com');
      expect(normalizeDomain('http://acme.com')).toBe('acme.com');
      expect(normalizeDomain('ftp://acme.com')).toBe('acme.com');
    });

    it('should remove www prefix', () => {
      expect(normalizeDomain('www.acme.com')).toBe('acme.com');
      expect(normalizeDomain('WWW.ACME.COM')).toBe('acme.com');
    });

    it('should remove path and query', () => {
      expect(normalizeDomain('acme.com/about')).toBe('acme.com');
      expect(normalizeDomain('acme.com?query=1')).toBe('acme.com');
      expect(normalizeDomain('acme.com#hash')).toBe('acme.com');
      expect(normalizeDomain('acme.com/path?query=1#hash')).toBe('acme.com');
    });

    it('should remove port', () => {
      expect(normalizeDomain('acme.com:8080')).toBe('acme.com');
    });

    it('should convert to lowercase', () => {
      expect(normalizeDomain('ACME.COM')).toBe('acme.com');
      expect(normalizeDomain('AcMe.CoM')).toBe('acme.com');
    });

    it('should extract from email format', () => {
      expect(normalizeDomain('user@acme.com')).toBe('acme.com');
    });

    it('should handle complex URLs', () => {
      expect(normalizeDomain('https://www.acme.com:443/about?ref=1#section')).toBe('acme.com');
    });

    it('should return null for invalid domains', () => {
      expect(normalizeDomain('not-a-domain')).toBe(null);
      expect(normalizeDomain('no dot')).toBe(null);
      expect(normalizeDomain('')).toBe(null);
      expect(normalizeDomain('   ')).toBe(null);
    });
  });

  describe('domainsMatch', () => {
    it('should match equivalent domains', () => {
      expect(domainsMatch('acme.com', 'ACME.COM')).toBe(true);
      expect(domainsMatch('https://www.acme.com', 'acme.com')).toBe(true);
      expect(domainsMatch('acme.com/about', 'acme.com')).toBe(true);
    });

    it('should not match different domains', () => {
      expect(domainsMatch('acme.com', 'example.com')).toBe(false);
    });

    it('should return false for invalid domains', () => {
      expect(domainsMatch('invalid', 'acme.com')).toBe(false);
      expect(domainsMatch('acme.com', 'invalid')).toBe(false);
    });
  });

  describe('isValidDomain', () => {
    it('should validate correct domains', () => {
      expect(isValidDomain('acme.com')).toBe(true);
      expect(isValidDomain('sub.acme.com')).toBe(true);
      expect(isValidDomain('example.co.uk')).toBe(true);
    });

    it('should reject invalid domains', () => {
      expect(isValidDomain('not-a-domain')).toBe(false);
      expect(isValidDomain('')).toBe(false);
      expect(isValidDomain('no spaces.com')).toBe(false);
    });

    it('should handle URLs and extract domain', () => {
      expect(isValidDomain('https://www.acme.com/about')).toBe(true);
    });
  });
});
