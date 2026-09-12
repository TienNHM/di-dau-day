/**
 * Renders the result as a 1080×1920 story image, in the browser.
 *
 * Drawn on a canvas at share time rather than generated at build time. There are
 * 4,189 places; a story image each would add roughly 300 MB to a site already using
 * 526 MB of GitHub Pages' 1 GB, to serve a file most places will never be asked for.
 * Drawing one on demand costs about 40 ms and nothing at rest.
 *
 * The output goes to `navigator.share({ files })`, which on a phone opens the native
 * sheet with Instagram and Facebook in it — that is the actual path to a story, and
 * it is the only one available to a static site with no app integration.
 */

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export type StoryInput = {
  readonly name: string;
  readonly lead: string;
  readonly facts: readonly string[];
  readonly note?: string;
  readonly accent: { readonly from: string; readonly to: string; readonly on: string };
  readonly url: string;
};

/**
 * The page's own font, read rather than hardcoded.
 *
 * `next/font` gives the family a hashed name that changes between builds, so naming
 * it here would silently fall back to a system font the first time the hash moved —
 * and Vietnamese diacritics are exactly where a fallback font looks wrong.
 */
function fontStack(): string {
  if (typeof window === 'undefined') return 'sans-serif';
  const family = getComputedStyle(document.body).fontFamily;
  return family || 'sans-serif';
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * Greedy word wrap, shrinking the type until the whole name fits the box.
 *
 * Place names here range from "Manzi" to "Bánh Xèo Bà Dưỡng Chi Nhánh Hải Châu". A
 * fixed size would either waste the canvas on the short ones or overflow on the long
 * ones, and an overflowing name is the one thing this image cannot get wrong.
 */
function layoutHeadline(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  startSize: number,
  minSize: number,
): { lines: string[]; size: number } {
  const stack = fontStack();

  for (let size = startSize; size >= minSize; size -= 6) {
    ctx.font = `800 ${size}px ${stack}`;
    const lines: string[] = [];
    let current = '';

    for (const word of text.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);

    // A single word wider than the box can never fit; only the size loop can help.
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    if (lines.length <= maxLines && widest <= maxWidth) return { lines, size };
  }

  ctx.font = `800 ${minSize}px ${stack}`;
  return { lines: [text], size: minSize };
}

export async function renderStoryCard(input: StoryInput): Promise<Blob> {
  // The page font must be downloaded before anything is measured, or the layout is
  // computed against a fallback and the text is mis-sized in the exported image.
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas');

  const stack = fontStack();

  // Ground.
  const background = ctx.createLinearGradient(0, 0, STORY_WIDTH, STORY_HEIGHT);
  background.addColorStop(0, input.accent.from);
  background.addColorStop(1, input.accent.to);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  // Two blooms, matching the ones on the reveal screen, so a story and the app it
  // came from look like the same product.
  for (const bloom of [
    { x: 120, y: 240, r: 620, a: 0.3 },
    { x: 980, y: 1560, r: 520, a: 0.22 },
  ]) {
    const glow = ctx.createRadialGradient(bloom.x, bloom.y, 0, bloom.x, bloom.y, bloom.r);
    glow.addColorStop(0, `rgba(255,255,255,${bloom.a})`);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  }

  ctx.textAlign = 'center';
  /*
   * Top, not the default alphabetic baseline.
   *
   * Stacking blocks means adding heights, and with an alphabetic baseline the y you
   * pass is where the letters sit *on*, not where the box starts — so a 118px
   * headline drawn 54px below the lead reached back up over it. With `top` the
   * arithmetic below means what it says.
   */
  ctx.textBaseline = 'top';
  ctx.fillStyle = input.accent.on;

  /*
   * Measured first, painted second.
   *
   * The block has to be centred as a whole, and its height is not known until the
   * headline has chosen a type size and the pills have wrapped. Laying out while
   * painting pinned the top to a fixed y, which left a short name floating above a
   * large hole — the difference between a card and a template with a gap in it.
   */
  const leadHeight = 34 * 1.6;
  const headline = layoutHeadline(ctx, input.name, STORY_WIDTH - 200, 4, 118, 56);
  const headlineLine = headline.size * 1.12;

  const note = input.note
    ? layoutHeadline(ctx, input.note, STORY_WIDTH - 240, 3, 40, 30)
    : null;
  const noteLine = note ? note.size * 1.4 : 0;

  // Fact pills, wrapped onto rows so three long ones cannot run off the edge.
  ctx.font = `600 36px ${stack}`;
  const padding = 34;
  const pillHeight = 84;
  const gap = 18;

  const measured = input.facts.map((fact) => ({
    text: fact,
    width: ctx.measureText(fact).width + padding * 2,
  }));

  const rows: (typeof measured)[] = [];
  let row: typeof measured = [];
  let rowWidth = 0;
  for (const pill of measured) {
    const next = rowWidth === 0 ? pill.width : rowWidth + gap + pill.width;
    if (next > STORY_WIDTH - 160 && row.length > 0) {
      rows.push(row);
      row = [pill];
      rowWidth = pill.width;
    } else {
      row.push(pill);
      rowWidth = next;
    }
  }
  if (row.length > 0) rows.push(row);

  const blockHeight =
    leadHeight +
    headline.lines.length * headlineLine +
    (note ? 40 + note.lines.length * noteLine : 0) +
    (rows.length > 0 ? 50 + rows.length * (pillHeight + gap) : 0);

  /*
   * Optically centred, not mathematically.
   *
   * The footer owns the bottom ~360px and Instagram lays its own controls over the
   * very top and bottom of a story, so the true centre sits low. Biasing upward puts
   * the name where a thumb is not and where the eye lands first.
   */
  let cursor = Math.max(360, (STORY_HEIGHT - 360 - blockHeight) / 2);

  // Lead, spaced out like the app's eyebrow text.
  ctx.font = `600 34px ${stack}`;
  ctx.globalAlpha = 0.85;
  ctx.letterSpacing = '8px';
  ctx.fillText(input.lead.toUpperCase(), STORY_WIDTH / 2, cursor);
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = 1;
  cursor += leadHeight;

  ctx.font = `800 ${headline.size}px ${stack}`;
  headline.lines.forEach((line, index) => {
    ctx.fillText(line, STORY_WIDTH / 2, cursor + index * headlineLine);
  });
  cursor += headline.lines.length * headlineLine;

  // Note, when there is a human-written one worth quoting.
  if (note) {
    cursor += 40;
    ctx.globalAlpha = 0.9;
    ctx.font = `500 ${note.size}px ${stack}`;
    note.lines.forEach((line, index) => {
      ctx.fillText(line, STORY_WIDTH / 2, cursor + index * noteLine);
    });
    cursor += note.lines.length * noteLine;
    ctx.globalAlpha = 1;
  }

  ctx.font = `600 36px ${stack}`;
  cursor += 50;
  for (const currentRow of rows) {
    const totalWidth =
      currentRow.reduce((sum, pill) => sum + pill.width, 0) + gap * (currentRow.length - 1);
    let x = (STORY_WIDTH - totalWidth) / 2;

    for (const pill of currentRow) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      roundedRect(ctx, x, cursor, pill.width, pillHeight, pillHeight / 2);
      ctx.fill();

      ctx.fillStyle = input.accent.on;
      // Centred in the pill, which is what `middle` is for.
      ctx.textBaseline = 'middle';
      ctx.fillText(pill.text, x + pill.width / 2, cursor + pillHeight / 2);
      ctx.textBaseline = 'top';
      x += pill.width + gap;
    }
    cursor += pillHeight + gap;
  }

  /*
   * Footer: a call to action, not a second signature.
   *
   * This used to read "ĐI ĐÂU ĐÂY VỪA CHỌN" at the top and "Đi Đâu Đây?" at the
   * bottom — the brand twice, and the most valuable line on the image spent saying
   * who made it rather than giving anyone a reason to act. The eyebrow now carries
   * the question the result answers, and down here the domain does the branding on
   * its own, because it is the brand name.
   *
   * Placed clear of the very bottom, where Instagram lays its own controls.
   */
  ctx.fillStyle = input.accent.on;
  ctx.textBaseline = 'bottom';
  ctx.font = `800 50px ${stack}`;
  ctx.fillText('Tới lượt bạn?', STORY_WIDTH / 2, STORY_HEIGHT - 300);

  ctx.font = `500 34px ${stack}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText('Trả lời 3 câu, tụi mình chọn cho một chỗ.', STORY_WIDTH / 2, STORY_HEIGHT - 246);
  ctx.globalAlpha = 1;

  // The address as a button. It is the only thing on the image someone can act on,
  // so it gets the strongest contrast down here rather than the faintest.
  ctx.font = `800 40px ${stack}`;
  const label = `👉 ${input.url.replace(/^https?:\/\//, '')}`;
  const labelWidth = ctx.measureText(label).width + 76;
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  roundedRect(ctx, (STORY_WIDTH - labelWidth) / 2, STORY_HEIGHT - 190, labelWidth, 92, 46);
  ctx.fill();
  ctx.fillStyle = input.accent.on;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, STORY_WIDTH / 2, STORY_HEIGHT - 190 + 46);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được ảnh'))),
      'image/png',
    );
  });
}
