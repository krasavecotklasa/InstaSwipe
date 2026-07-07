package com.instaswipe.controller;

import com.instaswipe.dto.PostResponse;
import com.instaswipe.model.Gender;
import com.instaswipe.model.Post;
import com.instaswipe.model.User;
import com.instaswipe.repository.PostRepository;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end HTTP coverage of the like/unlike endpoints: response shape,
 * idempotency, per-requester {@code likedByMe} vs. aggregate {@code likeCount},
 * 404 on missing posts, and auth enforcement.
 */
class PostLikeTest extends AbstractWebIntegrationTest {

    private static final String MISSING_ID = "000000000000000000000000";

    @Autowired
    private PostRepository postRepository;

    @BeforeEach
    void clearPosts() {
        postRepository.deleteAll();
    }

    private User user(String email) {
        return createDiscoverableUser(email, Gender.MALE, "US",
                LocalDate.now().minusYears(25), List.of("music"));
    }

    private Post savePost(String ownerId) {
        return postRepository.save(Post.builder().userId(ownerId).caption("hello").build());
    }

    @Test
    void likeAddsCurrentUserAndReturnsUpdatedResponse() {
        User owner = user("owner@x.com");
        User liker = user("liker@x.com");
        Post post = savePost(owner.getId());

        ResponseEntity<PostResponse> response = client(tokenFor(liker)).post()
                .uri("/api/posts/{postId}/like", post.getId())
                .retrieve().toEntity(PostResponse.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().likeCount()).isEqualTo(1);
        assertThat(response.getBody().likedByMe()).isTrue();
        assertThat(postRepository.findById(post.getId()).orElseThrow().getLikedBy())
                .containsExactly(liker.getId());
    }

    @Test
    void likeIsIdempotent() {
        User owner = user("owner@x.com");
        User liker = user("liker@x.com");
        Post post = savePost(owner.getId());

        client(tokenFor(liker)).post().uri("/api/posts/{postId}/like", post.getId())
                .retrieve().toBodilessEntity();
        ResponseEntity<PostResponse> second = client(tokenFor(liker)).post()
                .uri("/api/posts/{postId}/like", post.getId())
                .retrieve().toEntity(PostResponse.class);

        assertThat(second.getBody().likeCount()).isEqualTo(1);
    }

    @Test
    void unlikeRemovesCurrentUser() {
        User owner = user("owner@x.com");
        User liker = user("liker@x.com");
        Post post = savePost(owner.getId());
        client(tokenFor(liker)).post().uri("/api/posts/{postId}/like", post.getId())
                .retrieve().toBodilessEntity();

        ResponseEntity<PostResponse> response = client(tokenFor(liker)).post()
                .uri("/api/posts/{postId}/unlike", post.getId())
                .retrieve().toEntity(PostResponse.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().likeCount()).isEqualTo(0);
        assertThat(response.getBody().likedByMe()).isFalse();
    }

    @Test
    void unlikeWithoutPriorLikeIsIdempotent() {
        User owner = user("owner@x.com");
        User liker = user("liker@x.com");
        Post post = savePost(owner.getId());

        ResponseEntity<PostResponse> response = client(tokenFor(liker)).post()
                .uri("/api/posts/{postId}/unlike", post.getId())
                .retrieve().toEntity(PostResponse.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().likeCount()).isEqualTo(0);
    }

    @Test
    void multipleUsersAccumulateLikeCount() {
        User owner = user("owner@x.com");
        User a = user("a@x.com");
        User b = user("b@x.com");
        Post post = savePost(owner.getId());

        client(tokenFor(a)).post().uri("/api/posts/{postId}/like", post.getId())
                .retrieve().toBodilessEntity();
        ResponseEntity<PostResponse> asB = client(tokenFor(b)).post()
                .uri("/api/posts/{postId}/like", post.getId())
                .retrieve().toEntity(PostResponse.class);

        assertThat(asB.getBody().likeCount()).isEqualTo(2);
        assertThat(asB.getBody().likedByMe()).isTrue();
    }

    @Test
    void likeCountIsAggregateWhileLikedByMeIsPerRequester() {
        User owner = user("owner@x.com");
        User a = user("a@x.com");
        User b = user("b@x.com");
        Post post = savePost(owner.getId());

        // A likes the post.
        client(tokenFor(a)).post().uri("/api/posts/{postId}/like", post.getId())
                .retrieve().toBodilessEntity();

        // B, who never liked it, unlikes (idempotent) and observes the shared count
        // of 1 but likedByMe=false for themselves.
        ResponseEntity<PostResponse> asB = client(tokenFor(b)).post()
                .uri("/api/posts/{postId}/unlike", post.getId())
                .retrieve().toEntity(PostResponse.class);

        assertThat(asB.getBody().likeCount()).isEqualTo(1);
        assertThat(asB.getBody().likedByMe()).isFalse();
    }

    @Test
    void likeMissingPostReturns404() {
        User liker = user("liker@x.com");

        ResponseEntity<Void> response = client(tokenFor(liker)).post()
                .uri("/api/posts/{postId}/like", MISSING_ID)
                .retrieve().toBodilessEntity();

        assertThat(response.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void unlikeMissingPostReturns404() {
        User liker = user("liker@x.com");

        ResponseEntity<Void> response = client(tokenFor(liker)).post()
                .uri("/api/posts/{postId}/unlike", MISSING_ID)
                .retrieve().toBodilessEntity();

        assertThat(response.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void anonymousLikeIsRejected() {
        User owner = user("owner@x.com");
        Post post = savePost(owner.getId());

        ResponseEntity<Void> response = client().post()
                .uri("/api/posts/{postId}/like", post.getId())
                .retrieve().toBodilessEntity();

        assertThat(response.getStatusCode().value()).isIn(401, 403);
    }
}
