CREATE TABLE IF NOT EXISTS subnet_stats (
    subnet TEXT PRIMARY KEY,
    total BIGINT NOT NULL,
    success BIGINT NOT NULL,
    CHECK(total >= success)
);
