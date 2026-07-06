package com.instaswipe.service;

import com.instaswipe.exception.InvalidRequestException;
import com.instaswipe.model.User;
import com.instaswipe.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MatchServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private MatchService matchService;

    @Test
    void passPersonRecordsPassAndReturnsPassed() {
        when(userRepository.recordPass("current-user", "target-user"))
                .thenReturn(User.builder().id("current-user").build());

        String result = matchService.passPerson("current-user", "target-user");

        assertEquals("passed", result);
        verify(userRepository).recordPass("current-user", "target-user");
    }

    @Test
    void lovePersonRecordsLikeAndReturnsLiked() {
        when(userRepository.recordLike("current-user", "target-user"))
                .thenReturn(User.builder().id("current-user").build());

        String result = matchService.lovePerson("current-user", "target-user");

        assertEquals("liked", result);
        verify(userRepository).recordLike("current-user", "target-user");
    }

    @Test
    void passPersonRejectsSelfInteraction() {
        assertThrows(InvalidRequestException.class,
                () -> matchService.passPerson("same-user", "same-user"));
        verifyNoInteractions(userRepository);
    }

    @Test
    void lovePersonRejectsSelfInteraction() {
        assertThrows(InvalidRequestException.class,
                () -> matchService.lovePerson("same-user", "same-user"));
        verifyNoInteractions(userRepository);
    }

    @Test
    void passPersonRejectsNullCurrentUser() {
        assertThrows(InvalidRequestException.class,
                () -> matchService.passPerson(null, "target-user"));
        verifyNoInteractions(userRepository);
    }

    @Test
    void lovePersonRejectsNullCurrentUser() {
        assertThrows(InvalidRequestException.class,
                () -> matchService.lovePerson(null, "target-user"));
        verifyNoInteractions(userRepository);
    }

    @Test
    void passPersonThrowsWhenCurrentUserMissing() {
        when(userRepository.recordPass("ghost", "target-user")).thenReturn(null);

        assertThrows(IllegalArgumentException.class,
                () -> matchService.passPerson("ghost", "target-user"));
    }

    @Test
    void lovePersonThrowsWhenCurrentUserMissing() {
        when(userRepository.recordLike("ghost", "target-user")).thenReturn(null);

        assertThrows(IllegalArgumentException.class,
                () -> matchService.lovePerson("ghost", "target-user"));
    }
}
