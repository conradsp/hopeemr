# EMR Application - Styling Refactoring Plan

## Executive Summary

**Current State**: 135 inline style objects across 45 files
**Goal**: Replace all inline styles with a systematic, maintainable approach
**Recommended Approach**: **CSS Modules** with Mantine's Styles API as secondary
**Timeline**: 3-4 hours for complete refactoring

---

## Analysis: Choosing the Right Approach

### Option 1: Tailwind CSS ❌
**Pros:**
- Utility-first approach
- Fast development
- Good tooling

**Cons:**
- **NOT COMPATIBLE** with Mantine 7.x architecture
- Would require parallel styling systems
- Conflicts with Mantine's PostCSS setup
- Large bundle size increase
- Doesn't leverage existing Mantine theming

**Verdict**: ❌ **Not Recommended** - incompatible with current stack

### Option 2: CSS Modules ✅ (RECOMMENDED)
**Pros:**
- **Native support** in Vite (already configured)
- **Scoped styles** prevent conflicts
- **Type-safe** with TypeScript
- **Works seamlessly** with Mantine
- **Standard approach** used across Medplum codebase
- Leverages existing PostCSS configuration
- Clear separation of concerns
- Easy to maintain and debug

**Cons:**
- Requires creating CSS files
- Slightly more verbose than inline styles

**Verdict**: ✅ **RECOMMENDED** - Best fit for the project

### Option 3: Mantine Styles API 🟡
**Pros:**
- Built into Mantine
- Type-safe
- Access to theme variables
- Good for component-specific styles

**Cons:**
- More verbose for simple styles
- Still requires objects (similar to inline)
- Less reusable across components
- Harder to debug in DevTools

**Verdict**: 🟡 **Secondary** - Use for dynamic/theme-dependent styles only

---

## Recommended Strategy: CSS Modules + Mantine Styles API

### Primary Approach (90%): CSS Modules
Use for:
- Static styles
- Layout and positioning
- Common utility classes
- Component-specific styling
- Responsive design

### Secondary Approach (10%): Mantine Styles API
Use ONLY for:
- Dynamic styles based on props/state
- Theme-dependent colors
- Complex conditional styling

---

## Implementation Plan

### Phase 1: Setup & Infrastructure (15 min)

#### 1.1 Create Global Styles Structure
```
src/
├── styles/
│   ├── global.css          # Global styles, resets
│   ├── variables.css       # CSS custom properties
│   ├── utilities.css       # Utility classes
│   └── common.css          # Common component styles
```

#### 1.2 Update main.tsx
```tsx
import './styles/global.css';
import './styles/variables.css';
import './styles/utilities.css';
import './styles/common.css';
```

### Phase 2: Create Common Utility Classes (30 min)

Create reusable utility classes for:
- Spacing (margins, padding)
- Layout (flexbox, grid)
- Typography (sizes, weights)
- Colors (backgrounds, text)
- Shadows and borders
- Common patterns (cards, headers, etc.)

### Phase 3: Component-by-Component Refactoring (2-3 hours)

#### Priority Order:
1. **Admin Pages** (12 files) - 30 min
2. **Encounter Components** (15 files) - 45 min
3. **Patient Components** (8 files) - 30 min
4. **Shared Components** (5 files) - 20 min
5. **Scheduling Pages** (3 files) - 20 min
6. **Other Pages** (2 files) - 15 min

#### Refactoring Pattern:
For each component:
1. Create `.module.css` file alongside component
2. Move inline styles to CSS Module
3. Replace `style={{}}` with `className={styles.className}`
4. Import styles: `import styles from './Component.module.css';`
5. Test component rendering

### Phase 4: Quality Assurance & Cleanup (30 min)

1. Remove all unused inline `style` props
2. Verify responsive design still works
3. Check theme integration
4. Test in multiple browsers
5. Remove any duplicate styles

---

## Detailed Implementation Examples

### Example 1: Simple Style Replacement

**Before:**
```tsx
<div style={{ paddingTop: '20px', paddingBottom: '40px' }}>
  <Title>Page Title</Title>
</div>
```

**After:**
```tsx
// Component.tsx
import styles from './Component.module.css';

<div className={styles.container}>
  <Title>Page Title</Title>
</div>

// Component.module.css
.container {
  padding-top: 20px;
  padding-bottom: 40px;
}
```

### Example 2: Multiple Inline Styles

**Before:**
```tsx
<Paper shadow="sm" p="lg" withBorder style={{ marginTop: 0, maxWidth: 800, margin: '0 auto' }}>
  <IconSettings size={24} style={{ color: '#228be6' }} />
  <div style={{ textAlign: 'center' }}>
    Content
  </div>
</Paper>
```

**After:**
```tsx
// Component.tsx
import styles from './Component.module.css';

<Paper shadow="sm" p="lg" withBorder className={styles.paper}>
  <IconSettings size={24} className={styles.icon} />
  <div className={styles.centered}>
    Content
  </div>
</Paper>

// Component.module.css
.paper {
  margin-top: 0;
  max-width: 800px;
  margin: 0 auto;
}

.icon {
  color: var(--mantine-color-blue-6);
}

.centered {
  text-align: center;
}
```

### Example 3: Dynamic Styles with Mantine Styles API

**Use Case:** Conditional styling based on props/state

**Before:**
```tsx
<div style={{ color: isActive ? '#228be6' : '#666' }}>
  Status
</div>
```

