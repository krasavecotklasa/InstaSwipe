package com.instaswipe.controller;

import com.instaswipe.dto.PageResponse;
import com.instaswipe.dto.PublicProfileResponse;
import com.instaswipe.model.Gender;
import com.instaswipe.model.User;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProfileSearchTest extends AbstractWebIntegrationTest {

    @Test
    void searchesByDisplayNameExcludingSelf() {
        User requester = createDiscoverableUser("alice@x.com", Gender.FEMALE, "US",
                LocalDate.now().minusYears(25), List.of("music"));
        createDiscoverableUser("alicia@x.com", Gender.FEMALE, "US",
                LocalDate.now().minusYears(26), List.of("music"));
        createDiscoverableUser("bob@x.com", Gender.MALE, "US",
                LocalDate.now().minusYears(27), List.of("music"));

        ResponseEntity<PageResponse<PublicProfileResponse>> response = client(tokenFor(requester)).get()
                .uri("/api/search/profiles?q=ali")
                .retrieve().toEntity(new ParameterizedTypeReference<>() {});

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        // "alice" (self) also matches "ali" but is excluded; "bob" does not match.
        assertThat(response.getBody().content())
                .extracting(PublicProfileResponse::displayName).containsExactly("alicia");
    }

    @Test
    void blankQueryReturnsEmptyPage() {
        User requester = createDiscoverableUser("me@x.com", Gender.MALE, "US",
                LocalDate.now().minusYears(25), List.of("music"));

        ResponseEntity<PageResponse<PublicProfileResponse>> response = client(tokenFor(requester)).get()
                .uri("/api/search/profiles?q=%20")
                .retrieve().toEntity(new ParameterizedTypeReference<>() {});

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().content()).isEmpty();
    }

    @Test
    void anonymousIsRejected() {
        ResponseEntity<Void> response = client().get()
                .uri("/api/search/profiles?q=ali")
                .retrieve().toBodilessEntity();

        assertThat(response.getStatusCode().value()).isIn(401, 403);
    }
}
