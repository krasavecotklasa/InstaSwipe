package com.instaswipe.controller;

import com.instaswipe.exception.ApiError;
import com.instaswipe.model.Role;
import com.instaswipe.model.User;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class MatchControllerTest extends AbstractWebIntegrationTest {

    private User createUser(String email) {
        return userRepository.save(User.builder()
                .email(email)
                .passwordHash("x")
                .roles(new HashSet<>(Set.of(Role.USER)))
                .enabled(true)
                .emailVerified(true)
                .build());
    }

    @Test
    void lovePersonReturns200AndRecordsLike() {
        User actor = createUser("actor@x.com");
        User target = createUser("target@x.com");

        ResponseEntity<String> response = client(tokenFor(actor)).post()
                .uri("/api/matches/" + target.getId() + "/love")
                .retrieve().toEntity(String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo("liked");
        assertThat(userRepository.findById(actor.getId()).orElseThrow().getLikedUserIds())
                .containsExactly(target.getId());
    }

    @Test
    void passPersonReturns200AndRecordsPass() {
        User actor = createUser("actor@x.com");
        User target = createUser("target@x.com");

        ResponseEntity<String> response = client(tokenFor(actor)).post()
                .uri("/api/matches/" + target.getId() + "/pass")
                .retrieve().toEntity(String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo("passed");
        assertThat(userRepository.findById(actor.getId()).orElseThrow().getPassedUserIds())
                .containsExactly(target.getId());
    }

    @Test
    void cannotLoveYourselfReturns400() {
        User actor = createUser("actor@x.com");

        ResponseEntity<ApiError> response = client(tokenFor(actor)).post()
                .uri("/api/matches/" + actor.getId() + "/love")
                .retrieve().toEntity(ApiError.class);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void anonymousIsRejected() {
        ResponseEntity<Void> response = client().post()
                .uri("/api/matches/someone/love")
                .retrieve().toBodilessEntity();
        assertThat(response.getStatusCode().value()).isIn(401, 403);
    }
}
