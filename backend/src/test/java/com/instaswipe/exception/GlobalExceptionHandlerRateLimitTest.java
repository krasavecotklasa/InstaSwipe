package com.instaswipe.exception;

import com.instaswipe.ratelimit.RateLimitExceededException;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerRateLimitTest {

    @Test
    void mapsRateLimitExceededTo429WithRetryAfterHeader() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        ResponseEntity<ApiError> response = handler.handleRateLimit(new RateLimitExceededException(42));

        assertThat(response.getStatusCode().value()).isEqualTo(429);
        assertThat(response.getHeaders().getFirst("Retry-After")).isEqualTo("42");
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(429);
        assertThat(response.getBody().message()).isEqualTo("Too many requests. Try again later.");
    }
}
