package com.instaswipe.security;

import com.instaswipe.model.Match;
import com.instaswipe.repository.MatchRepository;
import com.instaswipe.repository.UserRepository;
import com.instaswipe.service.JwtService;
import io.jsonwebtoken.Claims;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebSocketAuthInterceptorTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private WebSocketAuthInterceptor interceptor;

    private StompHeaderAccessor accessor;

    @BeforeEach
    void setUp() {
        accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
    }

    private static Claims claimsWith(String subject, Instant expiration) {
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn(subject);
        when(claims.getExpiration()).thenReturn(Date.from(expiration));
        return claims;
    }

    private Message<byte[]> toMessage(StompHeaderAccessor headerAccessor) {
        return MessageBuilder.createMessage(new byte[0], headerAccessor.getMessageHeaders());
    }

    /** A frame that arrives after a successful CONNECT: principal bound, token expiry recorded. */
    private StompHeaderAccessor authenticatedFrame(StompCommand command, String userId, Instant expiry) {
        StompHeaderAccessor frame = StompHeaderAccessor.create(command);
        frame.setLeaveMutable(true);
        frame.setUser(new UsernamePasswordAuthenticationToken(userId, null, List.of()));
        Map<String, Object> attrs = new HashMap<>();
        attrs.put(WebSocketAuthInterceptor.SESSION_TOKEN_EXPIRY, expiry);
        frame.setSessionAttributes(attrs);
        return frame;
    }

    // --- CONNECT ---

    @Test
    void testPreSend_MissingAuthHeader_ThrowsException() {
        Message<byte[]> message = toMessage(accessor);

        AccessDeniedException exception = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(message, null));

        assertEquals("Missing or invalid Authorization header", exception.getMessage());
    }

    @Test
    void testPreSend_InvalidToken_ThrowsException() {
        accessor.setNativeHeader("Authorization", "Bearer invalid-token");
        Message<byte[]> message = toMessage(accessor);

        when(jwtService.parseClaims("invalid-token")).thenThrow(new JwtException("Invalid token"));

        AccessDeniedException exception = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(message, null));

        assertEquals("Invalid JWT Token", exception.getMessage());
    }

    @Test
    void testPreSend_Connect_BindsUserAndRecordsExpiry() {
        accessor.setNativeHeader("Authorization", "Bearer valid-token");
        Map<String, Object> sessionAttrs = new HashMap<>();
        accessor.setSessionAttributes(sessionAttrs);
        Message<byte[]> message = toMessage(accessor);

        Instant expiry = Instant.now().plusSeconds(300);
        Claims claims = claimsWith("user123", expiry);
        when(jwtService.parseClaims("valid-token")).thenReturn(claims);
        when(userRepository.existsByIdAndEmailVerifiedTrue("user123")).thenReturn(true);

        Message<?> result = interceptor.preSend(message, null);

        assertNotNull(result);
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
        assertNotNull(resultAccessor.getUser());
        assertEquals("user123", resultAccessor.getUser().getName());
        assertEquals(Date.from(expiry).toInstant(), sessionAttrs.get(WebSocketAuthInterceptor.SESSION_TOKEN_EXPIRY));
    }

    @Test
    void testPreSend_ConnectWithUnverifiedUser_ThrowsException() {
        accessor.setNativeHeader("Authorization", "Bearer valid-token");
        Message<byte[]> message = toMessage(accessor);

        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn("user123");
        when(jwtService.parseClaims("valid-token")).thenReturn(claims);
        when(userRepository.existsByIdAndEmailVerifiedTrue("user123")).thenReturn(false);

        AccessDeniedException exception = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(message, null));

        assertEquals("Please verify your email before using the app", exception.getMessage());
    }

    // --- SUBSCRIBE authorization (principal bound at CONNECT) ---

    @Test
    void testPreSend_SubscribeToOwnMatch_Success() {
        StompHeaderAccessor sub = authenticatedFrame(StompCommand.SUBSCRIBE, "user123", Instant.now().plusSeconds(300));
        sub.setDestination("/user/queue/user123_user456");
        Message<byte[]> message = toMessage(sub);

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
        StompHeaderAccessor sub = authenticatedFrame(StompCommand.SUBSCRIBE, "user123", Instant.now().plusSeconds(300));
        sub.setDestination("/user/queue/user789_user999");
        Message<byte[]> message = toMessage(sub);

        Match match = new Match();
        match.setId("user789_user999");
        match.setUserOneId("user789");
        match.setUserTwoId("user999");
        when(matchRepository.findById("user789_user999")).thenReturn(Optional.of(match));

        AccessDeniedException exception = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(message, null));

        assertEquals("User is not a participant of this match", exception.getMessage());
    }

    // --- Per-frame access-token expiry enforcement ---

    @Test
    void testPreSend_SendWithExpiredToken_ThrowsException() {
        StompHeaderAccessor send = authenticatedFrame(StompCommand.SEND, "user123", Instant.now().minusSeconds(1));
        send.setDestination("/app/chat");
        Message<byte[]> message = toMessage(send);

        AccessDeniedException exception = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(message, null));

        assertEquals("Access token expired", exception.getMessage());
    }

    @Test
    void testPreSend_SendWithValidToken_Passes() {
        StompHeaderAccessor send = authenticatedFrame(StompCommand.SEND, "user123", Instant.now().plusSeconds(300));
        send.setDestination("/app/chat");
        Message<byte[]> message = toMessage(send);

        Message<?> result = interceptor.preSend(message, null);
        assertNotNull(result);
    }

    @Test
    void testPreSend_SubscribeWithExpiredToken_ThrowsBeforeMatchLookup() {
        StompHeaderAccessor sub = authenticatedFrame(StompCommand.SUBSCRIBE, "user123", Instant.now().minusSeconds(1));
        sub.setDestination("/user/queue/user123_user456");
        Message<byte[]> message = toMessage(sub);

        AccessDeniedException exception = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(message, null));

        assertEquals("Access token expired", exception.getMessage());
        verifyNoInteractions(matchRepository);
    }

    @Test
    void testPreSend_DisconnectWithExpiredToken_IsAllowed() {
        StompHeaderAccessor disconnect = authenticatedFrame(StompCommand.DISCONNECT, "user123", Instant.now().minusSeconds(1));
        Message<byte[]> message = toMessage(disconnect);

        Message<?> result = interceptor.preSend(message, null);
        assertNotNull(result);
    }
}
