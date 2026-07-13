package com.instaswipe.service;

import com.instaswipe.config.GifProperties;
import com.instaswipe.dto.GifResponse;
import com.instaswipe.dto.GifSearchResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class GifService {

    private static final String GIPHY = "giphy";
    private static final String KLIPY = "klipy";
    private static final String ALL = "all";

    private final GifProperties properties;
    private final RestClient restClient = RestClient.builder().build();

    public GifSearchResponse search(String query, String provider, int requestedLimit, String offset) {
        String normalizedProvider = normalizeProvider(provider);
        int limit = normalizeLimit(requestedLimit);
        String safeQuery = query == null ? "" : query.trim();
        if (safeQuery.isBlank()) {
            return new GifSearchResponse(List.of(), normalizedProvider, limit, offset);
        }

        List<GifResponse> results = new ArrayList<>();
        if (ALL.equals(normalizedProvider) || GIPHY.equals(normalizedProvider)) {
            results.addAll(searchGiphy(safeQuery, limit, offset));
        }
        if (ALL.equals(normalizedProvider) || KLIPY.equals(normalizedProvider)) {
            results.addAll(searchKlipy(safeQuery, limit, offset));
        }

        if (results.size() > limit) {
            results = results.subList(0, limit);
        }

        String nextOffset = String.valueOf(parseOffset(offset) + limit);
        return new GifSearchResponse(results, normalizedProvider, limit, nextOffset);
    }

    private List<GifResponse> searchGiphy(String query, int limit, String offset) {
        GifProperties.Provider giphy = properties.getGiphy();
        if (!giphy.isEnabled() || !StringUtils.hasText(giphy.getApiKey())) {
            return List.of();
        }

        String url = UriComponentsBuilder.fromUriString(searchUrl(giphy, "https://api.giphy.com/v1/gifs/search"))
                .queryParam("api_key", giphy.getApiKey())
                .queryParam("q", query)
                .queryParam("limit", limit)
                .queryParam("offset", parseOffset(offset))
                .queryParam("rating", properties.getRating())
                .queryParam("lang", properties.getLang())
                .queryParam("bundle", "messaging_non_clips")
                .build()
                .encode()
                .toUriString();

        try {
            Map<String, Object> body = getJson(url);
            return asList(body.get("data")).stream()
                    .map(this::mapGiphyItem)
                    .filter(Objects::nonNull)
                    .toList();
        } catch (RuntimeException ex) {
            log.warn("GIPHY search failed", ex);
            return List.of();
        }
    }

    private List<GifResponse> searchKlipy(String query, int limit, String offset) {
        GifProperties.Provider klipy = properties.getKlipy();
        if (!klipy.isEnabled() || !StringUtils.hasText(klipy.getApiKey())) {
            return List.of();
        }

        String url = UriComponentsBuilder.fromUriString(searchUrl(klipy, "https://api.klipy.com/v2/search"))
                .queryParam("key", klipy.getApiKey())
                .queryParam("q", query)
                .queryParam("limit", limit)
                .queryParam("pos", StringUtils.hasText(offset) ? offset : "0")
                .queryParam("media_filter", "gif,tinygif")
                .queryParam("contentfilter", properties.getRating())
                .queryParam("locale", properties.getLang())
                .build()
                .encode()
                .toUriString();

        try {
            Map<String, Object> body = getJson(url);
            return asList(body.get("results")).stream()
                    .map(this::mapKlipyItem)
                    .filter(Objects::nonNull)
                    .toList();
        } catch (RuntimeException ex) {
            log.warn("Klipy search failed", ex);
            return List.of();
        }
    }

    private GifResponse mapGiphyItem(Map<String, Object> item) {
        Map<String, Object> fixedWidth = asMap(at(item, "images", "fixed_width"));
        Map<String, Object> preview = asMap(at(item, "images", "fixed_width_downsampled"));
        String gifUrl = string(fixedWidth.get("url"));
        if (!StringUtils.hasText(gifUrl)) {
            return null;
        }

        return new GifResponse(
                string(item.get("id")),
                "GIPHY",
                firstText(item, "title", "alt_text"),
                gifUrl,
                firstText(preview, "url", "webp"),
                firstText(item, "url", "embed_url"),
                integer(fixedWidth.get("width")),
                integer(fixedWidth.get("height"))
        );
    }

    private GifResponse mapKlipyItem(Map<String, Object> item) {
        Map<String, Object> gif = asMap(at(item, "media_formats", "gif"));
        Map<String, Object> tinyGif = asMap(at(item, "media_formats", "tinygif"));
        String gifUrl = firstText(gif, "url", "preview");
        if (!StringUtils.hasText(gifUrl)) {
            gifUrl = firstText(tinyGif, "url", "preview");
        }
        if (!StringUtils.hasText(gifUrl)) {
            gifUrl = firstText(item, "gif_url", "media_url", "url");
        }
        if (!StringUtils.hasText(gifUrl)) {
            return null;
        }

        List<Object> dims = asObjectList(gif.get("dims"));
        Integer width = dims.size() > 0 ? integer(dims.get(0)) : integer(gif.get("width"));
        Integer height = dims.size() > 1 ? integer(dims.get(1)) : integer(gif.get("height"));

        return new GifResponse(
                string(item.get("id")),
                "Klipy",
                firstText(item, "content_description", "title", "name"),
                gifUrl,
                firstText(tinyGif, "url", "preview"),
                firstText(item, "itemurl", "url"),
                width,
                height
        );
    }

    private Map<String, Object> getJson(String url) {
        Map<String, Object> body = restClient.get()
                .uri(url)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });
        return body == null ? Map.of() : body;
    }

    private String normalizeProvider(String provider) {
        String value = provider == null ? ALL : provider.trim().toLowerCase(Locale.ROOT);
        return switch (value) {
            case GIPHY, KLIPY, ALL -> value;
            default -> ALL;
        };
    }

    private int normalizeLimit(int requestedLimit) {
        int fallback = Math.max(1, properties.getDefaultLimit());
        int max = Math.max(fallback, properties.getMaxLimit());
        return Math.min(Math.max(requestedLimit <= 0 ? fallback : requestedLimit, 1), max);
    }

    private int parseOffset(String offset) {
        try {
            return Math.max(0, Integer.parseInt(offset == null ? "0" : offset));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private String searchUrl(GifProperties.Provider provider, String fallback) {
        return StringUtils.hasText(provider.getSearchUrl()) ? provider.getSearchUrl() : fallback;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Collections.emptyMap();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asList(Object value) {
        return value instanceof List<?> list ? (List<Map<String, Object>>) (List<?>) list : List.of();
    }

    private List<Object> asObjectList(Object value) {
        return value instanceof List<?> list ? new ArrayList<>(list) : List.of();
    }

    private Object at(Map<String, Object> map, String... path) {
        Object current = map;
        for (String part : path) {
            if (!(current instanceof Map<?, ?> currentMap)) {
                return null;
            }
            current = currentMap.get(part);
        }
        return current;
    }

    private String firstText(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            String value = string(map.get(key));
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return "";
    }

    private String string(Object value) {
        return value instanceof String text ? text : "";
    }

    private Integer integer(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
