CREATE TABLE IF NOT EXISTS measurements (
    day DATE NOT NULL,
    subnet TEXT,
    total BIGINT NOT NULL,
    successful BIGINT NOT NULL,
    CHECK(total >= successful),
    PRIMARY KEY (day, subnet)
);
