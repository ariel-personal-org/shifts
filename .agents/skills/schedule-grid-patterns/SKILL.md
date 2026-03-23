---
name: schedule-grid-patterns
description: Use this skill when working on ScheduleGrid.tsx or any table/grid UI in this project. Provides patterns, constraints, and anti-patterns specific to the ScheduleGrid component.
---

# ScheduleGrid Patterns & Layout Rules

## Component Location
`frontend/src/components/ScheduleGrid.tsx`

## Architecture Overview

```
<div>                              ← wrapper
  {warning && <modal>}             ← fixed-position overlay (z-50)
  {isAdminView && <div h-12>}      ← action bar — ALWAYS reserves h-12 space
  <div overflow-auto>              ← scroll container
    <table border-collapse>        ← minWidth: max-content (no table-layout: fixed)
      <thead sticky>
      <tbody>
```

## Critical Layout Rules

### 1. Action Bar — NEVER cause layout shift
The action bar slot (`h-12 mb-3`) is **always rendered** in admin view, even when empty. It uses fixed height to prevent the grid from jumping when the bar appears/disappears.

```tsx
{/* CORRECT — always reserve the h-12 slot */}
{isAdminView && (
  <div className="h-12 mb-3 flex items-stretch">
    {isSelectMode ? <blue-bar /> : hasPendingChanges ? <amber-bar /> : null}
  </div>
)}

{/* WRONG — conditional rendering causes layout shift */}
{isAdminView && isSelectMode && <div className="mb-3">...</div>}
```

### 2. Column Widths — NEVER change on checkbox toggle
Checkboxes inside `ShiftHeader` and `MemberLabel` use **opacity** to show/hide, NOT conditional rendering. This keeps column widths stable.

```tsx
{/* CORRECT — opacity toggle, zero layout impact */}
<div className={`w-3.5 h-3.5 ... ${isSelectMode ? 'opacity-100' : 'opacity-0'}`}>

{/* WRONG — conditional rendering causes reflow */}
{isSelectMode && <div className="w-3.5 h-3.5 ...">}
```

### 3. Sticky Column — requires z-index layering
- Header cell (`<th>`): `sticky left-0 z-20` + explicit `bg-gray-50`
- Body cells (`<td>`): `sticky left-0 z-10` + explicit background (bg-white, bg-blue-50, or bg-purple-50 depending on row state)
- Without explicit background, sticky cells are transparent and scroll content shows through

### 4. Table sizing
- Use `style={{ minWidth: 'max-content' }}` on the table — NOT `table-layout: fixed`
- Column `min-w-[140px] max-w-[140px]` on the name column (both `th` and `td`)
- Shift columns use `min-w-[90px]` on the `ShiftHeader` inner div

## State Model

```
pendingChanges: Record<string, ShiftState>   // key = `${shiftId}:${userId}`
selectedCells: Set<string>                   // same key format
editingCell: string | null                   // same key format
```

- `isSelectMode` is **derived** from `selectedCells.size > 0` — not stored state
- Select mode is **activated by clicking** a row name or column header (not a button)
- Single-cell edit mode (`editingCell`) and select mode are mutually exclusive — entering one exits the other

## Interaction Patterns

| Click target | Effect |
|---|---|
| Row name (`MemberLabel`) | Toggle entire row selection |
| Column header (`ShiftHeader`) | Toggle entire column selection |
| Cell (single click) | Toggle that cell in/out of selection |
| Cell (double click) | Enter single-cell edit mode (dropdown) |

## Row Coloring Priority
```
isMe (current user)  → bg-blue-50/40 row + bg-blue-50 sticky cell + border-l-2 border-l-blue-400
is_fill_in           → bg-purple-50/30 row + bg-purple-50 sticky cell
default              → bg-white
```

## Anti-Patterns to Avoid

1. **Wrapping the table in another overflow container** — the outer `overflow-auto` div IS the scroll boundary; adding another one breaks sticky positioning
2. **Using `table-layout: fixed`** — shifts have variable widths; `max-content` is intentional
3. **Rendering checkboxes conditionally** — always render with opacity-0; never `{isSelectMode && <checkbox>}`
4. **Making the action bar conditional at the outer level** — always render the `h-12` slot, just leave it empty when inactive
5. **Not providing explicit background to sticky cells** — sticky cells MUST have a background color or content scrolls through them

## Warning Modal Pattern
- Uses `fixed inset-0` overlay with `z-50` — positioned relative to viewport, not the grid
- Triggered when setting a cell to `in_shift` while a pending home request exists
- Does NOT automatically cancel the home request — user must resolve it separately
