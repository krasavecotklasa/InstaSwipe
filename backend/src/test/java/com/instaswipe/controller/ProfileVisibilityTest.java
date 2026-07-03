package com.instaswipe.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.Period;
import java.util.List;

import com.instaswipe.TestcontainersConfiguration;
import com.instaswipe.dto.AuthResponse;
import com.instaswipe.dto.LoginRequest;
import com.instaswipe.dto.PublicProfileResponse;
import com.instaswipe.dto.RegisterRequest;
import com.instaswipe.dto.UserResponse;
import com.instaswipe.model.Gender;
import com.instaswipe.model.Media;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.repository.RefreshTokenRepository;
import com.instaswipe.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.client.RestClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = "spring.data.mongodb.auto-index-creation=true")
class ProfileVisibilityTest {

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    private RestClient client;

    @BeforeEach
    void setUp() {
        client = RestClient.create("http://localhost:" + port);
        userRepository.deleteAll();
        refreshTokenRepository.deleteAll();
    }

    private record HttpResult<T>(HttpStatusCode status, T body) {
    }

    private <T> HttpResult<T> send(RestClient.RequestBodySpec spec, String token, Object body, Class<T> type) {
        spec.contentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            spec.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        }
        if (body != null) {
            spec.body(body);
        }
        return spec.exchange((request, response) -> new HttpResult<>(
                response.getStatusCode(),
                response.getStatusCode().is2xxSuccessful() && type != Void.class ? response.bodyTo(type) : null));
    }

    private <T> HttpResult<T> getAuthed(String uri, String token, Class<T> type) {
        RestClient.RequestBodySpec spec = client.method(org.springframework.http.HttpMethod.GET).uri(uri);
        return send(spec, token, null, type);
    }

    private String registerAndLogin(String email) {
        send(client.post().uri("/api/auth/register"), null,
                new RegisterRequest(email, "Password123!", "Name"), UserResponse.class);
        return send(client.post().uri("/api/auth/login"), null,
                new LoginRequest(email, "Password123!"), AuthResponse.class).body().accessToken();
    }

    private String userId(String email) {
        return userRepository.findByEmail(email).orElseThrow().getId();
    }

    // Establish a discoverable profile directly; the /profile/update mechanics are
    // covered by ProfileUpdateAndPictureTest. This test focuses on cross-user visibility.
    private void completeOnboarding(String email) {
        User user = userRepository.findByEmail(email).orElseThrow();
        user.setProfile(UserProfile.builder()
                .name("Ada Lovelace").bio("Math and machines").birthDate(LocalDate.of(1995, 1, 1))
                .country("UK").gender(Gender.FEMALE).interests(List.of("math", "chess", "poetry"))
                .profilePicture(Media.builder()
                        .type(com.instaswipe.model.MediaType.IMAGE).url("https://img.example/ada.jpg").build())
                .build());
        userRepository.save(user);
    }

    @Test
    void returnsDiscoverableProfileToAnotherAuthenticatedUser() {
        registerAndLogin("ada@example.com");
        completeOnboarding("ada@example.com");
        String adaId = userId("ada@example.com");
        String viewerToken = registerAndLogin("viewer@example.com");

        HttpResult<PublicProfileResponse> result = getAuthed("/api/profile/" + adaId, viewerToken,
                PublicProfileResponse.class);

        assertThat(result.status().value()).isEqualTo(200);
        assertThat(result.body().displayName()).isEqualTo("Ada Lovelace");
        assertThat(result.body().age())
                .isEqualTo(Period.between(LocalDate.of(1995, 1, 1), LocalDate.now()).getYears());
    }

    @Test
    void hidesProfileThatHasNotCompletedOnboarding() {
        registerAndLogin("incomplete@example.com");
        String incompleteId = userId("incomplete@example.com");
        String viewerToken = registerAndLogin("viewer2@example.com");

        HttpResult<Void> result = getAuthed("/api/profile/" + incompleteId, viewerToken, Void.class);

        assertThat(result.status().value()).isEqualTo(404);
    }

    @Test
    void returnsNotFoundForUnknownProfile() {
        String viewerToken = registerAndLogin("viewer3@example.com");

        HttpResult<Void> result = getAuthed("/api/profile/does-not-exist", viewerToken, Void.class);

        assertThat(result.status().value()).isEqualTo(404);
    }

    @Test
    void rejectsUnauthenticatedProfileAccess() {
        HttpResult<Void> result = getAuthed("/api/profile/anything", null, Void.class);

        assertThat(result.status().is2xxSuccessful()).isFalse();
    }
}
