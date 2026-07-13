package com.instaswipe.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.gifs")
public class GifProperties {

    private Provider giphy = new Provider();
    private Provider klipy = new Provider();
    private String rating = "pg-13";
    private String lang = "en";
    private int defaultLimit = 24;
    private int maxLimit = 50;

    @Getter
    @Setter
    public static class Provider {
        private boolean enabled = true;
        private String apiKey = "";
        private String searchUrl = "";
    }
}
