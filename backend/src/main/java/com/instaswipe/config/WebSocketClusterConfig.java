package com.instaswipe.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.messaging.DefaultSimpUserRegistry;

@Configuration
public class WebSocketClusterConfig {

    @Bean
    public SimpUserRegistry simpUserRegistry() {
        return new DefaultSimpUserRegistry(); 
    }
}
