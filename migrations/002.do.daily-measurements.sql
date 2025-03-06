CREATE TABLE IF NOT EXISTS daily_measurements (
    day DATE NOT NULL,
    subnet TEXT,
    total BIGINT NOT NULL,
    successful BIGINT NOT NULL,
    CHECK(total >= successful),
    PRIMARY KEY (day, subnet)
);
