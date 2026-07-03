package com.instaswipe.controller;

import com.instaswipe.dto.AdminUserDetailResponse;
import com.instaswipe.exception.ApiError;
import com.instaswipe.model.Gender;
import com.instaswipe.model.User;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AdminUserDetailTest extends AbstractWebIntegrationTest {

    @Test
    void adminGetsFullUserDetail() {
        User target = createDiscoverableUser("target@example.com", Gender.FEMALE, "BG",
                LocalDate.now().minusYears(28), List.of("art", "music", "travel"));
        User admin = createAdmin("admin@example.com");

        ResponseEntity<AdminUserDetailResponse> response = client(tokenFor(admin)).get()
                .uri("/api/admin/users/" + target.getId())
                .retrieve().toEntity(AdminUserDetailResponse.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().email()).isEqualTo("target@example.com");
        assertThat(response.getBody().country()).isEqualTo("BG");
        assertThat(response.getBody().interests()).contains("art", "music", "travel");
        assertThat(response.getBody().likedCount()).isZero();
        assertThat(response.getBody().passedCount()).isZero();
    }

    @Test
    void missingUserReturnsUniformNotFound() {
        User admin = createAdmin("admin@example.com");

        ResponseEntity<ApiError> response = client(tokenFor(admin)).get()
                .uri("/api/admin/users/nonexistent-id")
                .retrieve().toEntity(ApiError.class);

        assertThat(response.getStatusCode().value()).isEqualTo(404);
        assertThat(response.getBody().message()).isEqualTo("Resource not found");
    }

    @Test
    void regularUserIsForbidden() {
        User user = createDiscoverableUser("user@example.com", Gender.MALE, "US",
                LocalDate.now().minusYears(25), List.of("music"));
        User target = createDiscoverableUser("target@example.com", Gender.FEMALE, "US",
                LocalDate.now().minusYears(28), List.of("art"));

        ResponseEntity<Void> response = client(tokenFor(user)).get()
                .uri("/api/admin/users/" + target.getId())
                .retrieve().toBodilessEntity();

        assertThat(response.getStatusCode().value()).isEqualTo(403);
    }
}
