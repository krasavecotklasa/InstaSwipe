package com.instaswipe.repository;

import com.instaswipe.model.User;
import com.instaswipe.support.AbstractMongoRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the custom {@link UserMatchRepository} fragment against a real
 * MongoDB, covering the atomic {@code $addToSet} semantics and the
 * {@code returnNew}/null contract MatchService relies on to produce 404s.
 */
class UserMatchRepositoryTest extends AbstractMongoRepositoryTest {

    private static final String MISSING_ID = "000000000000000000000000";

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void clearUsers() {
        userRepository.deleteAll();
    }

    private User saveUser() {
        return userRepository.save(User.builder().email("me@x.com").passwordHash("x").build());
    }

    @Test
    void recordLikeAddsTargetAndReturnsUpdatedDocument() {
        User user = saveUser();

        User updated = userRepository.recordLike(user.getId(), "target-1");

        assertThat(updated).isNotNull();
        assertThat(updated.getLikedUserIds()).containsExactly("target-1");
    }

    @Test
    void recordPassAddsTargetAndReturnsUpdatedDocument() {
        User user = saveUser();

        User updated = userRepository.recordPass(user.getId(), "target-1");

        assertThat(updated.getPassedUserIds()).containsExactly("target-1");
    }

    @Test
    void recordLikeIsIdempotentForSameTarget() {
        User user = saveUser();

        userRepository.recordLike(user.getId(), "target-1");
        User updated = userRepository.recordLike(user.getId(), "target-1");

        assertThat(updated.getLikedUserIds()).containsExactly("target-1");
    }

    @Test
    void recordLikeAccumulatesDistinctTargets() {
        User user = saveUser();

        userRepository.recordLike(user.getId(), "target-1");
        User updated = userRepository.recordLike(user.getId(), "target-2");

        assertThat(updated.getLikedUserIds()).containsExactlyInAnyOrder("target-1", "target-2");
    }

    @Test
    void likeAndPassAreTrackedIndependently() {
        User user = saveUser();

        userRepository.recordLike(user.getId(), "liked-1");
        User updated = userRepository.recordPass(user.getId(), "passed-1");

        assertThat(updated.getLikedUserIds()).containsExactly("liked-1");
        assertThat(updated.getPassedUserIds()).containsExactly("passed-1");
    }

    @Test
    void recordLikeForMissingUserReturnsNull() {
        assertThat(userRepository.recordLike(MISSING_ID, "target-1")).isNull();
    }

    @Test
    void recordPassForMissingUserReturnsNull() {
        assertThat(userRepository.recordPass(MISSING_ID, "target-1")).isNull();
    }
}
