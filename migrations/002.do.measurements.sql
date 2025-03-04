CREATE TYPE subnet AS ENUM ('walrus', 'arweave');

CREATE TABLE IF NOT EXISTS measurements (
    subnet_id subnet PRIMARY KEY,
    total BIGINT NOT NULL,
    success BIGINT NOT NULL,
    CHECK(total >= success)
);

-- Insert initial data
INSERT INTO measurements (subnet_id, total, success)
VALUES
  ('walrus', 0, 0),
  ('arweave', 0, 0)
ON CONFLICT DO NOTHING;
