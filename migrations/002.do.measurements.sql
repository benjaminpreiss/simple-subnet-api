CREATE TABLE IF NOT EXISTS measurements (
    day DATE NOT NULL DEFAULT CURRENT_DATE,
    subnet TEXT,
    total BIGINT NOT NULL,
    successful BIGINT NOT NULL,
    CHECK(total >= successful),
    PRIMARY KEY (day, subnet)
);
