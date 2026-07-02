package com.instaswipe.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import com.instaswipe.TestcontainersConfiguration;
import com.instaswipe.dto.AuthResponse;
import com.instaswipe.dto.LoginRequest;
import com.instaswipe.dto.RegisterRequest;
import com.instaswipe.dto.TokenRequest;
import com.instaswipe.dto.UserResponse;
import com.instaswipe.model.RefreshToken;
import com.instaswipe.model.Role;
import com.instaswipe.model.User;
import com.instaswipe.repository.RefreshTokenRepository;
import com.instaswipe.repository.UserRepository;
import com.instaswipe.service.JwtService;
import com.instaswipe.service.RefreshTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.client.RestClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = "spring.data.mongodb.auto-index-creation=true")
class AuthEndpointTest {

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private RestClient client;

    @BeforeEach
    void setUp() {
        client = RestClient.create("http://localhost:" + port);
        userRepository.deleteAll();
        refreshTokenRepository.deleteAll();
    }

    private record HttpResult<T>(HttpStatusCode status, T body) {
    }

    private <T> HttpResult<T> post(String uri, Object requestBody, Class<T> responseType) {
        RestClient.RequestBodySpec spec = client.post().uri(uri)
                .contentType(MediaType.APPLICATION_JSON);
        if (requestBody != null) {
            spec.body(requestBody);
        }
        return spec
                .exchange((request, response) -> new HttpResult<>(
                        response.getStatusCode(),
                        response.getStatusCode().is2xxSuccessful() && responseType != Void.class
                                ? response.bodyTo(responseType)
                                : null));
    }

    @Test
    void registerCreatesUserWithHashedPassword() {
        HttpResult<UserResponse> result = post("/api/auth/register",
                new RegisterRequest("New@Example.com", "Password123!", "Ada"), UserResponse.class);

        assertThat(result.status().value()).isEqualTo(201);
        assertThat(result.body()).isNotNull();
        assertThat(result.body().email()).isEqualTo("new@example.com");
        assertThat(result.body().id()).isNotBlank();

        User saved = userRepository.findByEmail("new@example.com").orElseThrow();
        assertThat(saved.getPasswordHash()).isNotEqualTo("Password123!");
        assertThat(passwordEncoder.matches("Password123!", saved.getPasswordHash())).isTrue();
        assertThat(saved.getRoles()).containsExactly(Role.USER);
        assertThat(saved.getProfile().getName()).isEqualTo("Ada");
    }

    @Test
    void registerRejectsDuplicateEmail() {
        RegisterRequest request = new RegisterRequest("dupe@example.com", "Password123!", "Dee");
        post("/api/auth/register", request, UserResponse.class);

        HttpResult<UserResponse> second = post("/api/auth/register", request, UserResponse.class);

        assertThat(second.status().value()).isEqualTo(409);
    }

    @Test
    void registerRejectsInvalidBody() {
        HttpResult<UserResponse> result = post("/api/auth/register",
                new RegisterRequest("not-an-email", "short", ""), UserResponse.class);

        assertThat(result.status().value()).isEqualTo(400);
    }

    @Test
    void loginReturnsAccessAndRefreshTokens() {
        post("/api/auth/register",
                new RegisterRequest("ada@example.com", "Password123!", "Ada"), UserResponse.class);

        HttpResult<AuthResponse> result = post("/api/auth/login",
                new LoginRequest("ada@example.com", "Password123!"), AuthResponse.class);

        assertThat(result.status().value()).isEqualTo(200);
        AuthResponse body = result.body();
        assertThat(body).isNotNull();
        assertThat(body.accessToken()).isNotBlank();
        assertThat(body.refreshToken()).isNotBlank();
        assertThat(body.user().email()).isEqualTo("ada@example.com");

        String userId = body.user().id();
        assertThat(jwtService.extractUserId(body.accessToken())).isEqualTo(userId);

        List<RefreshToken> stored = refreshTokenRepository.findByUserId(userId);
        assertThat(stored).hasSize(1);
        assertThat(stored.get(0).getTokenHash()).isEqualTo(RefreshTokenService.hash(body.refreshToken()));
        assertThat(stored.get(0).getTokenHash()).isNotEqualTo(body.refreshToken());
    }

    @Test
    void refreshRotatesRefreshTokenAndReturnsNewTokens() {
        post("/api/auth/register",
                new RegisterRequest("refresh@example.com", "Password123!", "Ada"), UserResponse.class);
        HttpResult<AuthResponse> login = post("/api/auth/login",
                new LoginRequest("refresh@example.com", "Password123!"), AuthResponse.class);
        String oldRefreshToken = login.body().refreshToken();

        HttpResult<AuthResponse> refreshed = post("/api/auth/refresh",
                new TokenRequest(oldRefreshToken), AuthResponse.class);

        assertThat(refreshed.status().value()).isEqualTo(200);
        assertThat(refreshed.body().user().email()).isEqualTo("refresh@example.com");
        String newRefreshToken = refreshed.body().refreshToken();
        assertThat(newRefreshToken).isNotEqualTo(oldRefreshToken);
        assertThat(refreshed.body().accessToken()).isNotBlank();

        List<RefreshToken> stored = refreshTokenRepository.findByUserId(refreshed.body().user().id());
        assertThat(stored).hasSize(2);
        assertThat(stored).anySatisfy(token -> {
            assertThat(token.getTokenHash()).isEqualTo(RefreshTokenService.hash(oldRefreshToken));
            assertThat(token.isRevoked()).isTrue();
        });
        assertThat(stored).anySatisfy(token -> {
            assertThat(token.getTokenHash()).isEqualTo(RefreshTokenService.hash(newRefreshToken));
            assertThat(token.isRevoked()).isFalse();
        });
    }

    @Test
    void logoutRevokesRefreshToken() {
        post("/api/auth/register",
                new RegisterRequest("logout@example.com", "Password123!", "Ada"), UserResponse.class);
        HttpResult<AuthResponse> login = post("/api/auth/login",
                new LoginRequest("logout@example.com", "Password123!"), AuthResponse.class);
        String refreshToken = login.body().refreshToken();

        HttpResult<Void> logout = post("/api/auth/logout", new TokenRequest(refreshToken), Void.class);

        assertThat(logout.status().value()).isEqualTo(204);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(RefreshTokenService.hash(refreshToken))
                .orElseThrow();
        assertThat(stored.isRevoked()).isTrue();
    }

    @Test
    void loginRejectsWrongPassword() {
        post("/api/auth/register",
                new RegisterRequest("bob@example.com", "Password123!", "Bob"), UserResponse.class);

        HttpResult<AuthResponse> result = post("/api/auth/login",
                new LoginRequest("bob@example.com", "wrongpass1"), AuthResponse.class);

        assertThat(result.status().value()).isEqualTo(401);
    }

    @Test
    void loginRejectsUnknownEmail() {
        HttpResult<AuthResponse> result = post("/api/auth/login",
                new LoginRequest("nobody@example.com", "Password123!"), AuthResponse.class);

        assertThat(result.status().value()).isEqualTo(401);
    }
}
