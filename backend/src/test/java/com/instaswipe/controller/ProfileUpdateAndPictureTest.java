package com.instaswipe.controller;

import com.instaswipe.dto.ProfilePictureResponse;
import com.instaswipe.model.Gender;
import com.instaswipe.model.Media;
import com.instaswipe.model.Role;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.service.MediaStorageService;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Covers both profile-picture upload paths — the dedicated POST /api/profile/picture
 * and the inline file on the multipart PUT /api/profile/update — plus the keep-existing
 * and validation branches. S3 is mocked; ImageProcessingService runs for real.
 */
class ProfileUpdateAndPictureTest extends AbstractWebIntegrationTest {

    private static final String STUB_URL = "https://cdn.test/profile.jpg";

    @MockitoBean
    private MediaStorageService mediaStorageService;

    @BeforeEach
    void stubStorage() {
        when(mediaStorageService.upload(any(), any(), any(), any())).thenReturn(STUB_URL);
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
    void uploadProfilePictureStoresMediaAndReturnsUrl() {
        User user = bareUser("pic@x.com");
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("file", jpegPart()).contentType(MediaType.IMAGE_JPEG);

        ResponseEntity<ProfilePictureResponse> response = client(tokenFor(user)).post()
                .uri("/api/profile/picture")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body.build())
                .retrieve().toEntity(ProfilePictureResponse.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().url()).isEqualTo(STUB_URL);

        Media stored = userRepository.findById(user.getId()).orElseThrow().getProfile().getProfilePicture();
        assertThat(stored).isNotNull();
        assertThat(stored.getUrl()).isEqualTo(STUB_URL);
    }

    @Test
    void uploadProfilePictureRejectsNonImage() {
        User user = bareUser("bad@x.com");
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("file", namedResource("not an image".getBytes(StandardCharsets.UTF_8)))
                .contentType(MediaType.IMAGE_JPEG);

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
    void updateProfileWithInlinePictureSetsNameAndMedia() {
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
        assertThat(profile.getProfilePicture().getUrl()).isEqualTo(STUB_URL);
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
}
