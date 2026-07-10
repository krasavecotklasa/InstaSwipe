package com.instaswipe.controller;

import com.instaswipe.exception.ApiError;
import com.instaswipe.model.Role;
import com.instaswipe.model.User;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class PostRateLimitTest extends AbstractWebIntegrationTest {

    private User bareUser(String email) {
        return userRepository.save(User.builder()
                .email(email).passwordHash("x")
                .roles(new HashSet<>(Set.of(Role.USER)))
                .enabled(true).emailVerified(true)
                .build());
    }

    @Test
    void postCreationIsBlockedAfterExceedingTheUserLimit() {
        User user = bareUser("rl-post-" + System.nanoTime() + "@example.com");
        String token = tokenFor(user);

        for (int i = 0; i < 20; i++) {
            MultipartBodyBuilder body = new MultipartBodyBuilder();
            body.part("caption", "post " + i);
            ResponseEntity<Void> response = client(token).post().uri("/api/posts")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body.build())
                    .retrieve().toBodilessEntity();
            assertThat(response.getStatusCode().value()).isNotEqualTo(429);
        }

        MultipartBodyBuilder blockedBody = new MultipartBodyBuilder();
        blockedBody.part("caption", "one too many");
        ResponseEntity<ApiError> blocked = client(token).post().uri("/api/posts")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(blockedBody.build())
                .retrieve().toEntity(ApiError.class);

        assertThat(blocked.getStatusCode().value()).isEqualTo(429);
        assertThat(blocked.getHeaders().getFirst("Retry-After")).isNotBlank();

        // a different user is not affected by the first user's blocked bucket
        User otherUser = bareUser("rl-post-other-" + System.nanoTime() + "@example.com");
        MultipartBodyBuilder otherBody = new MultipartBodyBuilder();
        otherBody.part("caption", "unaffected");
        ResponseEntity<Void> otherResponse = client(tokenFor(otherUser)).post().uri("/api/posts")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(otherBody.build())
                .retrieve().toBodilessEntity();
        assertThat(otherResponse.getStatusCode().value()).isNotEqualTo(429);
    }
}
