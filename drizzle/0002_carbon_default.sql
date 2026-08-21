-- The theme set changed with the redesign. Tide, Light and Linen no longer
-- exist and Carbon is the new default, so any account still holding one of
-- the three removed themes would render with no palette at all.
ALTER TABLE accounts ALTER COLUMN theme SET DEFAULT 'carbon';
UPDATE accounts SET theme = 'carbon' WHERE theme IN ('tide', 'light', 'linen');
