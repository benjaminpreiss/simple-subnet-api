-- Create a continuous aggregate for minute-level data
CREATE MATERIALIZED VIEW minute_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', time) AS bucket_time,
    subnet_check_id,
    check_key,
    COUNT(*) AS total_checks,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successful_checks,
    AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END)::float AS success_rate,
    AVG(result)::float AS avg_result
FROM
    measurements_for_avg
GROUP BY
    bucket_time,
    subnet_check_id,
    check_key
WITH NO DATA;

-- Set refresh policy to keep minute stats updated
SELECT add_continuous_aggregate_policy('minute_stats',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute');

-- Create additional hourly stats view for longer-term analysis
CREATE MATERIALIZED VIEW hourly_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', bucket_time) AS bucket_time,
    subnet_check_id,
    check_key,
    SUM(total_checks) AS total_checks,
    SUM(successful_checks) AS successful_checks,
    SUM(successful_checks)::float / NULLIF(SUM(total_checks), 0) AS success_rate,
    AVG(avg_result) AS avg_result
FROM
    minute_stats
GROUP BY
    time_bucket('1 hour', bucket_time),
    subnet_check_id,
    check_key
WITH NO DATA;

SELECT add_continuous_aggregate_policy('hourly_stats',
    start_offset => INTERVAL '90 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');
