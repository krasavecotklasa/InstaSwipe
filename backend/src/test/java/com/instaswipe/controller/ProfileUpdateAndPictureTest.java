package com.instaswipe.controller;

import com.instaswipe.config.RabbitMQConfig;
import com.instaswipe.dto.PasswordChangeRequest;
import com.instaswipe.dto.ProfilePictureResponse;
import com.instaswipe.event.ImageProcessingEvent;
import com.instaswipe.event.ImageTarget;
import com.instaswipe.model.Gender;
import com.instaswipe.model.Media;
import com.instaswipe.model.MediaStatus;
import com.instaswipe.model.Role;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.service.MediaStorageService;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers both profile-picture upload paths — the dedicated POST /api/profile/picture
 * and the inline file on the multipart PUT /api/profile/update — under the async
 * pipeline: the request stores the raw bytes, persists a PROCESSING placeholder, and
 * queues finalization. S3 and RabbitMQ are mocked; validation runs for real.
 */
class ProfileUpdateAndPictureTest extends AbstractWebIntegrationTest {

    private static final String RAW_KEY = "user/tmp/raw.jpg";
    private static final String PREVIEW_URL = "https://cdn.test/tmp/raw.jpg";

    @MockitoBean
    private MediaStorageService mediaStorageService;

    @MockitoBean
    private RabbitTemplate rabbitTemplate;

    @BeforeEach
    void stubStorage() {
        when(mediaStorageService.upload(any(), any(), any(), any(), any())).thenReturn(RAW_KEY);
        when(mediaStorageService.publicUrl(any())).thenReturn(PREVIEW_URL);
    }

    private User bareUser(String email) {
        return userRepository.save(User.builder()
                .email(email).passwordHash("x")
                .roles(new HashSet<>(Set.of(Role.USER)))
                .enabled(true).emailVerified(true)
                .build());
    }

    private static Resource jpegPart() {
        return namedResource(jpegBytes());
    }

