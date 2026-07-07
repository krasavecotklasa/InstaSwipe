package com.instaswipe.repository;

import com.instaswipe.model.Post;
import com.instaswipe.support.AbstractMongoRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the custom {@link PostCustomRepository} fragment against a real
 * MongoDB, covering the atomic {@code $addToSet}/{@code $pull} semantics and the
 * {@code returnNew}/null contract the service relies on to produce 404s.
 */
class PostLikeRepositoryTest extends AbstractMongoRepositoryTest {

    private static final String MISSING_ID = "000000000000000000000000";

    @Autowired
    private PostRepository postRepository;

    @BeforeEach
    void clearPosts() {
        postRepository.deleteAll();
    }

    private Post savePost() {
        return postRepository.save(Post.builder().userId("owner").caption("hi").build());
    }

    @Test
    void likePostAddsUserAndReturnsUpdatedDocument() {
        Post post = savePost();

        Post updated = postRepository.likePost(post.getId(), "user-1");

        assertThat(updated).isNotNull();
        assertThat(updated.getLikedBy()).containsExactly("user-1");
    }

    @Test
    void likePostIsIdempotentForSameUser() {
        Post post = savePost();

        postRepository.likePost(post.getId(), "user-1");
        Post updated = postRepository.likePost(post.getId(), "user-1");

        assertThat(updated.getLikedBy()).containsExactly("user-1");
    }

    @Test
    void likePostAccumulatesDistinctUsers() {
        Post post = savePost();

        postRepository.likePost(post.getId(), "user-1");
        Post updated = postRepository.likePost(post.getId(), "user-2");

        assertThat(updated.getLikedBy()).containsExactlyInAnyOrder("user-1", "user-2");
    }

    @Test
    void unlikePostRemovesOnlyTheGivenUser() {
        Post post = savePost();
        postRepository.likePost(post.getId(), "user-1");
        postRepository.likePost(post.getId(), "user-2");

        Post updated = postRepository.unlikePost(post.getId(), "user-1");

        assertThat(updated.getLikedBy()).containsExactly("user-2");
    }

    @Test
    void unlikePostWithoutPriorLikeLeavesSetUnchanged() {
        Post post = savePost();
        postRepository.likePost(post.getId(), "user-1");

        Post updated = postRepository.unlikePost(post.getId(), "user-2");

        assertThat(updated.getLikedBy()).containsExactly("user-1");
    }

    @Test
    void likeMissingPostReturnsNull() {
        assertThat(postRepository.likePost(MISSING_ID, "user-1")).isNull();
    }

    @Test
    void unlikeMissingPostReturnsNull() {
        assertThat(postRepository.unlikePost(MISSING_ID, "user-1")).isNull();
    }
}
