package com.instaswipe.controller;

import com.instaswipe.dto.StatusResponse;
import com.instaswipe.service.StatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/status")
@RequiredArgsConstructor
public class StatusController {

    private final StatusService statusService;

    @GetMapping
    public StatusResponse getStatus() {
        return statusService.getStatus();
    }
}
