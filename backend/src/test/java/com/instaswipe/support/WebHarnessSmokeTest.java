package com.instaswipe.support;

import com.instaswipe.model.Gender;
import com.instaswipe.model.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WebHarnessSmokeTest extends AbstractWebIntegrationTest {

    @Test
    void authenticatedRequestReachesProtectedEndpoint() {
        User user = createDiscoverableUser("smoke@example.com", Gender.MALE, "US",
                LocalDate.now().minusYears(25), List.of("music", "art", "sport"));

        ResponseEntity<String> response = client(tokenFor(user)).get()
                .uri("/api/profile/status")
                .retrieve().toEntity(String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void anonymousRequestIsRejected() {
        ResponseEntity<Void> response = client().get()
                .uri("/api/profile/status")
                .retrieve().toBodilessEntity();

        // No auth mechanism is configured, so Spring Security answers 401 or 403.
        assertThat(response.getStatusCode().value()).isIn(401, 403);
    }
}
