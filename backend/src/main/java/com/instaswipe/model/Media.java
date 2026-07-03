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
}