# Multiple POI Filters Bug Fix - Complete Documentation

## Overview
Fixed a critical bug where multiple proximity filters were overwriting each other instead of applying AND logic. The issue was entirely on the **frontend** - the backend was already correctly configured.

---

## Problem Statement

### Symptom
When users applied multiple proximity filters (e.g., bus_stop=50m AND route=10000m), only the **last filter** was being applied. The first filter was silently discarded.

**Example:**
- User filters: bus_stop ≤ 50m → Returns 1 building ("Home Town Village")
- User adds: route ≤ 10000m → Returns multiple buildings
- **Expected:** Same 1 building (intersection of both filters)
- **Actual:** Multiple buildings (only route filter applied)

### Root Cause Analysis

#### Frontend Issue (CRITICAL)
**Location:** `rentals/static/rentals/js/map-ui.js`

The problem existed in **two functions** that both used `URLSearchParams.set()`:

```javascript
// WRONG - Line 106-110 (buildFilterParams function)
const params = new URLSearchParams();
const formData = new FormData(filtersForm);
for(const [key, value] of formData.entries()){
  if(value !== null && value !== undefined && String(value).trim() !== ''){
    params.set(key, String(value).trim());  // ← PROBLEM: set() overwrites!
  }
}

// WRONG - Line 114-119 (applyFiltersToUrl function)
const u = new URL(url, window.location.origin);
activeFilters.forEach((value, key) => {
  u.searchParams.set(key, value);  // ← PROBLEM: set() overwrites!
});
```

#### How URLSearchParams.set() Breaks Multiple Filters

When the form contains multiple inputs with the **same name** (which is intentional for dynamic filters):

```html
<select name="poi_type">bus_stop</select>
<input name="poi_radius" value="50">

<select name="poi_type">route</select>      <!-- Same name as above -->
<input name="poi_radius" value="10000">    <!-- Same name as above -->
```

The `FormData.entries()` correctly extracts all values:
```
poi_type: "bus_stop"
poi_radius: "50"
poi_type: "route"        ← Same key
poi_radius: "10000"      ← Same key
```

But `URLSearchParams.set()` has this behavior:
- **`.set(key, value)`** → Replaces ALL previous values for that key
- **`.append(key, value)`** → Adds value alongside existing values

**Loop execution with `.set()`:**
```
Iteration 1: set("poi_type", "bus_stop")  → params: {poi_type: "bus_stop"}
Iteration 2: set("poi_radius", "50")      → params: {poi_type: "bus_stop", poi_radius: "50"}
Iteration 3: set("poi_type", "route")     → params: {poi_type: "route", poi_radius: "50"}  ❌ LOST "bus_stop"!
Iteration 4: set("poi_radius", "10000")   → params: {poi_type: "route", poi_radius: "10000"}  ❌ LOST "50"!
```

**Result URL:** `?poi_type=route&poi_radius=10000` (only last filter sent)

#### Backend Status (Correctly Configured)
**Location:** `rentals/api/v1/views.py` (lines 443-520)

The backend **was already correct**:
- ✅ Uses `query_params.getlist('poi_type')` → Gets ALL values: `['bus_stop', 'route']`
- ✅ Uses `query_params.getlist('poi_radius')` → Gets ALL values: `['50', '10000']`
- ✅ Uses unique annotation names: `has_nearby_stops_0`, `has_nearby_routes_1`, etc.
- ✅ Applies filters with AND logic: `.filter(**{annotation_name: True})`

**But:** Backend never received all parameters because frontend only sent the last one.

---

## Solution Implemented

### Change 1: Fix buildFilterParams() Function
**File:** `rentals/static/rentals/js/map-ui.js`  
**Line:** 106

**Before:**
```javascript
params.set(key, String(value).trim());
```

**After:**
```javascript
params.append(key, String(value).trim());
```

**Effect:** Now all FormData entries are preserved in URLSearchParams:
```
?poi_type=bus_stop&poi_radius=50&poi_type=route&poi_radius=10000
```

### Change 2: Fix applyFiltersToUrl() Function
**File:** `rentals/static/rentals/js/map-ui.js`  
**Line:** 117

**Before:**
```javascript
u.searchParams.set(key, value);
```

**After:**
```javascript
u.searchParams.append(key, value);
```

**Effect:** Multiple filter parameters are preserved when applying filters to pagination URLs.

---

## How It Works Now

### Flow Diagram
```
User Form
  ↓
FormData (correctly contains all inputs)
  ↓
buildFilterParams() uses .append()
  ↓
URL with all parameters: ?poi_type=bus_stop&poi_radius=50&poi_type=route&poi_radius=10000
  ↓
Backend receives both filters via getlist()
  ↓
_apply_building_filters() applies AND logic with unique annotations
  ↓
Results: Buildings satisfying BOTH conditions
```

