package com.instaswipe.service;

import com.instaswipe.dto.SwipeResult;
import com.instaswipe.dto.SwipeStatus;
import com.instaswipe.event.MatchCreatedEvent;
import com.instaswipe.exception.InvalidRequestException;
import com.instaswipe.model.Match;
import com.instaswipe.model.User;
import com.instaswipe.repository.MatchRepository;
import com.instaswipe.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MatchServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private MatchRepository matchRepository;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks private MatchService matchService;

    private User existing(String id) {
        return User.builder().id(id).build();
    }

    @Test
    void passPersonReturnsPassed() {
        when(userRepository.recordPass("me", "target")).thenReturn(existing("me"));

        SwipeResult result = matchService.passPerson("me", "target");

        assertEquals(SwipeStatus.PASSED, result.status());
        assertNull(result.matchId());
        verifyNoInteractions(matchRepository, eventPublisher);
    }

    @Test
    void lovePersonWithoutReciprocityReturnsLiked() {
        when(userRepository.recordLike("me", "target")).thenReturn(existing("me"));
        when(userRepository.existsByIdAndLikedUserIdsContains("target", "me")).thenReturn(false);

        SwipeResult result = matchService.lovePerson("me", "target");

        assertEquals(SwipeStatus.LIKED, result.status());
        assertNull(result.matchId());
        verifyNoInteractions(matchRepository, eventPublisher);
    }

    @Test
    void lovePersonWithReciprocityCreatesMatchAndPublishesEvent() {
        when(userRepository.recordLike("bob", "alice")).thenReturn(existing("bob"));
        when(userRepository.existsByIdAndLikedUserIdsContains("alice", "bob")).thenReturn(true);
        when(matchRepository.createIfAbsent("alice_bob", "alice", "bob")).thenReturn(true);

        SwipeResult result = matchService.lovePerson("bob", "alice");

        assertEquals(SwipeStatus.MATCHED, result.status());
        assertEquals("alice_bob", result.matchId());

        ArgumentCaptor<MatchCreatedEvent> captor = ArgumentCaptor.forClass(MatchCreatedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertEquals("alice_bob", captor.getValue().matchId());
        assertEquals("alice", captor.getValue().userOneId());
        assertEquals("bob", captor.getValue().userTwoId());
    }

    @Test
    void lovePersonWhenMatchAlreadyExistsDoesNotPublishEvent() {
        when(userRepository.recordLike("alice", "bob")).thenReturn(existing("alice"));
        when(userRepository.existsByIdAndLikedUserIdsContains("bob", "alice")).thenReturn(true);
        when(matchRepository.createIfAbsent("alice_bob", "alice", "bob")).thenReturn(false);

        SwipeResult result = matchService.lovePerson("alice", "bob");

        assertEquals(SwipeStatus.MATCHED, result.status());
        assertEquals("alice_bob", result.matchId());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void matchIdIsDeterministicRegardlessOfSwipeOrder() {
        when(userRepository.recordLike("bob", "alice")).thenReturn(existing("bob"));
        when(userRepository.existsByIdAndLikedUserIdsContains("alice", "bob")).thenReturn(true);
        when(matchRepository.createIfAbsent("alice_bob", "alice", "bob")).thenReturn(true);

        SwipeResult result = matchService.lovePerson("bob", "alice");

        assertEquals("alice_bob", result.matchId());
    }

    @Test
    void passPersonRejectsSelfInteraction() {
        assertThrows(InvalidRequestException.class,
                () -> matchService.passPerson("same", "same"));
        verifyNoInteractions(userRepository, matchRepository, eventPublisher);
    }

    @Test
    void lovePersonRejectsSelfInteraction() {
        assertThrows(InvalidRequestException.class,
                () -> matchService.lovePerson("same", "same"));
        verifyNoInteractions(userRepository, matchRepository, eventPublisher);
    }

    @Test
    void passPersonRejectsNullCurrentUser() {
        assertThrows(InvalidRequestException.class,
                () -> matchService.passPerson(null, "target"));
        verifyNoInteractions(userRepository, matchRepository, eventPublisher);
    }

    @Test
    void lovePersonRejectsNullCurrentUser() {
        assertThrows(InvalidRequestException.class,
                () -> matchService.lovePerson(null, "target"));
        verifyNoInteractions(userRepository, matchRepository, eventPublisher);
    }

    @Test
    void passPersonThrowsWhenCurrentUserMissing() {
        when(userRepository.recordPass("ghost", "target")).thenReturn(null);

        assertThrows(IllegalArgumentException.class,
                () -> matchService.passPerson("ghost", "target"));
    }

    @Test
    void lovePersonThrowsWhenCurrentUserMissing() {
        when(userRepository.recordLike("ghost", "target")).thenReturn(null);

        assertThrows(IllegalArgumentException.class,
                () -> matchService.lovePerson("ghost", "target"));
    }

    private Match match(String id, String userOneId, String userTwoId) {
        return Match.builder().id(id).userOneId(userOneId).userTwoId(userTwoId).build();
    }

    @Test
    void isParticipantTrueForEitherMember() {
        when(matchRepository.findById("alice_bob")).thenReturn(Optional.of(match("alice_bob", "alice", "bob")));

        assertTrue(matchService.isParticipant("alice", "alice_bob"));
        assertTrue(matchService.isParticipant("bob", "alice_bob"));
    }

    @Test
    void isParticipantFalseForOutsiderOrMissingMatch() {
        when(matchRepository.findById("alice_bob")).thenReturn(Optional.of(match("alice_bob", "alice", "bob")));
        assertFalse(matchService.isParticipant("carol", "alice_bob"));

        when(matchRepository.findById("nope")).thenReturn(Optional.empty());
        assertFalse(matchService.isParticipant("alice", "nope"));
    }

    @Test
    void isConversationBetweenTrueOnlyForTheTwoDistinctMembers() {
        when(matchRepository.findById("alice_bob")).thenReturn(Optional.of(match("alice_bob", "alice", "bob")));

        assertTrue(matchService.isConversationBetween("alice_bob", "alice", "bob"));
        assertTrue(matchService.isConversationBetween("alice_bob", "bob", "alice"));
        assertFalse(matchService.isConversationBetween("alice_bob", "alice", "carol"));
    }

    @Test
    void isConversationBetweenFalseForSameSenderAndRecipient() {
        // Short-circuits before hitting the repository.
        assertFalse(matchService.isConversationBetween("alice_bob", "alice", "alice"));
        verifyNoInteractions(matchRepository);
    }
}
