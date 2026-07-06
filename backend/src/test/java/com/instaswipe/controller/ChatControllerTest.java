package com.instaswipe.controller;

import com.instaswipe.config.RabbitMQConfig;
import com.instaswipe.dto.ChatMessageRequest;
import com.instaswipe.event.OfflineMessageEvent;
import com.instaswipe.model.Message;
import com.instaswipe.repository.MessageRepository;
import com.instaswipe.service.MatchService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
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

    @Mock
    private RabbitTemplate rabbitTemplate;

    @Mock
    private MatchService matchService;

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
    void testProcessMessage_NotAParticipant_DropsMessage() {
        when(headerAccessor.getUser()).thenReturn(principal);
        when(principal.getName()).thenReturn("user123");
        when(matchService.isConversationBetween("user123_user456", "user123", "user456")).thenReturn(false);

        chatController.processMessage(request, headerAccessor);

        verifyNoInteractions(messageRepository, messagingTemplate, simpUserRegistry, rabbitTemplate);
    }

    @Test
    void testProcessMessage_RecipientOnline_Success() {
        when(headerAccessor.getUser()).thenReturn(principal);
        when(principal.getName()).thenReturn("user123");
        when(matchService.isConversationBetween("user123_user456", "user123", "user456")).thenReturn(true);

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
        when(matchService.isConversationBetween("user123_user456", "user123", "user456")).thenReturn(true);

        Message savedMessage = Message.builder()
                .id("msg1")
                .chatRoomId("user123_user456")
                .senderId("user123")
                .recipientId("user456")
                .content("Hello there!")
                .build();
        when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);

        when(simpUserRegistry.getUser("user456")).thenReturn(null); // Recipient offline

        chatController.processMessage(request, headerAccessor);

        verify(simpUserRegistry).getUser("user456");

        // Still sends the web socket message in case there's a race condition with sessions
        verify(messagingTemplate, times(2)).convertAndSendToUser(anyString(), anyString(), any(Message.class));

        // Publishes an offline push event carrying the persisted message details
        ArgumentCaptor<OfflineMessageEvent> eventCaptor = ArgumentCaptor.forClass(OfflineMessageEvent.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.PUSH_EXCHANGE),
                eq(RabbitMQConfig.PUSH_ROUTING),
                eventCaptor.capture());

        OfflineMessageEvent event = eventCaptor.getValue();
        assertEquals("msg1", event.messageId());
        assertEquals("user123_user456", event.chatRoomId());
        assertEquals("user123", event.senderId());
        assertEquals("user456", event.recipientId());
        assertEquals("Hello there!", event.content());
    }
}
