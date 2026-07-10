package com.instaswipe.controller;

import com.instaswipe.exception.ApiError;
import com.instaswipe.model.Role;
import com.instaswipe.model.User;
import com.instaswipe.service.MediaStorageService;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class ProfileRateLimitTest extends AbstractWebIntegrationTest {

    @MockitoBean
    private MediaStorageService mediaStorageService;

    @MockitoBean
    private RabbitTemplate rabbitTemplate;

    @BeforeEach
    void stubStorage() {
        when(mediaStorageService.upload(any(), any(), any(), any(), any())).thenReturn("user/tmp/raw.jpg");
        when(mediaStorageService.publicUrl(any())).thenReturn("https://cdn.test/tmp/raw.jpg");
    }

    private User bareUser(String email) {
        return userRepository.save(User.builder()
                .email(email).passwordHash("x")
                .roles(new HashSet<>(Set.of(Role.USER)))
                .enabled(true).emailVerified(true)
                .build());
    }

    private static Resource jpegPart() {
        byte[] bytes = jpegBytes();
        return new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return "pic.jpg";
            }
        };
    }

    @Test
    void profilePictureUploadIsBlockedAfterExceedingTheUserLimit() {
        User user = bareUser("rl-pic-" + System.nanoTime() + "@example.com");
        String token = tokenFor(user);

        for (int i = 0; i < 10; i++) {
            MultipartBodyBuilder body = new MultipartBodyBuilder();
            body.part("file", jpegPart()).contentType(MediaType.IMAGE_JPEG);
            ResponseEntity<Void> response = client(token).post().uri("/api/profile/picture")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body.build())
                    .retrieve().toBodilessEntity();
            assertThat(response.getStatusCode().value()).isNotEqualTo(429);
        }

        MultipartBodyBuilder blockedBody = new MultipartBodyBuilder();
        blockedBody.part("file", jpegPart()).contentType(MediaType.IMAGE_JPEG);
        ResponseEntity<ApiError> blocked = client(token).post().uri("/api/profile/picture")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(blockedBody.build())
                .retrieve().toEntity(ApiError.class);

        assertThat(blocked.getStatusCode().value()).isEqualTo(429);
        assertThat(blocked.getHeaders().getFirst("Retry-After")).isNotBlank();
    }
}
