/** What state the slip behind a bet is in.
 *
 *  ONE FUNCTION, because two surfaces answer this question and they were
 *  about to be two answers. The bet sheet worked it out inline from
 *  `placedAt` and a literal 90, and the gallery would have worked it out
 *  again; the day the retention window moves, one of the two keeps saying 90
 *  and nobody finds out until somebody's image is described as held after it
 *  has been deleted.
 *
 *  THE STATES ARE NOT ABOUT PICTURES, THEY ARE ABOUT EVIDENCE. A bet either
 *  came from a slip or it did not, and if it did, the image behind it is
 *  either still here or has been deleted on schedule. Every one of the four
 *  is a fact worth stating out loud, and a gallery that drew a broken
 *  thumbnail for the fourth would be hiding the one it most needs to say. */

import { isImportedSource } from './types';

/** Ninety days from upload, or immediately on request. It is a promise in the
 *  privacy policy, so it lives in one constant rather than in each place that
 *  counts down to it. */
export const IMAGE_RETENTION_DAYS = 90;

/** WHETHER AN IMAGE IS KEPT AT ALL ON THIS DEPLOYMENT, and today it is not.
 *
 *  `slip_images` is selected from, updated and deleted, and there is no
 *  INSERT anywhere in the repository. DECISIONS.md records it as open gap 6.
 *  So the retention sweep has nothing to sweep, the image hash duplicate
 *  path can never match, and three statements the interface was making about
 *  a file were all false about a real account: "121 still have an image",
 *  "IMAGE HELD 90D" on every tile, and a Delete the image now button that
 *  set a React state and sent nothing anywhere.
 *
 *  A gallery of a hundred and sixty one identical grey cards promising a
 *  picture that does not exist is the moment this product reads as a mock,
 *  and it is on the screen that would otherwise prove the headline claim. So
 *  the surfaces branch on this rather than pretending: the state machine
 *  above is unchanged and correct, and the day the image is stored this
 *  becomes true and every one of them says so again.
 *
 *  It is a constant rather than an environment read because it is a fact
 *  about the code, not about the machine: no line in this repository writes
 *  an image, on any deployment. */
export const IMAGES_STORED = false;

export type SlipState =
  /** Brought in from a file. There was never an image and it is never slip backed. */
  | 'imported'
  /** Entered by hand. First class, and marked everywhere it appears. */
  | 'typed'
  /** Captured from a slip, and the image is still inside the retention window. */
  | 'held'
  /** Captured from a slip, and the image was deleted: on the ninetieth day,
   *  or earlier because somebody asked. */
  | 'expired'
  /** Captured from a slip, and no image was ever kept for it.
   *
   *  THIS STATE EXISTS BECAUSE THE PRODUCT USED TO CLAIM THE OTHER ONE. Every
   *  slip backed bet reported "Image held" and counted down ninety days to a
   *  deletion of a file that was never stored. A bet that came in before
   *  images were kept, or on a deployment that cannot keep one, is this: the
   *  bet is real and complete, and there is no picture behind it. */
  | 'unstored';

export type SlipStatus = {
  state: SlipState;
  /** Whole days since capture, floored. Zero on the day itself. */
  ageDays: number;
  /** Whole days before the image is deleted, floored at zero. Null when there
   *  is no image to count down to. */
  daysLeft: number | null;
  /** The stored image, when the caller resolved one. Its id is what serves
   *  the picture and what the delete control names. */
  imageId?: string;
  /** True when the image went before its ninetieth day, because somebody
   *  asked for it. A different fact from the clock running out, and a person
   *  who exercised a data right is owed the version that says so. */
  removedEarly?: boolean;
};

/** The stored image behind a bet, or nothing.
 *
 *  Absent and null mean the same thing on purpose: no image is held. A
 *  surface that cannot resolve one must not be able to imply that one exists
 *  by saying nothing, which is exactly how "Image held" came to be printed
 *  over an empty store on every screen in the product. */
export type SlipImage = { id: string; deletedAt: string | null } | null | undefined;

export function slipStatus(
  bet: { source: string; slipBacked: boolean; placedAt: string; slipImage?: SlipImage },
  now: Date = new Date(),
): SlipStatus {
  const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(bet.placedAt).getTime()) / 86400000));

  if (isImportedSource(bet.source)) return { state: 'imported', ageDays, daysLeft: null };
  if (!bet.slipBacked) return { state: 'typed', ageDays, daysLeft: null };

  /*  THE STORED IMAGE DECIDES, NEVER THE CLOCK.
   *
   *  This used to be `ageDays > 90 ? expired : held`, computed from a date
   *  with no file anywhere in the system, so every slip backed bet in the
   *  product reported "Image held" and counted down ninety days to the
   *  deletion of something that did not exist. The clock now says only how
   *  long a real image has left; whether there IS one is a fact about the
   *  store, and a caller that cannot answer says so by leaving this out,
   *  which reads as no image rather than as a held one. */
  const image = bet.slipImage ?? null;
  if (!image) return { state: 'unstored', ageDays, daysLeft: null };

  if (image.deletedAt) {
    return {
      state: 'expired', ageDays, daysLeft: null,
      /*  Deleted before its ninetieth day means somebody asked, and a person
          exercising a data right is owed the sentence that says so. */
      removedEarly: ageDays <= IMAGE_RETENTION_DAYS,
    };
  }

  return {
    state: 'held', ageDays,
    daysLeft: Math.max(0, IMAGE_RETENTION_DAYS - ageDays),
    imageId: image.id,
  };
}

/** The label a tile, a pill or a filter uses. One word each, and the same
 *  word on every surface. */
export const SLIP_STATE_LABEL: Record<SlipState, string> = {
  imported: 'Imported',
  typed: 'Typed in',
  held: 'Image held',
  expired: 'Image removed',
  unstored: 'No image kept',
};

/** The sentence that goes with the state, said the same way everywhere.
 *
 *  The expired one is the reason this product has a gallery rather than a
 *  wall of thumbnails: a record whose evidence was deleted on purpose has to
 *  say so, because a broken image is indistinguishable from a bug and a blank
 *  tile is indistinguishable from a bet nobody photographed. */
export function slipSentence(status: SlipStatus): string {
  switch (status.state) {
    case 'imported':
      return 'Brought in from a file rather than a slip, so there was never an image behind it.';
    case 'typed':
      return 'Typed in rather than captured, so there is no slip behind it.';
    case 'unstored':
      return 'This bet came from a slip and no image was kept for it. The bet is unchanged: every figure on it was folded from the settlement events, not from a picture.';
    case 'expired':
      return status.removedEarly
        ? 'The image was deleted at your request. The bet is unchanged: every figure on it was folded from the settlement events, not from the picture.'
        : `The image was removed ${IMAGE_RETENTION_DAYS} days after it was captured. The bet is unchanged: every figure on it was folded from the settlement events, not from the picture.`;
    default:
      return status.daysLeft === 0
        ? 'The image is removed today.'
        : `The image is removed in ${status.daysLeft} ${status.daysLeft === 1 ? 'day' : 'days'}, or now if you ask.`;
  }
}
