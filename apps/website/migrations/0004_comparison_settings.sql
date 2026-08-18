ALTER TABLE projects ADD COLUMN compare_threshold REAL;
ALTER TABLE projects ADD COLUMN compare_max_diff_pixels INTEGER;
ALTER TABLE projects ADD COLUMN compare_max_diff_pixel_ratio REAL;
ALTER TABLE projects ADD COLUMN compare_include_aa INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN ignore_selectors TEXT;

ALTER TABLE snapshots ADD COLUMN ignored_selectors TEXT;
