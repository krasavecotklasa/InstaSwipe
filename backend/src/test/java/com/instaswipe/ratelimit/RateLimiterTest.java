package com.instaswipe.ratelimit;

import com.instaswipe.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class RateLimiterTest {

    @Autowired
    private RateLimiter rateLimiter;

    @Test
    void allowsRequestsUnderTheLimitAndTracksRemaining() {
        String key = "rl:test:allow:" + System.nanoTime();

        RateLimitResult first = rateLimiter.checkAndIncrement(key, 3, 2);
        RateLimitResult second = rateLimiter.checkAndIncrement(key, 3, 2);
        RateLimitResult third = rateLimiter.checkAndIncrement(key, 3, 2);

        assertThat(first.allowed()).isTrue();
        assertThat(first.remaining()).isEqualTo(2);
        assertThat(second.allowed()).isTrue();
        assertThat(second.remaining()).isEqualTo(1);
        assertThat(third.allowed()).isTrue();
        assertThat(third.remaining()).isEqualTo(0);
    }

    @Test
    void blocksRequestsOverTheLimitAndReportsRetryAfter() {
        String key = "rl:test:block:" + System.nanoTime();

        rateLimiter.checkAndIncrement(key, 2, 2);
        rateLimiter.checkAndIncrement(key, 2, 2);
        RateLimitResult third = rateLimiter.checkAndIncrement(key, 2, 2);

        assertThat(third.allowed()).isFalse();
        assertThat(third.remaining()).isEqualTo(0);
        assertThat(third.retryAfterSeconds()).isGreaterThan(0);
    }

    @Test
    void differentKeysAreTrackedIndependently() {
        String keyA = "rl:test:isolationA:" + System.nanoTime();
        String keyB = "rl:test:isolationB:" + System.nanoTime();

        rateLimiter.checkAndIncrement(keyA, 1, 2);
        RateLimitResult blockedA = rateLimiter.checkAndIncrement(keyA, 1, 2);
        RateLimitResult allowedB = rateLimiter.checkAndIncrement(keyB, 1, 2);

        assertThat(blockedA.allowed()).isFalse();
        assertThat(allowedB.allowed()).isTrue();
    }

    @Test
    void resetsOnceTheWindowFullyElapses() throws InterruptedException {
        String key = "rl:test:reset:" + System.nanoTime();

        rateLimiter.checkAndIncrement(key, 1, 1);
        RateLimitResult blocked = rateLimiter.checkAndIncrement(key, 1, 1);
        assertThat(blocked.allowed()).isFalse();

        Thread.sleep(2100); // past 2x the 1s window so the weighted previous-window count decays to ~0

        RateLimitResult afterReset = rateLimiter.checkAndIncrement(key, 1, 1);
        assertThat(afterReset.allowed()).isTrue();
    }
}
