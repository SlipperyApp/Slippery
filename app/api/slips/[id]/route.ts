import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429 } from '@/lib/server/respond';
import { deleteSlipImage, readSlipImage, slipStoreReady } from '@/lib/server/slips';

export const runtime = 'nodejs';

/** One slip image, served to the account that owns it and to nobody else.
 *
 *  Ownership is part of the query rather than a check around it: there is no
 *  path here that reads a row and then decides whether it was allowed to.
 *
 *  Cached PRIVATE and only in the browser that asked. A slip is the most
 *  personal thing anybody sends this product, so it must not land in a shared
 *  cache, and immutable is honest because the id is the row: the bytes behind
 *  an id never change, they are only deleted. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!slipStoreReady()) {
    return fail(503, 'no_store', 'This deployment has no image storage, so there is no slip to show.');
  }
  const account = await currentAccount();
  if (!account) return fail(401, 'no_session', 'Slip images are only served to the account that owns them.');

  const image = await readSlipImage(account.id, id);
  if (!image) {
    /*  404 whether it never existed, belongs to somebody else, or was
        deleted. The gallery already knows which of the three it is, from the
        book, and an endpoint that told them apart would be a way to ask
        whether a stranger's image id is real. */
    return fail(404, 'not_found', 'That image is not here. It may have been deleted, on request or on the ninety day schedule.');
  }

  return new Response(new Uint8Array(image.data), {
    headers: {
      'content-type': image.mediaType,
      'content-length': String(image.data.byteLength),
      'cache-control': 'private, max-age=3600, immutable',
      // A slip is not a page and must never be framed or sniffed into one.
      'x-content-type-options': 'nosniff',
      'content-disposition': 'inline',
    },
  });
}

/** Delete it now, which is the data right the privacy policy commits to.
 *
 *  The control that used to sit above this sentence set a React state
 *  variable, relabelled itself "Requested" and sent nothing anywhere. This is
 *  the request it should always have made: the bytes go immediately and the
 *  row stays with deleted_at set, so the gallery says the image was removed
 *  rather than showing a broken thumbnail, and the record of the deletion
 *  outlives the thing it deleted. The bet is untouched, because every figure
 *  on it was folded from the settlement events and never from the picture. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = limitOr429(req, 'slip-delete', 60, 300);
  if (limited) return limited;

  const { id } = await ctx.params;
  if (!slipStoreReady()) {
    return fail(503, 'no_store', 'This deployment has no image storage, so there was no image to delete.');
  }
  const account = await currentAccount();
  if (!account) {
    return fail(401, 'no_session', 'You are looking at the example account, which holds no images of yours.');
  }

  const gone = await deleteSlipImage(account.id, id);
  return Response.json({
    ok: true,
    deleted: gone,
    message: gone
      ? 'Deleted. The image is gone and the bet is unchanged: every figure on it came from the settlement events.'
      : 'There was nothing to delete. That image has already been removed, on request or on the ninety day schedule.',
  });
}
