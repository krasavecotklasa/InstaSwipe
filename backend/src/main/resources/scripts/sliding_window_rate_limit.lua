local key = KEYS[1]

local window_size = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])

local time_result = redis.call("TIME")
local now = tonumber(time_result[1]) + tonumber(time_result[2]) / 1000000

local clear_before = now - window_size
redis.call("ZREMRANGEBYSCORE", key, 0, clear_before)

local current_count = redis.call("ZCARD", key)

if current_count + 1 > limit then
    local retry_after = window_size
    local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
    if #oldest >= 2 then
        retry_after = math.ceil(tonumber(oldest[2]) + window_size - now)
        if retry_after < 1 then
            retry_after = 1
        end
    end

    local remaining = limit - current_count
    if remaining < 0 then
        remaining = 0
    end

    return {0, remaining, retry_after}
else
    local member = tostring(now) .. ":" .. tostring(math.random())
    redis.call("ZADD", key, now, member)
    redis.call("EXPIRE", key, window_size)

    local remaining = limit - (current_count + 1)
    return {1, remaining, 0}
end
