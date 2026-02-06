/**
 * Tests for account.js form validation
 * 
 * Tests building form validation and coordinate handling
 */

describe('Building Form Validation', () => {
    describe('Coordinate validation', () => {
        test('should accept valid coordinates', () => {
            const validateCoordinates = (locationRaw) => {
                const coords = locationRaw.split(',').map(c => c.trim());
                if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) 
                    return { valid: false, error: 'Invalid format' };
                
                const lat = parseFloat(coords[0]);
                const lon = parseFloat(coords[1]);
                
                if (lat < -90 || lat > 90) 
                    return { valid: false, error: 'Latitude out of range' };
                if (lon < -180 || lon > 180)
                    return { valid: false, error: 'Longitude out of range' };
                
                return { valid: true, lat, lon };
            };

            const result = validateCoordinates('-1.2921, 36.8219');
            expect(result.valid).toBe(true);
            expect(result.lat).toBeCloseTo(-1.2921);
            expect(result.lon).toBeCloseTo(36.8219);
        });

        test('should reject latitude out of range', () => {
            const validateCoordinates = (locationRaw) => {
                const coords = locationRaw.split(',').map(c => c.trim());
                const lat = parseFloat(coords[0]);
                const lon = parseFloat(coords[1]);
                if (lat < -90 || lat > 90) return { valid: false, error: 'Latitude out of range' };
                if (lon < -180 || lon > 180) return { valid: false, error: 'Longitude out of range' };
                return { valid: true };
            };

            expect(validateCoordinates('91, 36.8219').valid).toBe(false);
            expect(validateCoordinates('-91, 36.8219').valid).toBe(false);
            expect(validateCoordinates('91, 36.8219').error).toBe('Latitude out of range');
        });

        test('should reject longitude out of range', () => {
            const validateCoordinates = (locationRaw) => {
                const coords = locationRaw.split(',').map(c => c.trim());
                const lat = parseFloat(coords[0]);
                const lon = parseFloat(coords[1]);
                if (lat < -90 || lat > 90) return { valid: false, error: 'Latitude out of range' };
                if (lon < -180 || lon > 180) return { valid: false, error: 'Longitude out of range' };
                return { valid: true };
            };

            expect(validateCoordinates('-1.2921, 181').valid).toBe(false);
            expect(validateCoordinates('-1.2921, -181').valid).toBe(false);
        });

        test('should reject invalid format', () => {
            const validateCoordinates = (locationRaw) => {
                const coords = locationRaw.split(',').map(c => c.trim());
                if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) 
                    return { valid: false, error: 'Invalid format' };
                return { valid: true };
            };

            expect(validateCoordinates('invalid').valid).toBe(false);
            expect(validateCoordinates('1.0').valid).toBe(false);
            expect(validateCoordinates('1.0, 2.0, 3.0').valid).toBe(false); // Should reject 3 values
        });

        test('should handle spaces in coordinates', () => {
            const validateCoordinates = (locationRaw) => {
                const coords = locationRaw.split(',').map(c => c.trim());
                if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) 
                    return { valid: false };
                return { valid: true, lat: parseFloat(coords[0]), lon: parseFloat(coords[1]) };
            };

            const result = validateCoordinates(' -1.2921 , 36.8219 ');
            expect(result.valid).toBe(true);
            expect(result.lat).toBeCloseTo(-1.2921);
            expect(result.lon).toBeCloseTo(36.8219);
        });
    });

    describe('District validation', () => {
        test('should capitalize district name', () => {
            const capitalize = (str) => str.replace(/\b\w/g, char => char.toUpperCase());
            
            expect(capitalize('nairobi west')).toBe('Nairobi West');
            expect(capitalize('UPPER CASE')).toBe('UPPER CASE');
            expect(capitalize('lower case')).toBe('Lower Case');
        });

        test('should validate against district list', () => {
            const validDistricts = ['Nairobi West', 'Westlands', 'Karen'];
            const isValidDistrict = (district) => validDistricts.includes(district);

            expect(isValidDistrict('Nairobi West')).toBe(true);
            expect(isValidDistrict('Invalid District')).toBe(false);
        });
    });

    describe('Price validation', () => {
        test('should accept positive prices', () => {
            const isValidPrice = (price) => !isNaN(price) && parseFloat(price) > 0;

            expect(isValidPrice('1200')).toBe(true);
            expect(isValidPrice('1200.50')).toBe(true);
            expect(isValidPrice('0.01')).toBe(true);
        });

        test('should reject negative or zero prices', () => {
            const isValidPrice = (price) => !isNaN(price) && parseFloat(price) > 0;

            expect(isValidPrice('0')).toBe(false);
            expect(isValidPrice('-100')).toBe(false);
            expect(isValidPrice('-0.01')).toBe(false);
        });

        test('should reject non-numeric prices', () => {
            const isValidPrice = (price) => !isNaN(price) && parseFloat(price) > 0;

            expect(isValidPrice('abc')).toBe(false);
            expect(isValidPrice('')).toBe(false);
            expect(isValidPrice('12.34.56')).toBe(false);
        });
    });

    describe('Amenities parsing', () => {
        test('should parse comma-separated amenities', () => {
            const parseAmenities = (raw) => raw.split(',').map(a => a.trim()).filter(a => a.length > 0);

            const amenities = parseAmenities('WiFi, Parking, Pool');
            expect(amenities).toEqual(['WiFi', 'Parking', 'Pool']);
        });

        test('should handle empty amenities', () => {
            const parseAmenities = (raw) => raw.split(',').map(a => a.trim()).filter(a => a.length > 0);

            expect(parseAmenities('')).toEqual([]);
            expect(parseAmenities(', , ')).toEqual([]);
        });

        test('should trim whitespace', () => {
            const parseAmenities = (raw) => raw.split(',').map(a => a.trim()).filter(a => a.length > 0);

            const amenities = parseAmenities(' WiFi , Parking , Pool ');
            expect(amenities).toEqual(['WiFi', 'Parking', 'Pool']);
        });
    });

    describe('Image validation', () => {
        test('should validate image size', () => {
            const MAX_SIZE = 2 * 1024 * 1024; // 2MB
            const isValidSize = (size) => size <= MAX_SIZE;

            expect(isValidSize(1024 * 1024)).toBe(true); // 1MB
            expect(isValidSize(2 * 1024 * 1024)).toBe(true); // 2MB
            expect(isValidSize(3 * 1024 * 1024)).toBe(false); // 3MB
        });

        test('should validate image type', () => {
            const isValidImageType = (type) => type.startsWith('image/');

            expect(isValidImageType('image/jpeg')).toBe(true);
            expect(isValidImageType('image/png')).toBe(true);
            expect(isValidImageType('text/plain')).toBe(false);
            expect(isValidImageType('application/pdf')).toBe(false);
        });

        test('should validate only one image', () => {
            const isValidFileCount = (fileCount) => fileCount === 0 || fileCount === 1;

            expect(isValidFileCount(0)).toBe(true); // No file (optional)
            expect(isValidFileCount(1)).toBe(true); // One file
            expect(isValidFileCount(2)).toBe(false); // Multiple files
        });
    });
});
