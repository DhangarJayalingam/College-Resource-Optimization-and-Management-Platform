package com.collegeopt.platform.auth;

import com.collegeopt.platform.auth.dto.AuthResponse;
import com.collegeopt.platform.auth.dto.ChangePasswordRequest;
import com.collegeopt.platform.auth.dto.ForgotPasswordRequest;
import com.collegeopt.platform.auth.dto.LoginRequest;
import com.collegeopt.platform.auth.dto.LogoutAllSessionsRequest;
import com.collegeopt.platform.auth.dto.RegisterRequest;
import com.collegeopt.platform.auth.dto.ResetPasswordRequest;
import com.collegeopt.platform.auth.dto.SelfRegisterRequest;
import com.collegeopt.platform.auth.dto.SocialLoginRequest;
import com.collegeopt.platform.auth.dto.VerificationSendRequest;
import com.collegeopt.platform.auth.dto.VerificationSendResponse;
import com.collegeopt.platform.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Login successful", authService.login(request)));
    }

    @PostMapping("/verification/send")
    public ResponseEntity<ApiResponse<VerificationSendResponse>> sendVerification(@Valid @RequestBody VerificationSendRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Verification code sent", authService.sendVerificationCode(request)));
    }

    @PostMapping("/register-self")
    public ResponseEntity<ApiResponse<AuthResponse>> selfRegister(@Valid @RequestBody SelfRegisterRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Registration successful", authService.selfRegister(request)));
    }

    @PostMapping("/register")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("User created", authService.register(request)));
    }

    @PostMapping("/password/forgot")
    public ResponseEntity<ApiResponse<VerificationSendResponse>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Password reset code sent", authService.forgotPassword(request)));
    }

    @PostMapping("/password/reset")
    public ResponseEntity<ApiResponse<String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Password updated", authService.resetPassword(request)));
    }

    @PostMapping("/change-password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<String>> changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                                              Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("Password updated", authService.changePassword(authentication.getName(), request)));
    }

    @PostMapping("/logout-all-sessions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<String>> logoutAllSessions(@RequestBody(required = false) LogoutAllSessionsRequest request,
                                                                 Authentication authentication) {
        LogoutAllSessionsRequest payload = request == null ? new LogoutAllSessionsRequest(true) : request;
        return ResponseEntity.ok(ApiResponse.ok("Sessions invalidated", authService.logoutAllSessions(authentication.getName(), payload)));
    }

    @PostMapping("/social-login")
    public ResponseEntity<ApiResponse<AuthResponse>> socialLogin(@Valid @RequestBody SocialLoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Social login successful", authService.socialLogin(request)));
    }
}
