package com.instaswipe.controller;

import com.instaswipe.dto.LoginRequest;
import com.instaswipe.dto.RegisterRequest;
import com.instaswipe.dto.ForgotPasswordRequest;
import com.instaswipe.exception.ApiError;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

class AuthRateLimitTest extends AbstractWebIntegrationTest {

    @Test
    void loginIsBlockedAfterExceedingTheEmailLimit() {
        String email = "rl-login-" + System.nanoTime() + "@example.com";

        for (int i = 0; i < 5; i++) {
            ResponseEntity<Void> response = client().post().uri("/api/auth/login")
                    .body(new LoginRequest(email, "wrong-password"))
                    .retrieve().toBodilessEntity();
            assertThat(response.getStatusCode().value()).isNotEqualTo(429);
        }

        ResponseEntity<ApiError> blocked = client().post().uri("/api/auth/login")
                .body(new LoginRequest(email, "wrong-password"))
                .retrieve().toEntity(ApiError.class);

        assertThat(blocked.getStatusCode().value()).isEqualTo(429);
        assertThat(blocked.getHeaders().getFirst("Retry-After")).isNotBlank();
        assertThat(blocked.getBody()).isNotNull();
        assertThat(blocked.getBody().status()).isEqualTo(429);

        // a different email is not affected by the first email's blocked bucket
        ResponseEntity<Void> otherEmail = client().post().uri("/api/auth/login")
                .body(new LoginRequest("rl-login-other-" + System.nanoTime() + "@example.com", "wrong-password"))
                .retrieve().toBodilessEntity();
        assertThat(otherEmail.getStatusCode().value()).isNotEqualTo(429);
    }

    @Test
    void registerIsBlockedAfterExceedingTheIpLimit() {
        for (int i = 0; i < 10; i++) {
            ResponseEntity<Void> response = client().post().uri("/api/auth/register")
                    .body(new RegisterRequest("rl-register-" + i + "-" + System.nanoTime() + "@example.com", "Passw0rd!"))
                    .retrieve().toBodilessEntity();
            assertThat(response.getStatusCode().value()).isNotEqualTo(429);
        }

        ResponseEntity<ApiError> blocked = client().post().uri("/api/auth/register")
                .body(new RegisterRequest("rl-register-final-" + System.nanoTime() + "@example.com", "Passw0rd!"))
                .retrieve().toEntity(ApiError.class);

        assertThat(blocked.getStatusCode().value()).isEqualTo(429);
        assertThat(blocked.getHeaders().getFirst("Retry-After")).isNotBlank();
    }

    @Test
    void forgotPasswordIsBlockedAfterExceedingTheEmailLimit() {
        String email = "rl-forgot-" + System.nanoTime() + "@example.com";

        for (int i = 0; i < 3; i++) {
            ResponseEntity<Void> response = client().post().uri("/api/auth/password/forgot")
                    .body(new ForgotPasswordRequest(email))
                    .retrieve().toBodilessEntity();
            assertThat(response.getStatusCode().value()).isNotEqualTo(429);
        }

        ResponseEntity<ApiError> blocked = client().post().uri("/api/auth/password/forgot")
                .body(new ForgotPasswordRequest(email))
                .retrieve().toEntity(ApiError.class);

        assertThat(blocked.getStatusCode().value()).isEqualTo(429);
        assertThat(blocked.getHeaders().getFirst("Retry-After")).isNotBlank();
    }
}
