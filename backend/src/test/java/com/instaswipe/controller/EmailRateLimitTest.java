package com.instaswipe.controller;

import com.instaswipe.exception.ApiError;
import com.instaswipe.model.Role;
import com.instaswipe.model.User;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class EmailRateLimitTest extends AbstractWebIntegrationTest {

    private User adminUser(String email) {
        return userRepository.save(User.builder()
                .email(email).passwordHash("x")
                .roles(new HashSet<>(Set.of(Role.ADMIN)))
                .enabled(true).emailVerified(true)
                .build());
    }

    @Test
    void testEmailEndpointIsBlockedAfterExceedingTheUserLimit() {
        User admin = adminUser("rl-admin-" + System.nanoTime() + "@example.com");
        User target = adminUser("rl-target-" + System.nanoTime() + "@example.com");
        String token = tokenFor(admin);

        for (int i = 0; i < 20; i++) {
            ResponseEntity<Void> response = client(token).post().uri("/api/emails/test/" + target.getId())
                    .retrieve().toBodilessEntity();
            assertThat(response.getStatusCode().value()).isNotEqualTo(429);
        }

        ResponseEntity<ApiError> blocked = client(token).post().uri("/api/emails/test/" + target.getId())
                .retrieve().toEntity(ApiError.class);

        assertThat(blocked.getStatusCode().value()).isEqualTo(429);
        assertThat(blocked.getHeaders().getFirst("Retry-After")).isNotBlank();
    }
}
