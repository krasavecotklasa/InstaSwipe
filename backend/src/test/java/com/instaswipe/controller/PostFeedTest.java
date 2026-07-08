package com.instaswipe.controller;

import com.instaswipe.dto.PageResponse;
import com.instaswipe.dto.PostResponse;
import com.instaswipe.model.Gender;
import com.instaswipe.model.Post;
import com.instaswipe.model.User;
import com.instaswipe.repository.PostRepository;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end HTTP coverage of {@code GET /api/posts/feed}: only posts from users the
 * caller has liked are returned, newest first; an empty liked set yields an empty page;
 * author/like fields are populated; and anonymous access is rejected.
 */
class PostFeedTest extends AbstractWebIntegrationTest {

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

    private void likes(User viewer, User... likedUsers) {
        Set<String> ids = new HashSet<>();
        for (User u : likedUsers) {
            ids.add(u.getId());
        }
        viewer.setLikedUserIds(ids);
        userRepository.save(viewer);
    }

    private Post savePost(String ownerId, String caption, Instant createdAt) {
        Post post = postRepository.save(Post.builder().userId(ownerId).caption(caption).build());
        // @CreatedDate stamps createdAt on save; override it so ordering is deterministic.
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("id").is(post.getId())),
                Update.update("createdAt", createdAt),
                Post.class);
        return post;
    }

    private ResponseEntity<PageResponse<PostResponse>> getFeed(User viewer) {
        return client(tokenFor(viewer)).get()
                .uri("/api/posts/feed")
                .retrieve().toEntity(new ParameterizedTypeReference<>() {});
    }

    @Test
    void feedReturnsOnlyLikedUsersPostsNewestFirst() {
        User viewer = user("viewer@x.com");
        User liked1 = user("liked1@x.com");
        User liked2 = user("liked2@x.com");
        User notLiked = user("stranger@x.com");
        likes(viewer, liked1, liked2);

        Instant now = Instant.now();
        savePost(liked1.getId(), "older", now.minusSeconds(120));
        savePost(liked2.getId(), "newer", now.minusSeconds(10));
        savePost(notLiked.getId(), "excluded", now);

        ResponseEntity<PageResponse<PostResponse>> response = getFeed(viewer);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().content())
                .extracting(PostResponse::caption)
                .containsExactly("newer", "older");
    }

    @Test
    void emptyLikedSetReturnsEmptyPage() {
        User viewer = user("viewer@x.com");
        User someone = user("someone@x.com");
        savePost(someone.getId(), "not in feed", Instant.now());

        ResponseEntity<PageResponse<PostResponse>> response = getFeed(viewer);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().content()).isEmpty();
        assertThat(response.getBody().totalElements()).isZero();
    }

    @Test
    void feedItemCarriesAuthorAndLikeFields() {
        User viewer = user("viewer@x.com");
        User author = user("author@x.com");
        likes(viewer, author);

        Post post = postRepository.save(Post.builder()
                .userId(author.getId())
                .caption("hi")
                .likedBy(new HashSet<>(Set.of(viewer.getId())))
                .build());

        ResponseEntity<PageResponse<PostResponse>> response = getFeed(viewer);

        assertThat(response.getBody().content()).singleElement().satisfies(item -> {
            assertThat(item.id()).isEqualTo(post.getId());
            assertThat(item.userId()).isEqualTo(author.getId());
            assertThat(item.displayName()).isEqualTo("author");
            assertThat(item.profilePictureUrl()).isEqualTo("https://example.com/pic.jpg");
            assertThat(item.likeCount()).isEqualTo(1);
            assertThat(item.likedByMe()).isTrue();
        });
    }

    @Test
    void anonymousFeedRequestIsRejected() {
        ResponseEntity<Void> response = client().get()
                .uri("/api/posts/feed")
                .retrieve().toBodilessEntity();

        assertThat(response.getStatusCode().value()).isIn(401, 403);
    }
}
