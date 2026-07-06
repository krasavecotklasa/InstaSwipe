package com.instaswipe.controller;

import com.instaswipe.dto.ChatMessageRequest;
import com.instaswipe.model.Message;
import com.instaswipe.repository.MessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;

import java.security.Principal;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatControllerTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private SimpUserRegistry simpUserRegistry;

    @InjectMocks
    private ChatController chatController;

    @Mock
    private SimpMessageHeaderAccessor headerAccessor;

    @Mock
    private Principal principal;

    private ChatMessageRequest request;

    @BeforeEach
    void setUp() {
        request = new ChatMessageRequest();
        request.setChatRoomId("user123_user456");
        request.setSenderId("user123");
        request.setRecipientId("user456");
        request.setContent("Hello there!");
    }

    @Test
    void testProcessMessage_Unauthenticated_DropsMessage() {
        when(headerAccessor.getUser()).thenReturn(null);

        chatController.processMessage(request, headerAccessor);

        verifyNoInteractions(messageRepository, messagingTemplate, simpUserRegistry);
    }

    @Test
    void testProcessMessage_SenderIdMismatch_DropsMessage() {
        when(headerAccessor.getUser()).thenReturn(principal);
        when(principal.getName()).thenReturn("some_other_user");

        chatController.processMessage(request, headerAccessor);

        verifyNoInteractions(messageRepository, messagingTemplate, simpUserRegistry);
    }

    @Test
    void testProcessMessage_RecipientOnline_Success() {
        when(headerAccessor.getUser()).thenReturn(principal);
        when(principal.getName()).thenReturn("user123");

        Message savedMessage = Message.builder()
                .chatRoomId("user123_user456")
                .senderId("user123")
                .recipientId("user456")
                .content("Hello there!")
                .build();
        when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);

        SimpUser mockSimpUser = mock(SimpUser.class);
        when(mockSimpUser.getSessions()).thenReturn(Set.of(mock(org.springframework.messaging.simp.user.SimpSession.class)));
        when(simpUserRegistry.getUser("user456")).thenReturn(mockSimpUser);

        chatController.processMessage(request, headerAccessor);

        ArgumentCaptor<Message> messageCaptor = ArgumentCaptor.forClass(Message.class);
        verify(messageRepository).save(messageCaptor.capture());
        assertEquals("Hello there!", messageCaptor.getValue().getContent());

        verify(messagingTemplate).convertAndSendToUser(
                eq("user456"),
                eq("/queue/chat/user123_user456"),
                any(Message.class)
        );

        verify(messagingTemplate).convertAndSendToUser(
                eq("user123"),
                eq("/queue/chat/user123_user456"),
                any(Message.class)
        );
    }

    @Test
    void testProcessMessage_RecipientOffline_QueuesPush() {
        when(headerAccessor.getUser()).thenReturn(principal);
        when(principal.getName()).thenReturn("user123");

        when(messageRepository.save(any(Message.class))).thenReturn(new Message());

        when(simpUserRegistry.getUser("user456")).thenReturn(null); // Recipient offline

        chatController.processMessage(request, headerAccessor);

        // Verification for push notification queue logic will go here
        verify(simpUserRegistry).getUser("user456");
        
        // Still sends the web socket message in case there's a race condition with sessions
        verify(messagingTemplate, times(2)).convertAndSendToUser(anyString(), anyString(), any(Message.class));
    }
}
