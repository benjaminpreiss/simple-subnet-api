CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create the subnet_checks table to store check definitions
CREATE TABLE subnet_checks (
    id SERIAL PRIMARY KEY,
    subnet TEXT NOT NULL,
    check_subject TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (subnet, check_subject)
);

-- Create table for measurements that can be averaged
CREATE TABLE measurements_for_avg (
    time TIMESTAMPTZ NOT NULL,
    subnet_check_id INTEGER REFERENCES subnet_checks(id) ON DELETE CASCADE,
    check_key TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    result INTEGER NOT NULL,
    PRIMARY KEY (time, subnet_check_id, check_key)
);

-- Create table for discrete measurements
CREATE TABLE measurements_discrete (
    time TIMESTAMPTZ NOT NULL,
    subnet_check_id INTEGER REFERENCES subnet_checks(id) ON DELETE CASCADE,
    check_key TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    result TEXT NOT NULL,
    PRIMARY KEY (time, subnet_check_id, check_key)
);

-- Convert to hypertables
SELECT create_hypertable('measurements_for_avg', 'time');
SELECT create_hypertable('measurements_discrete', 'time');

-- Create indexes
CREATE INDEX idx_measurements_for_avg_lookup ON measurements_for_avg (subnet_check_id, check_key, time DESC);
CREATE INDEX idx_measurements_discrete_lookup ON measurements_discrete (subnet_check_id, check_key, time DESC);

-- Enable compression on hypertables
ALTER TABLE measurements_for_avg SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'subnet_check_id, check_key',
    timescaledb.compress_orderby = 'time DESC'
);

ALTER TABLE measurements_discrete SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'subnet_check_id, check_key',
    timescaledb.compress_orderby = 'time DESC'
);

-- Add compression policies
SELECT add_compression_policy('measurements_for_avg', INTERVAL '7 days');
SELECT add_compression_policy('measurements_discrete', INTERVAL '7 days');

-- Create view for querying the latest status of each check
CREATE VIEW check_current_status AS
SELECT
    sc.subnet,
    sc.check_subject,
    m.check_key,
    m.success,
    m.result,
    m.time
FROM subnet_checks sc
JOIN LATERAL (
    SELECT
        check_key,
        success,
        result,
        time
    FROM measurements_for_avg
    WHERE subnet_check_id = sc.id
    ORDER BY time DESC
    LIMIT 1
) m ON true;
