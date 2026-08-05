# Streaming Gear Indicator Design

## Goal

Replace the custom flywheel shown beneath a streaming assistant message with a restrained gray-white rotating gear.

## Design

- Render Lucide's `Cog` icon in `AssistantTurn` only while the assistant response is streaming.
- Keep the indicator in the existing inline position and reserve a stable 14 x 14 px footprint so message layout does not shift.
- Use a neutral gray-white stroke that remains visible on the current message background without becoming a primary accent.
- Rotate at a steady, moderate speed using a dedicated CSS class.
- Mark the icon `aria-hidden`; the surrounding streaming state already communicates progress.
- Disable rotation under `prefers-reduced-motion: reduce` while keeping the gear visible.

## Scope

This change does not alter streaming state, message rendering, tool-call loaders, pending dots, or any other loading indicator.

## Verification

- Add a component assertion that the streaming gear is present only during streaming.
- Run the focused assistant-turn tests and the desktop frontend test suite.
- Build the frontend to catch icon import or CSS compilation errors.
