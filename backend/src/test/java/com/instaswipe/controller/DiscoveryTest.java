package com.instaswipe.controller;

import com.instaswipe.dto.PageResponse;
import com.instaswipe.dto.PublicProfileResponse;
import com.instaswipe.exception.ApiError;
import com.instaswipe.model.Gender;
import com.instaswipe.model.User;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DiscoveryTest extends AbstractWebIntegrationTest {

    @Test
    void filtersByGenderAndExcludesSelf() {
        User requester = createDiscoverableUser("me@x.com", Gender.MALE, "US",
                LocalDate.now().minusYears(25), List.of("music"));
        createDiscoverableUser("her@x.com", Gender.FEMALE, "US",
                LocalDate.now().minusYears(26), List.of("music"));
        createDiscoverableUser("him@x.com", Gender.MALE, "US",
                LocalDate.now().minusYears(27), List.of("music"));

        ResponseEntity<PageResponse<PublicProfileResponse>> response = client(tokenFor(requester)).get()
                .uri("/api/discovery?gender=FEMALE")
                .retrieve().toEntity(new ParameterizedTypeReference<>() {});

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().content())
                .extracting(PublicProfileResponse::displayName).containsExactly("her");
    }

    @Test
    void excludesDisabledUsers() {
        User requester = createDiscoverableUser("me@x.com", Gender.MALE, "US",
                LocalDate.now().minusYears(25), List.of("music"));
        User disabled = createDiscoverableUser("dis@x.com", Gender.FEMALE, "US",
                LocalDate.now().minusYears(26), List.of("music"));
        disabled.setEnabled(false);
        userRepository.save(disabled);
        createDiscoverableUser("ok@x.com", Gender.FEMALE, "US",
                LocalDate.now().minusYears(27), List.of("music"));

        ResponseEntity<PageResponse<PublicProfileResponse>> response = client(tokenFor(requester)).get()
                .uri("/api/discovery?gender=FEMALE")
                .retrieve().toEntity(new ParameterizedTypeReference<>() {});

        assertThat(response.getBody().content())
                .extracting(PublicProfileResponse::displayName).containsExactly("ok");
    }

    @Test
    void filtersByAgeRange() {
        User requester = createDiscoverableUser("me@x.com", Gender.MALE, "US",
                LocalDate.now().minusYears(25), List.of("music"));
        createDiscoverableUser("young@x.com", Gender.FEMALE, "US",
                LocalDate.now().minusYears(19), List.of("music"));
        createDiscoverableUser("match@x.com", Gender.FEMALE, "US",
                LocalDate.now().minusYears(30), List.of("music"));
        createDiscoverableUser("old@x.com", Gender.FEMALE, "US",
                LocalDate.now().minusYears(50), List.of("music"));

        ResponseEntity<PageResponse<PublicProfileResponse>> response = client(tokenFor(requester)).get()
                .uri("/api/discovery?minAge=25&maxAge=35")
                .retrieve().toEntity(new ParameterizedTypeReference<>() {});

        assertThat(response.getBody().content())
                .extracting(PublicProfileResponse::displayName).containsExactly("match");
    }

    @Test
    void invalidAgeRangeReturns400() {
        User requester = createDiscoverableUser("me@x.com", Gender.MALE, "US",
                LocalDate.now().minusYears(25), List.of("music"));

        ResponseEntity<ApiError> response = client(tokenFor(requester)).get()
                .uri("/api/discovery?minAge=40&maxAge=20")
                .retrieve().toEntity(ApiError.class);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void negativeAgeReturns400() {
        User requester = createDiscoverableUser("me@x.com", Gender.MALE, "US",
                LocalDate.now().minusYears(25), List.of("music"));

        ResponseEntity<ApiError> response = client(tokenFor(requester)).get()
                .uri("/api/discovery?minAge=-5")
                .retrieve().toEntity(ApiError.class);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void anonymousIsRejected() {
        ResponseEntity<Void> response = client().get()
                .uri("/api/discovery")
                .retrieve().toBodilessEntity();
        assertThat(response.getStatusCode().value()).isIn(401, 403);
    }
}
