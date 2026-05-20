// Pure positioning math for the hint bubble — kept Electron-free so unit tests
// can exercise edge clamping without spinning up a BrowserWindow.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BubblePosition {
  x: number;
  y: number;
}

/**
 * Place the bubble at an offset from the cursor, flipping to the opposite side
 * when it would overflow the work area, and clamping to keep it on-screen.
 */
export function bubblePosition(
  cursorX: number,
  cursorY: number,
  workArea: Rect,
  bubbleWidth: number,
  bubbleHeight: number,
  offset: number,
  margin = 8,
): BubblePosition {
  let x = cursorX + offset;
  let y = cursorY + offset;
  if (x + bubbleWidth > workArea.x + workArea.width - margin) {
    x = cursorX - bubbleWidth - offset;
  }
  if (y + bubbleHeight > workArea.y + workArea.height - margin) {
    y = cursorY - bubbleHeight - offset;
  }
  x = Math.max(workArea.x + margin, x);
  y = Math.max(workArea.y + margin, y);
  return { x, y };
}
