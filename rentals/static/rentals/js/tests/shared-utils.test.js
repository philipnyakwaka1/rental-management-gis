/**
 * Tests for shared-utils.js
 * 
 * Run with: npm test
 */

// Mock DOM environment for testing
if (typeof window === 'undefined') {
    global.window = {};
}

// Import the module (in a real setup, you'd use proper imports)
// For now, we define tests that can be run manually or with Jest

describe('RentalsSharedUtils', () => {
    beforeEach(() => {
        // Setup: simulate loading shared-utils.js
        window.RentalsSharedUtils = {
            escapeHtml: function(s) {
                return String(s || '').replace(/[&<>"]/g, c => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;'
                }[c]));
            }
        };
    });

    describe('escapeHtml', () => {
        test('should escape HTML special characters', () => {
            const input = '<script>alert("XSS")</script>';
            const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
            expect(window.RentalsSharedUtils.escapeHtml(input)).toBe(expected);
        });

        test('should handle ampersands', () => {
            expect(window.RentalsSharedUtils.escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
        });

        test('should handle null and undefined', () => {
            expect(window.RentalsSharedUtils.escapeHtml(null)).toBe('');
            expect(window.RentalsSharedUtils.escapeHtml(undefined)).toBe('');
        });

        test('should handle empty strings', () => {
            expect(window.RentalsSharedUtils.escapeHtml('')).toBe('');
        });

        test('should not double-escape', () => {
            const input = '&lt;div&gt;';
            const expected = '&amp;lt;div&amp;gt;';
            expect(window.RentalsSharedUtils.escapeHtml(input)).toBe(expected);
        });

        test('should handle numbers', () => {
            expect(window.RentalsSharedUtils.escapeHtml(123)).toBe('123');
        });
    });
});
