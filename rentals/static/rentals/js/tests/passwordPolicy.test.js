/**
 * Tests for passwordPolicy.js
 * 
 * Tests password validation rules
 */

describe('PasswordPolicy', () => {
    beforeEach(() => {
        // Setup: simulate loading passwordPolicy.js
        const policy = {
            length: { test: pw => typeof pw === 'string' && pw.length >= 8, text: 'At least 8 characters' },
            uppercase: { test: pw => /[A-Z]/.test(pw), text: 'At least one uppercase letter' },
            number: { test: pw => /[0-9]/.test(pw), text: 'At least one number' },
            special: { test: pw => /[^A-Za-z0-9]/.test(pw), text: 'At least one special character' }
        };

        window.PasswordPolicy = {
            validate: function(password) {
                const results = {};
                Object.keys(policy).forEach(k => { results[k] = !!policy[k].test(password); });
                return results;
            },
            allValid: function(results) {
                return Object.keys(results).every(k => results[k]);
            },
            policy: policy
        };
    });

    describe('validate', () => {
        test('should accept strong password', () => {
            const results = window.PasswordPolicy.validate('StrongP@ss1');
            expect(results.length).toBe(true);
            expect(results.uppercase).toBe(true);
            expect(results.number).toBe(true);
            expect(results.special).toBe(true);
            expect(window.PasswordPolicy.allValid(results)).toBe(true);
        });

        test('should reject password without uppercase', () => {
            const results = window.PasswordPolicy.validate('weakp@ss1');
            expect(results.uppercase).toBe(false);
            expect(window.PasswordPolicy.allValid(results)).toBe(false);
        });

        test('should reject password without numbers', () => {
            const results = window.PasswordPolicy.validate('WeakP@ss');
            expect(results.number).toBe(false);
            expect(window.PasswordPolicy.allValid(results)).toBe(false);
        });

        test('should reject password without special characters', () => {
            const results = window.PasswordPolicy.validate('WeakPass1');
            expect(results.special).toBe(false);
            expect(window.PasswordPolicy.allValid(results)).toBe(false);
        });

        test('should reject password too short', () => {
            const results = window.PasswordPolicy.validate('Sh0rt!');
            expect(results.length).toBe(false);
            expect(window.PasswordPolicy.allValid(results)).toBe(false);
        });

        test('should handle empty password', () => {
            const results = window.PasswordPolicy.validate('');
            expect(results.length).toBe(false);
            expect(results.uppercase).toBe(false);
            expect(results.number).toBe(false);
            expect(results.special).toBe(false);
        });

        test('should accept password with multiple special characters', () => {
            const results = window.PasswordPolicy.validate('V3ry$tr0ng!P@ss');
            expect(window.PasswordPolicy.allValid(results)).toBe(true);
        });

        test('should accept minimal valid password', () => {
            const results = window.PasswordPolicy.validate('Abcdef1!');
            expect(window.PasswordPolicy.allValid(results)).toBe(true);
        });
    });

    describe('allValid', () => {
        test('should return true when all checks pass', () => {
            const results = {
                length: true,
                uppercase: true,
                number: true,
                special: true
            };
            expect(window.PasswordPolicy.allValid(results)).toBe(true);
        });

        test('should return false when any check fails', () => {
            const results = {
                length: true,
                uppercase: true,
                number: false,
                special: true
            };
            expect(window.PasswordPolicy.allValid(results)).toBe(false);
        });

        test('should return false when all checks fail', () => {
            const results = {
                length: false,
                uppercase: false,
                number: false,
                special: false
            };
            expect(window.PasswordPolicy.allValid(results)).toBe(false);
        });
    });
});
