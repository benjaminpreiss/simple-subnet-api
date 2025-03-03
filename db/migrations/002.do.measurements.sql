CREATE TABLE IF NOT EXISTS measurements (
    subnet TEXT PRIMARY KEY,
    total BIGINT NOT NULL,
    success BIGINT NOT NULL,
    CHECK(total >= success)
);
