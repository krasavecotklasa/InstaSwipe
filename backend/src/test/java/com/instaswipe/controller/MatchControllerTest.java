package com.instaswipe.controller;

import com.instaswipe.dto.MatchResponse;
import com.instaswipe.dto.PageResponse;
import com.instaswipe.dto.SwipeResult;
import com.instaswipe.dto.SwipeStatus;
import com.instaswipe.exception.ApiError;
import com.instaswipe.model.Role;
import com.instaswipe.model.User;
import com.instaswipe.repository.MatchRepository;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class MatchControllerTest extends AbstractWebIntegrationTest {

    @Autowired
    private MatchRepository matchRepository;

    private User createUser(String email) {
        return userRepository.save(User.builder()
                .email(email)
                .passwordHash("x")
                .roles(new HashSet<>(Set.of(Role.USER)))
                .enabled(true)
                .emailVerified(true)
                .build());
    }

    private String expectedMatchId(String a, String b) {
        return a.compareTo(b) < 0 ? a + "_" + b : b + "_" + a;
    }

    @Test
    void lovePersonWithoutReciprocityReturnsLiked() {
        User actor = createUser("actor@x.com");
        User target = createUser("target@x.com");

        ResponseEntity<SwipeResult> response = client(tokenFor(actor)).post()
                .uri("/api/matches/" + target.getId() + "/love")
                .retrieve().toEntity(SwipeResult.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().status()).isEqualTo(SwipeStatus.LIKED);
        assertThat(response.getBody().matchId()).isNull();
        assertThat(userRepository.findById(actor.getId()).orElseThrow().getLikedUserIds())
                .containsExactly(target.getId());
    }

    @Test
    void passPersonReturnsPassed() {
        User actor = createUser("actor@x.com");
        User target = createUser("target@x.com");

        ResponseEntity<SwipeResult> response = client(tokenFor(actor)).post()
                .uri("/api/matches/" + target.getId() + "/pass")
                .retrieve().toEntity(SwipeResult.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().status()).isEqualTo(SwipeStatus.PASSED);
        assertThat(userRepository.findById(actor.getId()).orElseThrow().getPassedUserIds())
                .containsExactly(target.getId());
    }

    @Test
    void mutualLoveCreatesMatch() {
        User alice = createUser("alice@x.com");
        User bob = createUser("bob@x.com");

        client(tokenFor(alice)).post().uri("/api/matches/" + bob.getId() + "/love")
                .retrieve().toBodilessEntity();

        ResponseEntity<SwipeResult> response = client(tokenFor(bob)).post()
                .uri("/api/matches/" + alice.getId() + "/love")
                .retrieve().toEntity(SwipeResult.class);

        String expectedId = expectedMatchId(alice.getId(), bob.getId());
        assertThat(response.getBody().status()).isEqualTo(SwipeStatus.MATCHED);
        assertThat(response.getBody().matchId()).isEqualTo(expectedId);
        assertThat(matchRepository.findById(expectedId)).isPresent();
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

    @Test
    void listMatchesShowsThePairForBothUsers() {
        User alice = createUser("alice@x.com");
        User bob = createUser("bob@x.com");
        client(tokenFor(alice)).post().uri("/api/matches/" + bob.getId() + "/love")
                .retrieve().toBodilessEntity();
        client(tokenFor(bob)).post().uri("/api/matches/" + alice.getId() + "/love")
                .retrieve().toBodilessEntity();

        ResponseEntity<PageResponse<MatchResponse>> aliceView = client(tokenFor(alice)).get()
                .uri("/api/matches")
                .retrieve().toEntity(new ParameterizedTypeReference<>() {});
        assertThat(aliceView.getStatusCode().value()).isEqualTo(200);
        assertThat(aliceView.getBody().content()).extracting(MatchResponse::otherUserId)
                .containsExactly(bob.getId());
        assertThat(aliceView.getBody().content()).extracting(MatchResponse::matchId)
                .containsExactly(expectedMatchId(alice.getId(), bob.getId()));

        ResponseEntity<PageResponse<MatchResponse>> bobView = client(tokenFor(bob)).get()
                .uri("/api/matches")
                .retrieve().toEntity(new ParameterizedTypeReference<>() {});
        assertThat(bobView.getBody().content()).extracting(MatchResponse::otherUserId)
                .containsExactly(alice.getId());
    }

    @Test
    void listMatchesRequiresAuth() {
        ResponseEntity<Void> response = client().get()
                .uri("/api/matches")
                .retrieve().toBodilessEntity();
        assertThat(response.getStatusCode().value()).isIn(401, 403);
    }
}
