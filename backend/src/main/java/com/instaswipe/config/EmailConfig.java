package com.instaswipe.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "app.email")
public class EmailConfig {
    
    private String apiKey;
    private String fromEmail;
    private String fromName;
    private boolean enabled;
}
