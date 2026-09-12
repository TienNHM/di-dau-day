import { renderStoryCard } from './story-card';
import type { StoryInput } from './story-card';

/**
 * Puts the story image in front of the user, by whichever route the browser allows.
 *
 * There is no web API that posts to an Instagram or Facebook story directly, and on
 * a static site there is no server to broker one. What does work is handing the file
 * to the OS share sheet, where Instagram and Facebook appear as targets — that is a
 * two-tap path to a story, and it is the best available.
 *
 * Desktop has no share sheet for files, so the image is saved instead. Someone
 * posting a story is on a phone; saving is for the case where they are not.
 */

export type StoryOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

function canShareFile(file: File): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function' &&
    navigator.canShare({ files: [file] })
  );
}

function download(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next turn of the event loop: revoking immediately can cancel the
  // download in some browsers before it has started reading the object URL.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export async function shareStory(
  input: StoryInput,
  { filename, text }: { filename: string; text: string },
): Promise<StoryOutcome> {
  let blob: Blob;
  try {
    blob = await renderStoryCard(input);
  } catch {
    return 'failed';
  }

  const file = new File([blob], filename, { type: 'image/png' });

  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (error) {
      // Dismissing the sheet rejects exactly as a failure does. The name is the only
      // way to tell them apart, and falling back to a download on a deliberate cancel
      // would drop an unwanted file in the user's photos.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      return 'failed';
    }
  }

  try {
    download(blob, filename);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
