package com.instaswipe.repository;

import com.instaswipe.model.Match;
import com.instaswipe.support.AbstractMongoRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the {@link MatchRepository} against a real MongoDB: the deterministic
 * id, the race-safe {@code createIfAbsent} upsert, and the participant lookup.
 */
class MatchRepositoryTest extends AbstractMongoRepositoryTest {

    @Autowired
    private MatchRepository matchRepository;

    @BeforeEach
    void clearMatches() {
        matchRepository.deleteAll();
    }

    @Test
    void createIfAbsentInsertsAndReturnsTrue() {
        boolean created = matchRepository.createIfAbsent("alice_bob", "alice", "bob");

        assertThat(created).isTrue();
        assertThat(matchRepository.findById("alice_bob")).isPresent();
        Match match = matchRepository.findById("alice_bob").orElseThrow();
        assertThat(match.getUserOneId()).isEqualTo("alice");
        assertThat(match.getUserTwoId()).isEqualTo("bob");
        assertThat(match.getCreatedAt()).isNotNull();
    }

    @Test
    void createIfAbsentIsIdempotentForSamePair() {
        matchRepository.createIfAbsent("alice_bob", "alice", "bob");
        boolean createdAgain = matchRepository.createIfAbsent("alice_bob", "alice", "bob");

        assertThat(createdAgain).isFalse();
        assertThat(matchRepository.count()).isEqualTo(1);
    }

    @Test
    void findByParticipantReturnsMatchesForEitherSide() {
        matchRepository.createIfAbsent("alice_bob", "alice", "bob");
        matchRepository.createIfAbsent("bob_carol", "bob", "carol");
        matchRepository.createIfAbsent("dave_erin", "dave", "erin");

        Page<Match> page = matchRepository.findByUserOneIdOrUserTwoId(
                "bob", "bob", PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt")));

        assertThat(page.getContent()).extracting(Match::getId)
                .containsExactlyInAnyOrder("alice_bob", "bob_carol");
    }
}
