-- The slip image itself.
--
-- "Slips", "IMAGE HELD 90D", "The image is deleted after 90 days, or now if
-- you ask" and a privacy policy that repeats the promise all described an
-- image that was never stored anywhere. slip_images held a storage_key
-- pointing at a store that did not exist, the retention sweep deleted rows
-- referring to nothing, and the delete control set a React state variable and
-- sent no request. A ninety day retention promise about a file that is not
-- kept is not a promise, and the gallery, the review crop and the image hash
-- fast path all depend on the file actually being there.
--
-- WHY THE BYTES ARE IN POSTGRES. Blob storage would be the usual answer and
-- the seam for it is in lib/server/slips.ts, which is the only module that
-- knows where an image lives. It is not the answer today because the only
-- object store available to this deployment needs a package and a token that
-- are not on this branch, and shipping the promise with nothing behind it a
-- second time is worse than a large column. An upload is capped at 12MB by
-- lib/data/read.ts, so a row is bounded, and Postgres stores a bytea of that
-- size out of line in TOAST rather than in the row itself.
--
-- The retention obligation gets tighter with this, not looser, which is the
-- right direction and is why the sweep is checked in beside it rather than
-- after it.
alter table slip_images add column if not exists data bytea;
alter table slip_images add column if not exists media_type text;

-- One live image per file per account. A second upload of the same screenshot
-- is the same image and must not become a second row, or the sweep would have
-- to delete two things to keep one promise. Partial, because a deleted row
-- stays for the record and a later upload of the same file is allowed to
-- store it again.
create unique index if not exists slip_images_live_sha_idx
  on slip_images (account_id, sha256) where deleted_at is null;

-- The lookup behind every bet sheet and every gallery tile: which live image
-- belongs to this bet.
create index if not exists slip_images_bet_idx
  on slip_images (bet_id) where deleted_at is null;
