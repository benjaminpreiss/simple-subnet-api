CREATE TABLE IF NOT EXISTS measurements (
    subnet TEXT PRIMARY KEY,
    total BIGINT NOT NULL,
    successful BIGINT NOT NULL,
    CHECK(total >= successful)
);

-- Insert initial data
INSERT INTO measurements (subnet, total, successful)
VALUES
  ('walrus', 0, 0),
  ('arweave', 0, 0)
ON CONFLICT DO NOTHING;
