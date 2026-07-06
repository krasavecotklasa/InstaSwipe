package com.instaswipe.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;
import java.io.FileInputStream;
import java.io.IOException;

@Slf4j
@Configuration
public class FirebaseConfig {

    @Value("${FIREBASE_CREDENTIALS:}")
    private String serviceAccountPath;

    @PostConstruct
    public void initialize() {
        try {
            if (serviceAccountPath != null && !serviceAccountPath.isBlank()) {
                try (FileInputStream serviceAccount = new FileInputStream(serviceAccountPath)) {
                    FirebaseOptions options = FirebaseOptions.builder()
                            .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                            .build();

                    if (FirebaseApp.getApps().isEmpty()) {
                        FirebaseApp.initializeApp(options);
                        log.info("Firebase application has been initialized");
                    }
                }
            } else {
                log.warn("FIREBASE_CREDENTIALS environment variable not set. FCM Push Notifications will be disabled.");
            }
        } catch (IOException e) {
            log.error("Failed to initialize Firebase", e);
        }
    }
}