**After:**
```tsx
import { useMantineTheme } from '@mantine/core';

const theme = useMantineTheme();

<div style={{ color: isActive ? theme.colors.blue[6] : theme.colors.gray[6] }}>
  Status
</div>

// OR with CSS Module + class toggling
<div className={isActive ? styles.active : styles.inactive}>
  Status
</div>

// Component.module.css
.active {
  color: var(--mantine-color-blue-6);
}

.inactive {
  color: var(--mantine-color-gray-6);
}
```

---

## Global Utility Classes to Create

### Layout Utilities
```css
/* utilities.css */

/* Containers */
.container-page {
  padding-top: 20px;
  padding-bottom: 40px;
}

.container-centered {
  max-width: 800px;
  margin: 0 auto;
}

/* Flexbox */
.flex {
  display: flex;
}

.flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.flex-column {
  display: flex;
  flex-direction: column;
}

.gap-xs { gap: 8px; }
.gap-sm { gap: 12px; }
.gap-md { gap: 16px; }
.gap-lg { gap: 24px; }

/* Text */
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

/* Spacing */
.mt-0 { margin-top: 0; }
.mt-xs { margin-top: 8px; }
.mt-sm { margin-top: 12px; }
.mt-md { margin-top: 16px; }
.mt-lg { margin-top: 24px; }

.mb-0 { margin-bottom: 0; }
.mb-xs { margin-bottom: 8px; }
.mb-sm { margin-bottom: 12px; }
.mb-md { margin-bottom: 16px; }
.mb-lg { margin-bottom: 24px; }

/* Width */
.w-full { width: 100%; }
.w-auto { width: auto; }
.max-w-800 { max-width: 800px; }

/* Common patterns */
.icon-primary { color: var(--mantine-color-blue-6); }
.icon-secondary { color: var(--mantine-color-gray-6); }
.icon-dimmed { color: var(--mantine-color-dimmed); }

.pointer { cursor: pointer; }
```

---

## CSS Variables (Theme Integration)

```css
/* variables.css */
:root {
  /* Colors from Mantine theme */
  --color-primary: var(--mantine-color-blue-6);
  --color-secondary: var(--mantine-color-gray-6);
  --color-success: var(--mantine-color-green-6);
  --color-warning: var(--mantine-color-yellow-6);
  --color-error: var(--mantine-color-red-6);
  --color-dimmed: var(--mantine-color-dimmed);

  /* Spacing */
  --spacing-xs: 8px;
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Layout */
  --page-padding: 20px 40px;
  --container-max-width: 800px;
  --table-action-width: 80px;
  --table-action-width-sm: 100px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}
```

---

## File Naming Convention

```
ComponentName.tsx          # Component file
ComponentName.module.css   # Component-specific styles
```

**Example:**
```
DiagnosisCodesPage.tsx
DiagnosisCodesPage.module.css
```

---

## TypeScript Integration

CSS Modules automatically generate TypeScript definitions:

```typescript
// Auto-generated ComponentName.module.css.d.ts
export const container: string;
export const header: string;
export const icon: string;
// ... all CSS classes
```

**Usage with autocomplete:**
```tsx
import styles from './Component.module.css';

// TypeScript provides autocomplete for styles.xxx
<div className={styles.container} />
```

---

## Migration Checklist

### Per Component:
- [ ] Create `.module.css` file
- [ ] Move all inline styles to CSS Module
- [ ] Replace `style={{}}` with `className={styles.xxx}`
- [ ] Use utility classes where appropriate
- [ ] Remove unused inline style props
- [ ] Test component rendering
- [ ] Check responsive behavior
- [ ] Verify theme colors

### Global:
- [ ] Create utility classes
- [ ] Create CSS variables
- [ ] Update main.tsx imports
- [ ] Document common patterns
- [ ] Create style guide

---

## Benefits of This Approach

### 1. **Maintainability**
- Centralized styles
- Easy to update and refactor
- Clear naming conventions

### 2. **Performance**
- CSS is parsed once
- No runtime style generation
- Better caching

### 3. **Developer Experience**
- TypeScript autocomplete
- Scoped styles (no conflicts)
- Easy to debug in DevTools
- Clear separation of concerns

### 4. **Consistency**
- Reusable utility classes
- Standardized spacing/colors
- Theme integration

### 5. **Scalability**
- Easy to add new components
- Simple to update global styles
- Predictable patterns

---

## Success Metrics

### Before:
- ✗ 135 inline style objects
- ✗ 45 files with inline styles
- ✗ Scattered styling logic
- ✗ Hard to maintain
- ✗ No reusability

### After:
- ✅ 0 inline style objects (except dynamic)
- ✅ All styles in CSS Modules
- ✅ Reusable utility classes
- ✅ Consistent patterns
- ✅ Easy to maintain

---

## Timeline Estimate

| Phase | Task | Time |
|-------|------|------|
| 1 | Setup & Infrastructure | 15 min |
| 2 | Common Utility Classes | 30 min |
| 3 | Admin Pages (12 files) | 30 min |
| 3 | Encounter Components (15 files) | 45 min |
| 3 | Patient Components (8 files) | 30 min |
| 3 | Shared Components (5 files) | 20 min |
| 3 | Scheduling Pages (3 files) | 20 min |
| 3 | Other Pages (2 files) | 15 min |
| 4 | QA & Cleanup | 30 min |
| **Total** | | **3h 30min** |

---

## Conclusion

**Recommended Approach: CSS Modules with utility classes**

This approach:
- ✅ Works seamlessly with existing Mantine setup
- ✅ Provides scoped, maintainable styles
- ✅ Supports TypeScript autocomplete
- ✅ Enables reusable utility classes
- ✅ Improves performance
- ✅ Easy to maintain and scale

**Next Step**: Begin implementation with Phase 1 (Setup & Infrastructure)

