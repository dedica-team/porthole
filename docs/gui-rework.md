# GUI rework

## Specs

* all gui elements must be accessible via keyboard navigation
* similar gui elements must look and behave similarly and derive from a common base class - especially status badges
* buttons that change model state (edit, delete etc.) must appear as buttons, controls like close buttons, filters are flat. flat controls use a slight hover effect and a pointer.
* centered dialogs are used, never popovers.
* all text is white including headlines. never use custom font size, but built-in sizes like s,m,l. text is displayed in rather large font

## Implementation Steps

### 1. Component Standardization
- [x] **Badge System**: Replace all CSS-based badge classes (e.g., `.metrics-overall-badge`) with the `Badge` component. Create a `StatusBadge` wrapper that maps domain states (GOOD, PARTIAL, BAD) to `Badge` variants.
- [x] **Button Audit**: 
    - Identify all buttons that trigger API calls or state changes (Edit, Save, Delete). Ensure they use the `default` or `destructive` variant (visible buttons).
    - Ensure all "Close", "Cancel", or "Filter" triggers use the `ghost` variant (flat controls).
- [x] **Typography Migration**: 
    - Search for all `text-[px]` and `text-xs` classes.
    - Replace them with standard Tailwind sizes: `text-sm` (small), `text-base` (medium), `text-lg` (large).
    - Ensure all headlines use `text-lg` or larger.
    - always display text in light color, not cyan

### 2. Interaction & Layout Refactor
- [x] **Popover to Dialog Migration**: 
    - Convert `LandmarkInfoPopover` from a `Popover` to a `Dialog`.
    - The trigger can remain a popover-like interaction for "quick view," but any "Edit" or "Remove" action must launch a centered `Dialog`.
- [x] **Keyboard Access**:
    - Implement `tabIndex` and keyboard event listeners for `HexGrid` landmark selection.
    - Ensure all custom `select` and `input` fields in panels are reachable via Tab.

### 3. Visual Polish
- [x] **Text Color Audit**: Verify that all text elements use `text-foreground` (which is white/icy-blue in the Tron theme) and remove any hardcoded gray/muted colors that aren't `text-muted-foreground`.
- [x] **Hover Effects**: Add a consistent `hover:bg-accent` or similar transition to all flat controls to meet the "slight hover effect" requirement.
