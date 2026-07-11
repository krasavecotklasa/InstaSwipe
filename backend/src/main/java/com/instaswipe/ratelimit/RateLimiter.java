package com.instaswipe.ratelimit;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
public class RateLimiter {

    private final StringRedisTemplate redisTemplate;
    private DefaultRedisScript<List> redisScript;

    @PostConstruct
    public void init() {
        redisScript = new DefaultRedisScript<>();
        redisScript.setLocation(new ClassPathResource("scripts/sliding_window_rate_limit.lua"));
        redisScript.setResultType(List.class);
    }

    public RateLimitResult checkAndIncrement(String key, int limit, int windowSeconds) {
        List<Long> result = redisTemplate.execute(
                redisScript,
                Collections.singletonList(key),
                String.valueOf(windowSeconds),
                String.valueOf(limit)
        );

        if (result == null || result.size() < 3) {
            return new RateLimitResult(true, limit, 0);
        }

        boolean allowed = result.get(0) == 1L;
        long remaining = result.get(1);
        long retryAfterSeconds = result.get(2);

        return new RateLimitResult(allowed, remaining, retryAfterSeconds);
    }
}