    private static Resource namedResource(byte[] bytes) {
        return new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return "pic.jpg";
            }
        };
    }

    private MultipartBodyBuilder profileFields() {
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("displayName", "Ada");
        body.part("bio", "math and machines");
        body.part("birthDate", "1995-01-01");
        body.part("country", "UK");
        body.part("gender", "FEMALE");
        body.part("interests", "math");
        body.part("interests", "chess");
        body.part("interests", "poetry");
        return body;
    }

    @Test
    void uploadProfilePictureAcceptsStoresPendingAndQueues() {
        User user = bareUser("pic@x.com");
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("file", jpegPart()).contentType(MediaType.IMAGE_JPEG);

        ResponseEntity<ProfilePictureResponse> response = client(tokenFor(user)).post()
                .uri("/api/profile/picture")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body.build())
                .retrieve().toEntity(ProfilePictureResponse.class);

        // Accepted for background processing, returns the raw preview + PROCESSING status
        assertThat(response.getStatusCode().value()).isEqualTo(202);
        assertThat(response.getBody().url()).isEqualTo(PREVIEW_URL);
        assertThat(response.getBody().status()).isEqualTo(MediaStatus.PROCESSING);

        // Placeholder persisted on the profile
        Media stored = userRepository.findById(user.getId()).orElseThrow().getProfile().getProfilePicture();
        assertThat(stored).isNotNull();
        assertThat(stored.getUrl()).isEqualTo(PREVIEW_URL);
        assertThat(stored.getStatus()).isEqualTo(MediaStatus.PROCESSING);

        // Finalization event published for the PROFILE target
        ArgumentCaptor<ImageProcessingEvent> event = ArgumentCaptor.forClass(ImageProcessingEvent.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.IMAGE_EXCHANGE), eq(RabbitMQConfig.IMAGE_ROUTING), (Object) event.capture());
        assertThat(event.getValue().target()).isEqualTo(ImageTarget.PROFILE);
        assertThat(event.getValue().rawKey()).isEqualTo(RAW_KEY);
        assertThat(event.getValue().userId()).isEqualTo(user.getId());
    }

    @Test
    void uploadProfilePictureRejectsUnsupportedType() {
        User user = bareUser("bad@x.com");
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("file", namedResource("not an image".getBytes(StandardCharsets.UTF_8)))
                .contentType(MediaType.TEXT_PLAIN);

        ResponseEntity<Void> response = client(tokenFor(user)).post()
                .uri("/api/profile/picture")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body.build())
                .retrieve().toBodilessEntity();

        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void uploadProfilePictureRejectsAnonymous() {
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("file", jpegPart()).contentType(MediaType.IMAGE_JPEG);

        ResponseEntity<Void> response = client().post()
                .uri("/api/profile/picture")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body.build())
                .retrieve().toBodilessEntity();

        assertThat(response.getStatusCode().value()).isIn(401, 403);
    }

    @Test
    void changePasswordUpdatesHashWhenCurrentPasswordMatches() {
        User user = bareUser("pass@x.com");
        user.setPasswordHash(new BCryptPasswordEncoder().encode("password123!"));
        userRepository.save(user);

        ResponseEntity<String> response = client(tokenFor(user)).put()
                .uri("/api/profile/password")
                .contentType(MediaType.APPLICATION_JSON)
                .body(new PasswordChangeRequest("password123!", "NewPass123!"))
                .retrieve().toEntity(String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        User stored = userRepository.findById(user.getId()).orElseThrow();
        assertThat(stored.getPasswordHash()).isNotEqualTo(user.getPasswordHash());
        assertThat(stored.getPasswordHash()).isNotEqualTo("password123!");
    }

    @Test
    void changePasswordRejectsWrongCurrentPassword() {
        User user = bareUser("wrongpass@x.com");
        user.setPasswordHash(new BCryptPasswordEncoder().encode("password123!"));
        userRepository.save(user);

        ResponseEntity<Void> response = client(tokenFor(user)).put()
                .uri("/api/profile/password")
                .contentType(MediaType.APPLICATION_JSON)
                .body(new PasswordChangeRequest("wrongPassword!", "NewPass123!"))
                .retrieve().toBodilessEntity();

        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void updateProfileWithInlinePictureSetsNameAndPendingMedia() {
        User user = bareUser("onboard@x.com");
        MultipartBodyBuilder body = profileFields();
        body.part("profilePicture", jpegPart()).contentType(MediaType.IMAGE_JPEG);

        ResponseEntity<String> response = client(tokenFor(user)).put()
                .uri("/api/profile/update")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body.build())
                .retrieve().toEntity(String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        UserProfile profile = userRepository.findById(user.getId()).orElseThrow().getProfile();
        assertThat(profile.getName()).isEqualTo("Ada");
        assertThat(profile.getProfilePicture()).isNotNull();
        assertThat(profile.getProfilePicture().getUrl()).isEqualTo(PREVIEW_URL);
        assertThat(profile.getProfilePicture().getStatus()).isEqualTo(MediaStatus.PROCESSING);

        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.IMAGE_EXCHANGE), eq(RabbitMQConfig.IMAGE_ROUTING), any(ImageProcessingEvent.class));
    }

    @Test
    void updateProfileRejectsBioOverMaxLength() {
        User user = bareUser("longbio@x.com");
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("displayName", "Ada");
        body.part("bio", "b".repeat(151));
        body.part("birthDate", "1995-01-01");
        body.part("country", "UK");
        body.part("gender", "FEMALE");
        body.part("interests", "math");
        body.part("interests", "chess");
        body.part("interests", "poetry");

        ResponseEntity<Void> response = client(tokenFor(user)).put()
                .uri("/api/profile/update")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body.build())
                .retrieve().toBodilessEntity();

        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void updateProfileWithoutPictureKeepsExisting() {
        User user = createDiscoverableUser("keep@x.com", Gender.FEMALE, "US",
                LocalDate.now().minusYears(30), List.of("art", "film", "music"));
        String originalUrl = user.getProfile().getProfilePicture().getUrl();

        ResponseEntity<String> response = client(tokenFor(user)).put()
                .uri("/api/profile/update")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(profileFields().build())
                .retrieve().toEntity(String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        Media picture = userRepository.findById(user.getId()).orElseThrow().getProfile().getProfilePicture();
        assertThat(picture.getUrl()).isEqualTo(originalUrl);
    }

    @Test
    void uploadDoesNotPassInFlightProcessingPictureAsPreviousKey() {
        User user = bareUser("proc@x.com");
        // An earlier upload is still PROCESSING; its URL points at a temp raw object.
        user.setProfile(UserProfile.builder()
                .profilePicture(Media.builder()
                        .url("https://cdn.test/tmp/inflight.jpg")
                        .status(MediaStatus.PROCESSING)
                        .build())
                .build());
        userRepository.save(user);
        // Even if a key could be extracted, the in-flight temp object must not be a deletion target.
        when(mediaStorageService.extractKeyFromUrl("https://cdn.test/tmp/inflight.jpg"))
                .thenReturn("proc/tmp/inflight.jpg");

        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("file", jpegPart()).contentType(MediaType.IMAGE_JPEG);
        client(tokenFor(user)).post().uri("/api/profile/picture")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body.build())
                .retrieve().toEntity(ProfilePictureResponse.class);

        ArgumentCaptor<ImageProcessingEvent> event = ArgumentCaptor.forClass(ImageProcessingEvent.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.IMAGE_EXCHANGE), eq(RabbitMQConfig.IMAGE_ROUTING), (Object) event.capture());
        assertThat(event.getValue().previousKey()).isNull();
    }

    @Test
    void uploadPassesReadyPreviousPictureKeyForDeletion() {
        User user = bareUser("ready@x.com");
        user.setProfile(UserProfile.builder()
                .profilePicture(Media.builder()
                        .url("https://cdn.test/media/u/profile/old.jpg")
                        .status(MediaStatus.READY)
                        .build())
                .build());
        userRepository.save(user);
        when(mediaStorageService.extractKeyFromUrl("https://cdn.test/media/u/profile/old.jpg"))
                .thenReturn("u/profile/old.jpg");

        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("file", jpegPart()).contentType(MediaType.IMAGE_JPEG);
        client(tokenFor(user)).post().uri("/api/profile/picture")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body.build())
                .retrieve().toEntity(ProfilePictureResponse.class);

        ArgumentCaptor<ImageProcessingEvent> event = ArgumentCaptor.forClass(ImageProcessingEvent.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.IMAGE_EXCHANGE), eq(RabbitMQConfig.IMAGE_ROUTING), (Object) event.capture());
        assertThat(event.getValue().previousKey()).isEqualTo("u/profile/old.jpg");
    }
}
