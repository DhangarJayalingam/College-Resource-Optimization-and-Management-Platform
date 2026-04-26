package com.collegeopt.platform.auth;

import com.collegeopt.platform.common.ApiResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/v1/auth")
public class OAuth2Controller {

    private final AuthService authService;
    private final ConcurrentHashMap<String, String> tokenStore = new ConcurrentHashMap<>();

    @Value("${spring.security.oauth2.client.registration.google.client-id:}")
    private String googleClientId;

    @Value("${spring.security.oauth2.client.registration.google.client-secret:}")
    private String googleClientSecret;

    @Value("${spring.security.oauth2.client.registration.linkedin.client-id:}")
    private String linkedinClientId;

    @Value("${spring.security.oauth2.client.registration.linkedin.client-secret:}")
    private String linkedinClientSecret;

    @Value("${spring.security.oauth2.client.registration.google.redirect-uri:http://localhost:8080/api/v1/auth/oauth2/callback/google}")
    private String googleRedirectUri;

    @Value("${spring.security.oauth2.client.registration.linkedin.redirect-uri:http://localhost:8080/api/v1/auth/oauth2/callback/linkedin}")
    private String linkedinRedirectUri;

    @Value("${app.oauth.frontend-redirect-url:http://localhost:5173}")
    private String frontendRedirectUrl;

    private final ConcurrentHashMap<String, String> stateStore = new ConcurrentHashMap<>();

    public OAuth2Controller(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/oauth2/authorize/google")
    public RedirectView authorizeGoogle(@RequestParam(required = false) String redirectUri)
            throws UnsupportedEncodingException {
        if (googleClientId.isEmpty()) {
            throw new IllegalStateException("Google OAuth2 client ID not configured");
        }
        String state = generateState();
        stateStore.put(state, redirectUri != null ? redirectUri : "");

        String scope = URLEncoder.encode("openid email profile", StandardCharsets.UTF_8.toString());
        String clientId = URLEncoder.encode(googleClientId, StandardCharsets.UTF_8.toString());
        String redirectEncoded = URLEncoder.encode(googleRedirectUri, StandardCharsets.UTF_8.toString());

        String authorizationUrl = String.format(
                "https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&response_type=code&scope=%s&state=%s",
                clientId, redirectEncoded, scope, state);

        return new RedirectView(authorizationUrl);
    }

    @GetMapping("/oauth2/authorize/linkedin")
    public RedirectView authorizeLinkedin(@RequestParam(required = false) String redirectUri)
            throws UnsupportedEncodingException {
        if (linkedinClientId.isEmpty()) {
            throw new IllegalStateException("LinkedIn OAuth2 client ID not configured");
        }
        String state = generateState();
        stateStore.put(state, redirectUri != null ? redirectUri : "");

        String scope = URLEncoder.encode("openid email profile", StandardCharsets.UTF_8.toString());
        String clientId = URLEncoder.encode(linkedinClientId, StandardCharsets.UTF_8.toString());
        String redirectEncoded = URLEncoder.encode(linkedinRedirectUri, StandardCharsets.UTF_8.toString());

        String authorizationUrl = String.format(
                "https://www.linkedin.com/oauth/v2/authorization?client_id=%s&redirect_uri=%s&response_type=code&scope=%s&state=%s",
                clientId, redirectEncoded, scope, state);

        return new RedirectView(authorizationUrl);
    }

    @GetMapping("/oauth2/callback/google")
    public RedirectView googleCallback(@RequestParam String code, @RequestParam String state) {
        try {
            // Verify state
            if (!stateStore.containsKey(state)) {
                throw new IllegalArgumentException("Invalid state parameter");
            }

            String redirectUri = stateStore.remove(state);

            // Exchange authorization code for tokens
            String token = authService.handleGoogleCallback(code, googleClientId, googleClientSecret,
                    googleRedirectUri);

            // Store token temporarily
            String tokenId = generateState();
            tokenStore.put(tokenId, token);

            String finalRedirectUrl = (redirectUri != null && !redirectUri.isEmpty())
                    ? redirectUri
                    : frontendRedirectUrl + "/oauth-callback";

            // Redirect to frontend with token ID instead of token itself
            return new RedirectView(finalRedirectUrl + "?tokenId=" + tokenId);
        } catch (Exception e) {
            String errorMessage = e.getMessage() != null ? e.getMessage() : "Authentication failed";
            return new RedirectView(
                    frontendRedirectUrl + "?error=" + URLEncoder.encode(errorMessage, StandardCharsets.UTF_8));
        }
    }

    @GetMapping("/oauth2/callback/linkedin")
    public RedirectView linkedinCallback(@RequestParam String code, @RequestParam String state) {
        try {
            // Verify state
            if (!stateStore.containsKey(state)) {
                throw new IllegalArgumentException("Invalid state parameter");
            }

            String redirectUri = stateStore.remove(state);

            // Exchange authorization code for tokens
            String token = authService.handleLinkedInCallback(code, linkedinClientId, linkedinClientSecret,
                    linkedinRedirectUri);

            // Store token temporarily
            String tokenId = generateState();
            tokenStore.put(tokenId, token);

            String finalRedirectUrl = (redirectUri != null && !redirectUri.isEmpty())
                    ? redirectUri
                    : frontendRedirectUrl + "/oauth-callback";

            // Redirect to frontend with token ID instead of token itself
            return new RedirectView(finalRedirectUrl + "?tokenId=" + tokenId);
        } catch (Exception e) {
            String errorMessage = e.getMessage() != null ? e.getMessage() : "Authentication failed";
            return new RedirectView(
                    frontendRedirectUrl + "?error=" + URLEncoder.encode(errorMessage, StandardCharsets.UTF_8));
        }
    }

    @GetMapping("/oauth2/token/{tokenId}")
    public ApiResponse<TokenResponse> getOAuthToken(@PathVariable String tokenId) {
        String token = tokenStore.remove(tokenId);
        if (token == null) {
            throw new IllegalArgumentException("Invalid or expired token ID");
        }
        return ApiResponse.ok("Token retrieved successfully", new TokenResponse(token));
    }

    private String generateState() {
        SecureRandom random = new SecureRandom();
        byte[] values = new byte[32];
        random.nextBytes(values);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(values);
    }
}
