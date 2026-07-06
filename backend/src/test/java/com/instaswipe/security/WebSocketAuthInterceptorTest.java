package com.instaswipe.security;

import com.instaswipe.model.Match;
import com.instaswipe.repository.MatchRepository;
import com.instaswipe.service.JwtService;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebSocketAuthInterceptorTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private MatchRepository matchRepository;

    @InjectMocks
    private WebSocketAuthInterceptor interceptor;

    private StompHeaderAccessor accessor;

    @BeforeEach
    void setUp() {
        accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
    }

    @Test
    void testPreSend_MissingAuthHeader_ThrowsException() {
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        AccessDeniedException exception = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(message, null));

        assertEquals("Missing or invalid Authorization header", exception.getMessage());
    }

    @Test
    void testPreSend_InvalidToken_ThrowsException() {
        accessor.setNativeHeader("Authorization", "Bearer invalid-token");
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        when(jwtService.extractUserId("invalid-token")).thenThrow(new JwtException("Invalid token"));

        AccessDeniedException exception = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(message, null));

        assertEquals("Invalid JWT Token", exception.getMessage());
    }

    @Test
    void testPreSend_Connect_Success() {
        accessor.setNativeHeader("Authorization", "Bearer valid-token");
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        when(jwtService.extractUserId("valid-token")).thenReturn("user123");

        Message<?> result = interceptor.preSend(message, null);

        assertNotNull(result);
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
        assertNotNull(resultAccessor.getUser());
        assertEquals("user123", resultAccessor.getUser().getName());
    }

    @Test
    void testPreSend_SubscribeToOwnMatch_Success() {
        accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setLeaveMutable(true);
        accessor.setNativeHeader("Authorization", "Bearer valid-token");
        accessor.setDestination("/user/queue/chat/user123_user456");
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        when(jwtService.extractUserId("valid-token")).thenReturn("user123");

        Match match = new Match();
        match.setId("user123_user456");
        match.setUserOneId("user123");
        match.setUserTwoId("user456");

        when(matchRepository.findById("user123_user456")).thenReturn(Optional.of(match));

        Message<?> result = interceptor.preSend(message, null);
        assertNotNull(result);
    }

    @Test
    void testPreSend_SubscribeToOthersMatch_ThrowsException() {
        accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setLeaveMutable(true);
        accessor.setNativeHeader("Authorization", "Bearer valid-token");
        accessor.setDestination("/user/queue/chat/user789_user999");
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        when(jwtService.extractUserId("valid-token")).thenReturn("user123");

        Match match = new Match();
        match.setId("user789_user999");
        match.setUserOneId("user789");
        match.setUserTwoId("user999");

        when(matchRepository.findById("user789_user999")).thenReturn(Optional.of(match));

        AccessDeniedException exception = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(message, null));

        assertEquals("User is not a participant of this match", exception.getMessage());
    }
}
