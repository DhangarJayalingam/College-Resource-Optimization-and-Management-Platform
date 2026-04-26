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
import com.collegeopt.platform.security.JwtService;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import com.collegeopt.platform.user.UserDirectoryService;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.Map;
import java.util.UUID;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserDirectoryService userDirectoryService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuthSecurityService authSecurityService;

    public AuthService(AuthenticationManager authenticationManager,
            UserDirectoryService userDirectoryService,
            JwtService jwtService,
            PasswordEncoder passwordEncoder,
            AuthSecurityService authSecurityService) {
        this.authenticationManager = authenticationManager;
        this.userDirectoryService = userDirectoryService;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.authSecurityService = authSecurityService;
    }

    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.email().toLowerCase();
        authSecurityService.ensureLoginAllowed(normalizedEmail);

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(normalizedEmail, request.password()));
        } catch (AuthenticationException ex) {
            String failureMessage = authSecurityService.registerLoginFailure(normalizedEmail);
            throw new IllegalArgumentException(failureMessage);
        }

        AppUser appUser = userDirectoryService.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        authSecurityService.clearLoginFailures(normalizedEmail);

        return buildAuthResponse(appUser, Map.of(
                "fullName", appUser.fullName(),
                "tenantId", appUser.tenantId(),
                "campusId", appUser.campusId(),
                "departmentId", appUser.departmentId(),
                "sessionVersion", appUser.sessionVersion(),
                "authMode", "PASSWORD"));
    }

    public VerificationSendResponse sendVerificationCode(VerificationSendRequest request) {
        if (request.purpose() == VerificationPurpose.REGISTRATION
                && userDirectoryService.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email already registered.");
        }
        if (request.purpose() == VerificationPurpose.PASSWORD_RESET
                && !userDirectoryService.existsByEmail(request.email())) {
            throw new IllegalArgumentException("No account found for this email.");
        }
        return authSecurityService.generateVerificationCode(request.email(), request.purpose());
    }

    public AuthResponse selfRegister(SelfRegisterRequest request) {
        authSecurityService.validateStrongPassword(request.password());
        authSecurityService.consumeVerificationCode(
                request.email(),
                VerificationPurpose.REGISTRATION,
                request.verificationCode());

        AppUser created = userDirectoryService.register(
                request.fullName(),
                request.email(),
                passwordEncoder.encode(request.password()),
                EnumSet.of(RoleType.STUDENT),
                1L,
                1L);

        return buildAuthResponse(created, Map.of(
                "fullName", created.fullName(),
                "tenantId", created.tenantId(),
                "campusId", created.campusId(),
                "departmentId", created.departmentId(),
                "sessionVersion", created.sessionVersion(),
                "authMode", "SELF_REGISTER"));
    }

    public AuthResponse register(RegisterRequest request) {
        authSecurityService.validateStrongPassword(request.password());
        AppUser created = userDirectoryService.register(
                request.fullName(),
                request.email(),
                passwordEncoder.encode(request.password()),
                request.roles(),
                request.tenantId(),
                request.campusId());

        return buildAuthResponse(created, Map.of(
                "fullName", created.fullName(),
                "tenantId", created.tenantId(),
                "campusId", created.campusId(),
                "departmentId", created.departmentId(),
                "sessionVersion", created.sessionVersion(),
                "authMode", "ADMIN_REGISTER"));
    }

    public VerificationSendResponse forgotPassword(ForgotPasswordRequest request) {
        if (!userDirectoryService.existsByEmail(request.email())) {
            throw new IllegalArgumentException("No account found for this email.");
        }
        return authSecurityService.generateVerificationCode(request.email(), VerificationPurpose.PASSWORD_RESET);
    }

    public String resetPassword(ResetPasswordRequest request) {
        authSecurityService.validateStrongPassword(request.newPassword());
        authSecurityService.consumeVerificationCode(
                request.email(),
                VerificationPurpose.PASSWORD_RESET,
                request.verificationCode());
        userDirectoryService.updatePassword(request.email(), passwordEncoder.encode(request.newPassword()));
        return "Password reset successful.";
    }

    public String changePassword(String email, ChangePasswordRequest request) {
        AppUser currentUser = userDirectoryService.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (!passwordEncoder.matches(request.currentPassword(), currentUser.passwordHash())) {
            throw new IllegalArgumentException("Current password is incorrect.");
        }
        authSecurityService.validateStrongPassword(request.newPassword());
        userDirectoryService.updatePassword(email, passwordEncoder.encode(request.newPassword()));
        userDirectoryService.incrementSessionVersion(currentUser.id());
        return "Password changed successfully. Please sign in again on all devices.";
    }

    public String logoutAllSessions(String email, LogoutAllSessionsRequest request) {
        AppUser currentUser = userDirectoryService.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        userDirectoryService.incrementSessionVersion(currentUser.id());
        return request.includeCurrentSession()
                ? "All sessions have been terminated, including the current one."
                : "All other sessions have been terminated. Refresh and sign in again where needed.";
    }

    public AuthResponse socialLogin(SocialLoginRequest request) {
        AppUser user = userDirectoryService.findOrCreateSocialUser(
                request.fullName(),
                request.email(),
                passwordEncoder.encode("SOCIAL_" + UUID.randomUUID()),
                RoleType.STUDENT);
        return buildAuthResponse(user, Map.of(
                "fullName", user.fullName(),
                "tenantId", user.tenantId(),
                "campusId", user.campusId(),
                "departmentId", user.departmentId(),
                "sessionVersion", user.sessionVersion(),
                "authMode", "SOCIAL",
                "provider", request.provider().name()));
    }

    private AuthResponse buildAuthResponse(AppUser appUser, Map<String, Object> claims) {
        String token = jwtService.generateToken(
                User.builder()
                        .username(appUser.email())
                        .password(appUser.passwordHash())
                        .authorities(appUser.roles().stream().map(role -> "ROLE_" + role.name()).toArray(String[]::new))
                        .build(),
                claims);
        return new AuthResponse(token, appUser.email(), appUser.fullName(), appUser.roles());
    }

    public String handleGoogleCallback(String code, String clientId, String clientSecret, String redirectUri) {
        try {
            // Exchange code for access token
            String tokenResponse = exchangeCodeForToken(
                    "https://oauth2.googleapis.com/token",
                    code, clientId, clientSecret, redirectUri);

            ObjectMapper mapper = new ObjectMapper();
            JsonNode tokenNode = mapper.readTree(tokenResponse);
            String accessToken = tokenNode.get("access_token").asText();

            // Get user info from Google
            String userInfoResponse = getUserInfoFromGoogle(accessToken);
            JsonNode userInfo = mapper.readTree(userInfoResponse);

            String email = userInfo.get("email").asText();
            String name = userInfo.get("name").asText();

            // Find or create user
            AppUser user = userDirectoryService.findOrCreateSocialUser(
                    name,
                    email,
                    passwordEncoder.encode("GOOGLE_" + UUID.randomUUID()),
                    RoleType.STUDENT);

            AuthResponse authResponse = buildAuthResponse(user, Map.of(
                    "fullName", user.fullName(),
                    "tenantId", user.tenantId(),
                    "campusId", user.campusId(),
                    "departmentId", user.departmentId(),
                    "sessionVersion", user.sessionVersion(),
                    "authMode", "GOOGLE"));

            return authResponse.token();
        } catch (Exception e) {
            throw new IllegalStateException("Google OAuth2 callback failed: " + e.getMessage(), e);
        }
    }

    public String handleLinkedInCallback(String code, String clientId, String clientSecret, String redirectUri) {
        try {
            // Exchange code for access token
            String tokenResponse = exchangeCodeForToken(
                    "https://www.linkedin.com/oauth/v2/accessToken",
                    code, clientId, clientSecret, redirectUri);

            ObjectMapper mapper = new ObjectMapper();
            JsonNode tokenNode = mapper.readTree(tokenResponse);
            String accessToken = tokenNode.get("access_token").asText();

            // Get user info from LinkedIn
            String userInfoResponse = getUserInfoFromLinkedIn(accessToken);
            JsonNode userInfo = mapper.readTree(userInfoResponse);

            String email = userInfo.get("email").asText();
            String name = userInfo.get("localizedFirstName").asText() + " "
                    + userInfo.get("localizedLastName").asText();

            // Find or create user
            AppUser user = userDirectoryService.findOrCreateSocialUser(
                    name,
                    email,
                    passwordEncoder.encode("LINKEDIN_" + UUID.randomUUID()),
                    RoleType.STUDENT);

            AuthResponse authResponse = buildAuthResponse(user, Map.of(
                    "fullName", user.fullName(),
                    "tenantId", user.tenantId(),
                    "campusId", user.campusId(),
                    "departmentId", user.departmentId(),
                    "sessionVersion", user.sessionVersion(),
                    "authMode", "LINKEDIN"));

            return authResponse.token();
        } catch (Exception e) {
            throw new IllegalStateException("LinkedIn OAuth2 callback failed: " + e.getMessage(), e);
        }
    }

    private String exchangeCodeForToken(String tokenEndpoint, String code, String clientId, String clientSecret,
            String redirectUri) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String body = String.format(
                "grant_type=authorization_code&code=%s&client_id=%s&client_secret=%s&redirect_uri=%s",
                code, clientId, clientSecret, redirectUri);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(tokenEndpoint))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("Token exchange failed: " + response.body());
        }
        return response.body();
    }

    private String getUserInfoFromGoogle(String accessToken) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://www.googleapis.com/oauth2/v2/userinfo"))
                .header("Authorization", "Bearer " + accessToken)
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("Failed to get Google user info: " + response.body());
        }
        return response.body();
    }

    private String getUserInfoFromLinkedIn(String accessToken) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(
                        "https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture)"))
                .header("Authorization", "Bearer " + accessToken)
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("Failed to get LinkedIn user info: " + response.body());
        }
        return response.body();
    }
}
