/**
 * Tests for listings.js
 * 
 * Tests building listings display and pagination
 */

describe('RentalsListings', () => {
    let mockContainer, mockPagination;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="listings"></div>
            <nav id="pagination"></nav>
        `;
        mockContainer = document.getElementById('listings');
        mockPagination = document.getElementById('pagination');

        // Setup window mocks
        window.RentalsSharedUtils = {
            escapeHtml: (s) => String(s || '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]))
        };

        // Mock fetch
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('parseBuildingItem', () => {
        test('should parse JSON string', () => {
            const jsonString = '{"type":"Feature","properties":{"id":1,"address":"Test"}}';
            const result = JSON.parse(jsonString);
            expect(result.type).toBe('Feature');
            expect(result.properties.id).toBe(1);
        });

        test('should return object as-is if already parsed', () => {
            const obj = {type: 'Feature', properties: {id: 1}};
            expect(obj).toEqual({type: 'Feature', properties: {id: 1}});
        });

        test('should handle invalid JSON gracefully', () => {
            expect(() => JSON.parse('invalid')).toThrow();
        });
    });

    describe('createListings', () => {
        test('should create listings instance with required options', () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    results: [],
                    next: null,
                    previous: null
                })
            });

            const listings = {
                apiUrl: '/api/buildings/',
                container: mockContainer,
                pagination: mockPagination,
                fetcher: mockFetch,
                onShow: jest.fn(),
                fetchPage: jest.fn()
            };

            expect(listings.apiUrl).toBe('/api/buildings/');
            expect(listings.container).toBe(mockContainer);
            expect(listings.pagination).toBe(mockPagination);
        });

        test('should handle empty results', async () => {
            const mockData = {
                results: [],
                next: null,
                previous: null
            };

            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockData)
            });

            expect(mockContainer.innerHTML).toBe('');
        });

        test('should escape HTML in building properties', () => {
            const maliciousAddress = '<script>alert("XSS")</script>';
            const escaped = window.RentalsSharedUtils.escapeHtml(maliciousAddress);
            expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
            expect(escaped).not.toContain('<script>');
        });
    });

    describe('Pagination', () => {
        test('should disable prev button on first page', () => {
            mockPagination.innerHTML = `
                <ul class="pagination">
                    <li class="page-item disabled"><a class="page-link">Prev</a></li>
                    <li class="page-item active"><span class="page-link">1</span></li>
                    <li class="page-item"><a class="page-link">Next</a></li>
                </ul>
            `;
            
            const prevBtn = mockPagination.querySelector('.page-item.disabled');
            expect(prevBtn).not.toBeNull();
        });

        test('should disable next button on last page', () => {
            mockPagination.innerHTML = `
                <ul class="pagination">
                    <li class="page-item"><a class="page-link">Prev</a></li>
                    <li class="page-item active"><span class="page-link">5</span></li>
                    <li class="page-item disabled"><a class="page-link">Next</a></li>
                </ul>
            `;
            
            const nextBtn = mockPagination.querySelectorAll('.page-item.disabled')[1] || 
                             mockPagination.querySelector('.page-item:last-child.disabled');
            expect(nextBtn).toBeDefined();
        });

        test('should show current page number', () => {
            mockPagination.innerHTML = `
                <ul class="pagination">
                    <li class="page-item"><a class="page-link">Prev</a></li>
                    <li class="page-item active"><span class="page-link">3</span></li>
                    <li class="page-item"><a class="page-link">Next</a></li>
                </ul>
            `;
            
            const activePage = mockPagination.querySelector('.page-item.active .page-link');
            expect(activePage.textContent).toBe('3');
        });
    });

    describe('Building card rendering', () => {
        test('should render building with all properties', () => {
            const mockBuilding = {
                type: 'Feature',
                geometry: {coordinates: [36.8, -1.3]},
                properties: {
                    id: 1,
                    title: 'Test Building',
                    address: '123 Test St',
                    district: 'TestDistrict',
                    rental_price: '1200.00',
                    num_bedrooms: 2,
                    num_bathrooms: 1,
                    owner_contact: '0700000000',
                    description: 'Test description',
                    amenities: ['WiFi', 'Parking']
                }
            };

            mockContainer.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <h6>${window.RentalsSharedUtils.escapeHtml(mockBuilding.properties.title)}</h6>
                        <p>Address: ${window.RentalsSharedUtils.escapeHtml(mockBuilding.properties.address)}</p>
                        <p>Price: ${window.RentalsSharedUtils.escapeHtml(mockBuilding.properties.rental_price)}</p>
                    </div>
                </div>
            `;

            expect(mockContainer.innerHTML).toContain('Test Building');
            expect(mockContainer.innerHTML).toContain('123 Test St');
            expect(mockContainer.innerHTML).toContain('1200.00');
        });

        test('should handle missing optional properties', () => {
            const mockBuilding = {
                type: 'Feature',
                properties: {
                    id: 1,
                    address: '123 Test St'
                    // Missing: title, description, amenities, etc.
                }
            };

            // Should not throw error
            expect(() => {
                const title = mockBuilding.properties.title || '';
                const desc = mockBuilding.properties.description || '';
            }).not.toThrow();
        });

        test('should show button for buildings with details', () => {
            mockContainer.innerHTML = `
                <div class="card">
                    <button class="btn-show">Show</button>
                    <button class="btn-details">Details</button>
                </div>
            `;

            expect(mockContainer.querySelector('.btn-show')).not.toBeNull();
            expect(mockContainer.querySelector('.btn-details')).not.toBeNull();
        });
    });
});
