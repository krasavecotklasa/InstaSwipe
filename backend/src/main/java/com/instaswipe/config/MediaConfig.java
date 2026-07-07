package com.instaswipe.config;

import jakarta.servlet.MultipartConfigElement;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.servlet.MultipartConfigFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.unit.DataSize;

/**
 * Enforces the upload size limit at the multipart layer so oversized requests are
 * rejected before they are buffered. Configured in code (not just the gitignored
 * application.yaml) so the cap holds regardless of a developer's local config.
 */
@Configuration
public class MediaConfig {

    @Bean
    public MultipartConfigElement multipartConfigElement(
            @Value("${media.max-image-size:10MB}") String maxImageSize) {
        DataSize maxFileSize = DataSize.parse(maxImageSize);
        // Allow headroom over the file cap for multipart boundaries and other form fields.
        DataSize maxRequestSize = DataSize.ofBytes(maxFileSize.toBytes() + DataSize.ofMegabytes(1).toBytes());

        MultipartConfigFactory factory = new MultipartConfigFactory();
        factory.setMaxFileSize(maxFileSize);
        factory.setMaxRequestSize(maxRequestSize);
        return factory.createMultipartConfig();
    }
}
