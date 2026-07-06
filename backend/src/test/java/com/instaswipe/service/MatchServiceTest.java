package com.instaswipe.service;

import com.instaswipe.model.User;
import com.instaswipe.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashSet;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
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
    void passPersonAddsTargetToPassedUserIds() {
        User currentUser = User.builder()
                .id("current-user")
                .passedUserIds(new HashSet<>())
                .build();

        when(userRepository.findById("current-user")).thenReturn(Optional.of(currentUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String result = matchService.passPerson("current-user", "target-user");

        assertEquals("passed", result);
        assertTrue(currentUser.getPassedUserIds().contains("target-user"));
        verify(userRepository).save(currentUser);
    }

    @Test
    void lovePersonAddsTargetToLikedUserIds() {
        User currentUser = User.builder()
                .id("current-user")
                .likedUserIds(new HashSet<>())
                .build();

        when(userRepository.findById("current-user")).thenReturn(Optional.of(currentUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String result = matchService.lovePerson("current-user", "target-user");

        assertEquals("liked", result);
        assertTrue(currentUser.getLikedUserIds().contains("target-user"));
        verify(userRepository).save(currentUser);
    }

    @Test
    void passPersonRejectsSelfInteraction() {
        assertThrows(IllegalArgumentException.class, () -> matchService.passPerson("same-user", "same-user"));
        verifyNoInteractions(userRepository);
    }
}
