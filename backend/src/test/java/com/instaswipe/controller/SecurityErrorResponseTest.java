package com.instaswipe.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;

import javax.crypto.SecretKey;

import com.instaswipe.model.User;
import com.instaswipe.support.AbstractWebIntegrationTest;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;

/**
 * The security filter chain rejects requests before they reach a controller, so these responses
 * bypass {@code GlobalExceptionHandler}. They must still speak the same {@code ApiError} shape and
 * distinguish "not authenticated" (401) from "authenticated but forbidden" (403).
 */
class SecurityErrorResponseTest extends AbstractWebIntegrationTest {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    private ResponseEntity<String> getAdminUsers(String token) {
        return client(token).get().uri("/api/admin/users").retrieve().toEntity(String.class);
    }

    @Test
    void missingTokenReturns401WithApiErrorBody() {
        ResponseEntity<String> response = client().get().uri("/api/admin/users")
                .retrieve().toEntity(String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getBody()).contains("\"status\":401");
        assertThat(response.getBody().toLowerCase()).contains("authentication");
    }

    @Test
    void expiredTokenReturns401ExplainingExpiry() {
        ResponseEntity<String> response = getAdminUsers(expiredToken("some-user-id"));

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getBody().toLowerCase()).contains("expired");
    }

    @Test
    void malformedTokenReturns401ExplainingInvalidity() {
        ResponseEntity<String> response = getAdminUsers("this-is-not-a-jwt");

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getBody().toLowerCase()).contains("invalid");
    }

    @Test
    void authenticatedNonAdminReturns403WithApiErrorBody() {
        User user = userRepository.save(User.builder()
                .email("user@example.com")
                .passwordHash("x")
                .build());

        ResponseEntity<String> response = getAdminUsers(tokenFor(user));

        assertThat(response.getStatusCode().value()).isEqualTo(403);
        assertThat(response.getBody()).contains("\"status\":403");
        assertThat(response.getBody().toLowerCase()).contains("permission");
    }

    private String expiredToken(String userId) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId)
                .claim("roles", List.of("USER"))
                .issuedAt(Date.from(now.minusSeconds(7200)))
                .expiration(Date.from(now.minusSeconds(3600)))
                .signWith(key)
                .compact();
    }
}
