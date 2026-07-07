package com.instaswipe.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Media {

    private MediaType type;

    private String url;

    private String filename;

    private long size;

    /**
     * Processing lifecycle state. Legacy documents persisted before the async
     * pipeline have no value; {@code null} is treated as {@link MediaStatus#READY}.
     */
    private MediaStatus status;
}