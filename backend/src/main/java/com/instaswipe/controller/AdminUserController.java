package com.instaswipe.controller;

import com.instaswipe.dto.AdminUserDetailResponse;
import com.instaswipe.dto.AdminUserSummaryResponse;
import com.instaswipe.dto.PageResponse;
import com.instaswipe.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminService adminService;

    @GetMapping
    public ResponseEntity<PageResponse<AdminUserSummaryResponse>> listUsers(
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(adminService.listUsers(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AdminUserDetailResponse> getUser(@PathVariable String id) {
        return ResponseEntity.ok(adminService.getUser(id));
    }
}
