package com.instaswipe.support;

import com.instaswipe.TestcontainersConfiguration;
import com.instaswipe.model.Gender;
import com.instaswipe.model.Media;
import com.instaswipe.model.MediaType;
import com.instaswipe.model.Role;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.repository.UserRepository;
import com.instaswipe.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatusCode;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.client.RestClient;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = "spring.data.mongodb.auto-index-creation=true")
public abstract class AbstractWebIntegrationTest {

    @LocalServerPort
    protected int port;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected JwtService jwtService;

    @Autowired
    protected MongoTemplate mongoTemplate;

    @BeforeEach
    void clearUsers() {
        userRepository.deleteAll();
    }

    protected RestClient client() {
        return client(null);
    }

    protected RestClient client(String token) {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl("http://localhost:" + port)
                // Swallow error statuses so tests can assert on ResponseEntity#getStatusCode().
                .defaultStatusHandler(HttpStatusCode::isError, (request, response) -> { });
        if (token != null) {
            builder.defaultHeader("Authorization", "Bearer " + token);
        }
        return builder.build();
    }

    protected String tokenFor(User user) {
        return jwtService.generateAccessToken(user);
    }

    protected User createDiscoverableUser(String email, Gender gender, String country,
                                          LocalDate birthDate, List<String> interests) {
        UserProfile profile = UserProfile.builder()
                .name(email.split("@")[0])
                .bio("bio")
                .gender(gender)
                .country(country)
                .birthDate(birthDate)
                .interests(interests)
                .profilePicture(Media.builder()
                        .type(MediaType.IMAGE)
                        .url("https://example.com/pic.jpg")
                        .filename("pic.jpg")
                        .size(1024)
                        .build())
                .build();
        User user = User.builder()
                .email(email)
                .passwordHash("x")
                .roles(new HashSet<>(Set.of(Role.USER)))
                .enabled(true)
                .emailVerified(true)
                .profile(profile)
                .build();
        return userRepository.save(user);
    }

    /** A small, valid JPEG so uploads pass real ImageProcessingService validation. */
    protected static byte[] jpegBytes() {
        BufferedImage img = new BufferedImage(64, 64, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(30, 144, 255));
        g.fillRect(0, 0, 64, 64);
        g.dispose();
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, "jpg", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    protected User createAdmin(String email) {
        User user = User.builder()
                .email(email)
                .passwordHash("x")
                .roles(new HashSet<>(Set.of(Role.ADMIN)))
                .enabled(true)
                .emailVerified(true)
                .build();
        return userRepository.save(user);
    }
}
