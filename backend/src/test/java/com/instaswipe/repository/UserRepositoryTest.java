package com.instaswipe.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.instaswipe.model.Gender;
import com.instaswipe.model.Role;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.support.AbstractMongoRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;

class UserRepositoryTest extends AbstractMongoRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void clean() {
        userRepository.deleteAll();
    }

    @Test
    void savesAndReadsUserWithEmbeddedProfile() {
        UserProfile profile = UserProfile.builder()
                .name("Ada")
                .bio("hello world")
                .gender(Gender.FEMALE)
                .profilePictureUrl("ada.jpg")
                .build();
        User saved = userRepository.save(User.builder()
                .email("ada@example.com")
                .passwordHash("hash")
                .profile(profile)
                .build());

        User found = userRepository.findById(saved.getId()).orElseThrow();

        assertThat(found.getEmail()).isEqualTo("ada@example.com");
        assertThat(found.getRoles()).containsExactly(Role.USER);
        assertThat(found.isEnabled()).isTrue();
        assertThat(found.isEmailVerified()).isTrue();
        assertThat(found.getProfile().getName()).isEqualTo("Ada");
        assertThat(found.getProfile().getGender()).isEqualTo(Gender.FEMALE);
        assertThat(found.getProfile().getProfilePictureUrl()).isEqualTo("ada.jpg");
    }

    @Test
    void populatesAuditingTimestampsOnSave() {
        User saved = userRepository.save(User.builder()
                .email("timestamps@example.com")
                .passwordHash("hash")
                .build());

        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void enforcesUniqueEmailIndex() {
        userRepository.save(User.builder().email("dupe@example.com").passwordHash("h1").build());

        assertThatThrownBy(() -> userRepository.save(
                User.builder().email("dupe@example.com").passwordHash("h2").build()))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void findsByEmail() {
        userRepository.save(User.builder().email("find@example.com").passwordHash("h").build());

        assertThat(userRepository.findByEmail("find@example.com")).isPresent();
        assertThat(userRepository.existsByEmail("find@example.com")).isTrue();
        assertThat(userRepository.existsByEmail("nobody@example.com")).isFalse();
    }
}
