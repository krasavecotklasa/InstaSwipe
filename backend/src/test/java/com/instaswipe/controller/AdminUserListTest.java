package com.instaswipe.controller;

import com.instaswipe.dto.AdminUserSummaryResponse;
import com.instaswipe.dto.PageResponse;
import com.instaswipe.model.Gender;
import com.instaswipe.model.User;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AdminUserListTest extends AbstractWebIntegrationTest {

    @Test
    void anonymousIsRejected() {
        ResponseEntity<Void> response = client().get()
                .uri("/api/admin/users")
                .retrieve().toBodilessEntity();
        assertThat(response.getStatusCode().value()).isIn(401, 403);
    }

    @Test
    void regularUserIsForbidden() {
        User user = createDiscoverableUser("user@example.com", Gender.MALE, "US",
                LocalDate.now().minusYears(25), List.of("music"));
        ResponseEntity<Void> response = client(tokenFor(user)).get()
                .uri("/api/admin/users")
                .retrieve().toBodilessEntity();
        assertThat(response.getStatusCode().value()).isEqualTo(403);
    }

    @Test
    void adminSeesAllUsersIncludingDisabled() {
        createDiscoverableUser("a@example.com", Gender.MALE, "US",
                LocalDate.now().minusYears(25), List.of("music"));
        User disabled = createDiscoverableUser("b@example.com", Gender.FEMALE, "US",
                LocalDate.now().minusYears(30), List.of("art"));
        disabled.setEnabled(false);
        userRepository.save(disabled);
        User admin = createAdmin("admin@example.com");

        ResponseEntity<PageResponse<AdminUserSummaryResponse>> response = client(tokenFor(admin)).get()
                .uri("/api/admin/users?page=0&size=10")
                .retrieve()
                .toEntity(new ParameterizedTypeReference<>() {});

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().totalElements()).isEqualTo(3);
        assertThat(response.getBody().content())
                .extracting(AdminUserSummaryResponse::email)
                .contains("a@example.com", "b@example.com", "admin@example.com");
    }
}
