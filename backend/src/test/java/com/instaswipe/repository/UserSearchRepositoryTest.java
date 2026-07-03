package com.instaswipe.repository;

import com.instaswipe.dto.UserSearchCriteria;
import com.instaswipe.model.Gender;
import com.instaswipe.model.Role;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.support.AbstractMongoRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class UserSearchRepositoryTest extends AbstractMongoRepositoryTest {

    @Autowired
    UserRepository userRepository;

    @BeforeEach
    void clean() {
        userRepository.deleteAll();
    }

    private User discoverable(String email, Gender gender, String country, int age, List<String> interests) {
        UserProfile profile = UserProfile.builder()
                .name(email.split("@")[0]).bio("bio").gender(gender).country(country)
                .birthDate(LocalDate.now().minusYears(age))
                .interests(interests).profilePictureUrl("https://x/y.jpg").build();
        return userRepository.save(User.builder()
                .email(email).passwordHash("x")
                .roles(new HashSet<>(Set.of(Role.USER))).enabled(true).emailVerified(true)
                .profile(profile).build());
    }

    @Test
    void filtersByGender() {
        discoverable("m@x.com", Gender.MALE, "US", 25, List.of("a"));
        discoverable("f@x.com", Gender.FEMALE, "US", 25, List.of("a"));

        var criteria = new UserSearchCriteria(null, null, Gender.FEMALE, null, null, null);
        Page<User> page = userRepository.searchDiscoverable(criteria, PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(User::getEmail).containsExactly("f@x.com");
    }

    @Test
    void filtersByCountryAndInterestsAnyMatch() {
        discoverable("a@x.com", Gender.MALE, "US", 25, List.of("music", "art"));
        discoverable("b@x.com", Gender.MALE, "BG", 25, List.of("music"));
        discoverable("c@x.com", Gender.MALE, "US", 25, List.of("sport"));

        var criteria = new UserSearchCriteria(null, null, null, "US", List.of("music"), null);
        Page<User> page = userRepository.searchDiscoverable(criteria, PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(User::getEmail).containsExactly("a@x.com");
    }

    @Test
    void filtersByAgeRange() {
        discoverable("young@x.com", Gender.MALE, "US", 20, List.of("a"));
        discoverable("mid@x.com", Gender.MALE, "US", 30, List.of("a"));
        discoverable("old@x.com", Gender.MALE, "US", 40, List.of("a"));

        LocalDate today = LocalDate.now();
        // age in [25, 35] => birthDate in [today-36y+1d, today-25y]
        var criteria = new UserSearchCriteria(
                today.minusYears(36).plusDays(1), today.minusYears(25), null, null, null, null);
        Page<User> page = userRepository.searchDiscoverable(criteria, PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(User::getEmail).containsExactly("mid@x.com");
    }

    @Test
    void excludesSelfDisabledAndIncompleteProfiles() {
        User self = discoverable("self@x.com", Gender.MALE, "US", 25, List.of("a"));
        User disabled = discoverable("disabled@x.com", Gender.MALE, "US", 25, List.of("a"));
        disabled.setEnabled(false);
        userRepository.save(disabled);
        // incomplete: missing profile picture => not discoverable
        UserProfile incomplete = UserProfile.builder()
                .name("inc").bio("b").gender(Gender.MALE).country("US")
                .birthDate(LocalDate.now().minusYears(25)).interests(List.of("a"))
                .profilePictureUrl(null).build();
        userRepository.save(User.builder().email("incomplete@x.com").passwordHash("x")
                .roles(new HashSet<>(Set.of(Role.USER))).enabled(true).emailVerified(true)
                .profile(incomplete).build());
        discoverable("visible@x.com", Gender.MALE, "US", 25, List.of("a"));

        var criteria = new UserSearchCriteria(null, null, null, null, null, List.of(self.getId()));
        Page<User> page = userRepository.searchDiscoverable(criteria, PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(User::getEmail).containsExactly("visible@x.com");
    }

    @Test
    void paginates() {
        for (int i = 0; i < 5; i++) {
            discoverable("u" + i + "@x.com", Gender.MALE, "US", 25, List.of("a"));
        }

        var criteria = new UserSearchCriteria(null, null, null, null, null, null);
        Page<User> page = userRepository.searchDiscoverable(criteria, PageRequest.of(0, 2));

        assertThat(page.getContent()).hasSize(2);
        assertThat(page.getTotalElements()).isEqualTo(5);
        assertThat(page.getTotalPages()).isEqualTo(3);
    }
}
