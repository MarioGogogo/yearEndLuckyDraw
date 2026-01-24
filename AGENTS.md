# AGENTS.md - Development Guidelines for This Repository

## Project Overview

This is a Vue 3 + Vite lottery configuration application with Chinese UI. The app manages prize configurations, participant lists, and lottery records with Excel import/export support.

## Build Commands

```bash
# Install dependencies (uses bun, but npm also works)
bun install

# Development server with hot reload
bun run dev
# or: npm run dev

# Build for production
bun run build
# or: npm run build

# Preview production build
bun run preview
# or: npm run preview
```

There are no test files in this repository. Do not attempt to run tests.

## Code Style Guidelines

### Vue Components

- Use `<script setup>` syntax for all Vue components
- Import order: Vue APIs first, then external libraries, then local components
- Use `defineProps` with object syntax for type definitions
- Use `defineEmits` for component events
- Prefix component refs with component name (e.g., `fileInput`, `prizeConfig`)
- Use composition API: `ref`, `computed`, `watch`, `onMounted`, `onUnmounted`

### JavaScript Conventions

- **Constants**: UPPER_SNAKE_CASE (e.g., `STORAGE_KEY`, `DEFAULT_CONFIG`)
- **Functions**: camelCase (e.g., `handleFile`, `loadFromCache`)
- **Variables**: camelCase (e.g., `isDragging`, `uploadProgress`)
- **Booleans**: Prefix with `is`, `has`, `can` (e.g., `isValid`, `hasData`)
- **Component refs**: Component type name as suffix (e.g., `fileInput`, `modalRef`)

### Error Handling

- Wrap I/O operations (localStorage, file reading) in try-catch blocks
- Log errors with `console.error('message:', error)`
- Show user-friendly alerts for validation errors
- Do not expose internal errors to users

### Data Types and Validation

- Use simple prop types: `String`, `Number`, `Boolean`, `Array`, `Object`, `Function`
- Default values for props: use factory functions for arrays/objects (`default: () => []`)
- Validate file types before processing uploads
- Filter invalid data during import (e.g., empty names)

### Import Conventions

```javascript
// Correct import order
import { ref, computed, onMounted, watch } from 'vue'
import * as XLSX from 'xlsx'
import ComponentName from './ComponentName.vue'
```

### Naming Conventions

- **Files**: PascalCase for components (e.g., `PrizeConfig.vue`), kebab-case for utilities
- **CSS classes**: kebab-case (e.g., `upload-zone`, `participant-list`)
- **Component props**: camelCase
- **Event handlers**: `handle` + Action name (e.g., `handleFile`, `handleSubmit`)

### CSS Guidelines

- Use scoped styles (`<style scoped>`) for component-specific CSS
- Avoid global styles except for base resets
- Support dark mode via `.dark` class on root elements
- Use CSS custom properties (`:root`) for theme colors when applicable
- Responsive design with `@media` queries for mobile (max-width: 768px or 900px)

### Storage and Persistence

- Use `localStorage` with prefixed keys for configuration (e.g., `lottery_config`)
- Wrap localStorage access in try-catch
- Use deep watch on reactive objects to auto-save
- Serialize data with `JSON.stringify`, parse with `JSON.parse`

### Excel Import/Export

- Support `.xlsx` and `.xls` file formats
- Validate file MIME types before processing
- Handle multiple column name variations (姓名/name/Name)
- Provide template download for users
- Use `XLSX.utils` for sheet operations

### Git Workflow

- Do not commit changes unless explicitly requested
- Do not create branches or pull requests unless asked
- Follow existing commit message style from git log
