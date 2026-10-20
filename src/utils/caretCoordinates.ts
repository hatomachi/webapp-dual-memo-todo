/**
 * Caret coordinates calculation for HTMLTextAreaElement.
 * Based on the textarea-caret library (MIT License).
 * Accurately calculates pixel (top, left, height) of the cursor inside a textarea.
 */

// Properties to copy from the textarea to the mirror div
const PROPERTIES = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize',
] as const;

export interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
}

let mirrorDiv: HTMLDivElement | null = null;

export function getCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number
): CaretCoordinates {
  // Lazily create or reuse mirror div
  if (!mirrorDiv) {
    mirrorDiv = document.createElement('div');
    mirrorDiv.id = 'input-textarea-caret-position-mirror-div';
    document.body.appendChild(mirrorDiv);
  }

  const style = mirrorDiv.style;
  const computed = window.getComputedStyle(element);

  // Default mirror div styles
  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.top = '0px';
  style.left = '-9999px';
  style.pointerEvents = 'none';

  // Transfer textarea CSS properties to mirror div
  for (const prop of PROPERTIES) {
    // @ts-expect-error computed style index access
    style[prop] = computed[prop];
  }

  // Handle Firefox / Safari scrollbar differences
  style.overflow = 'hidden';

  // Insert text up to cursor
  mirrorDiv.textContent = element.value.substring(0, position);

  // Insert a marker span for the caret position
  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  mirrorDiv.appendChild(span);

  const coordinates: CaretCoordinates = {
    top: span.offsetTop + parseInt(computed.borderTopWidth || '0', 10),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth || '0', 10),
    height: parseInt(computed.lineHeight || '20', 10) || 20,
  };

  return coordinates;
}