### Example Test Case
**Input:** bus_stop=50m AND route=10000m

**Query String:** `?poi_type=bus_stop&poi_radius=50&poi_type=route&poi_radius=10000`

**Backend Processing:**
```python
poi_types = ['bus_stop', 'route']
poi_radii = ['50', '10000']

# Filter iteration 1 (idx=0):
# annotation_name = 'has_nearby_stops_0'
# Filter buildings with bus stop ≤ 50m

# Filter iteration 2 (idx=1):
# annotation_name = 'has_nearby_routes_1'
# Filter results further: keep only those with route ≤ 10000m

# Final result: Intersection of both filters (AND logic)
```

---

## Backend Architecture (Why It Works)

### Unique Annotation Naming
The backend uses indexed annotation names to prevent filter overwrites:

```python
if poi_type == 'shops':
    annotation_name = f'has_nearby_shops_{idx}'  # idx prevents collisions
```

This ensures:
- Filter 1 creates annotation: `has_nearby_shops_0`
- Filter 2 creates annotation: `has_nearby_shops_1`
- No overwrites; both annotations exist in the queryset

### AND Logic Implementation
Each filter is chained with `.filter()`:
```python
queryset = queryset.annotate(**{annotation_name_0: ...}).filter(**{annotation_name_0: True})
queryset = queryset.annotate(**{annotation_name_1: ...}).filter(**{annotation_name_1: True})
```

This creates an implicit AND: buildings must match all filter conditions.

---

## Verification

### Before Fix
```
Frontend sends: ?poi_type=route&poi_radius=10000
Backend receives: Only route filter (bus_stop lost)
Result: Wrong buildings returned
```

### After Fix
```
Frontend sends: ?poi_type=bus_stop&poi_radius=50&poi_type=route&poi_radius=10000
Backend receives: Both filters via getlist()
Result: Correct buildings (satisfying both conditions)
```

---

## Testing Instructions

1. **Clear browser cache:** `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

2. **Test AND logic:**
   - Filter by: Bus stop ≤ 50m → Note the results
   - Add filter: Route ≤ 10000m → Should see equal or fewer buildings
   - Expected: Only buildings satisfying BOTH conditions

3. **Test multiple same-type filters:**
   - Add: Shops ≤ 100m
   - Add: Shops ≤ 500m
   - Expected: Stricter result (≤100m is subset of ≤500m)

4. **Verify URL in browser:**
   - Check DevTools Network tab
   - URL should contain: `?poi_type=...&poi_radius=...&poi_type=...&poi_radius=...`

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `rentals/static/rentals/js/map-ui.js` | 106 | Changed `params.set()` to `params.append()` |
| `rentals/static/rentals/js/map-ui.js` | 117 | Changed `u.searchParams.set()` to `u.searchParams.append()` |

---

## Technical Details

### URLSearchParams Behavior Reference
```javascript
// .set() - Replaces value (overwrites)
const params = new URLSearchParams();
params.set('type', 'A');
params.set('type', 'B');
console.log(params.toString()); // "type=B" (A lost!)

// .append() - Adds value (preserves)
const params = new URLSearchParams();
params.append('type', 'A');
params.append('type', 'B');
console.log(params.toString()); // "type=A&type=B" (both present!)
```

### Why Backend Wasn't Changed
The backend already used `getlist()` correctly:
```python
poi_types = query_params.getlist('poi_type')      # Gets: ['bus_stop', 'route']
poi_radii = query_params.getlist('poi_radius')    # Gets: ['50', '10000']
```

This correctly handles multiple parameters with the same name. The issue was that the frontend never sent multiple values to begin with.

---

## Impact Summary

✅ **Fixed:** Multiple proximity filters now apply AND logic correctly  
✅ **Working:** bus_stop + route + shops all work in combination  
✅ **Backward Compatible:** Single filters work exactly as before  
✅ **No Database Changes:** Pure frontend fix  
✅ **Performance:** No impact (same number of queries)  

---

## Related Code Components

### Form Structure (filters-form.js)
- Dynamically creates multiple select/input pairs
- Prevents selecting same POI type twice
- Each pair has `name="poi_type"` and `name="poi_radius"`

### Backend Filtering (views.py)
- `_apply_building_filters()` - Main filter logic
- `_get_all_nearby_pois()` - Fetches POI distances
- Uses `Exists()` subqueries for efficient distance filtering

### API Response
- Returns filtered buildings with nearby POIs
- Includes distance calculations for each POI

---

## Conclusion

The bug was a **URLSearchParams API misuse** on the frontend. Using `.set()` instead of `.append()` for multiple values with the same key silently discarded all but the last value. The fix was surgical (2 lines changed) but critical for multi-filter functionality. The backend was already production-ready with proper `getlist()` usage and indexed annotation names.
