package com.collegeopt.platform.auth;

import com.collegeopt.platform.auth.dto.VerificationSendResponse;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Service
public class AuthSecurityService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_MINUTES = 10;
    private static final int CODE_EXPIRY_MINUTES = 10;
    private static final int MAX_CODE_ATTEMPTS = 5;
    private static final Pattern STRONG_PASSWORD_PATTERN = Pattern.compile(
            "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?]).{8,64}$");

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, LoginAttemptState> loginAttempts = new ConcurrentHashMap<>();
    private final Map<String, VerificationState> verificationCodes = new ConcurrentHashMap<>();

    public void ensureLoginAllowed(String email) {
        String normalized = email.toLowerCase();
        LoginAttemptState state = loginAttempts.get(normalized);
        if (state == null || state.lockedUntil() == null) {
            return;
        }

        if (state.lockedUntil().isAfter(Instant.now())) {
            long minutes = Math.max(1, Duration.between(Instant.now(), state.lockedUntil()).toMinutes());
            throw new IllegalStateException("Account is temporarily locked. Try again in " + minutes + " minute(s).");
        }

        loginAttempts.remove(normalized);
    }

    public String registerLoginFailure(String email) {
        String normalized = email.toLowerCase();
        LoginAttemptState current = loginAttempts.getOrDefault(normalized, new LoginAttemptState(0, null));

        int failedAttempts = current.failedAttempts() + 1;
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            Instant lockUntil = Instant.now().plus(Duration.ofMinutes(LOCK_MINUTES));
            loginAttempts.put(normalized, new LoginAttemptState(0, lockUntil));
            return "Too many failed login attempts. Account locked for " + LOCK_MINUTES + " minutes.";
        }

        loginAttempts.put(normalized, new LoginAttemptState(failedAttempts, null));
        int attemptsLeft = MAX_FAILED_ATTEMPTS - failedAttempts;
        return "Invalid credentials. " + attemptsLeft + " attempt(s) remaining before temporary lock.";
    }

    public void clearLoginFailures(String email) {
        loginAttempts.remove(email.toLowerCase());
    }

    public VerificationSendResponse generateVerificationCode(String email, VerificationPurpose purpose) {
        String normalized = email.toLowerCase();
        String code = String.format("%06d", secureRandom.nextInt(1_000_000));
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(CODE_EXPIRY_MINUTES));
        verificationCodes.put(codeKey(normalized, purpose), new VerificationState(code, expiresAt, MAX_CODE_ATTEMPTS));

        return new VerificationSendResponse(
                normalized,
                purpose,
                CODE_EXPIRY_MINUTES,
                "Verification code generated. In production this will be delivered via email.",
                code);
    }

    public void consumeVerificationCode(String email, VerificationPurpose purpose, String code) {
        String normalized = email.toLowerCase();
        String key = codeKey(normalized, purpose);
        VerificationState state = verificationCodes.get(key);
        if (state == null) {
            throw new IllegalArgumentException("Verification code not found. Request a new code.");
        }

        if (state.expiresAt().isBefore(Instant.now())) {
            verificationCodes.remove(key);
            throw new IllegalArgumentException("Verification code expired. Request a new code.");
        }

        if (!state.code().equals(code)) {
            int attemptsLeft = state.attemptsLeft() - 1;
            if (attemptsLeft <= 0) {
                verificationCodes.remove(key);
                throw new IllegalArgumentException("Verification failed too many times. Request a new code.");
            }
            verificationCodes.put(key, new VerificationState(state.code(), state.expiresAt(), attemptsLeft));
            throw new IllegalArgumentException("Invalid verification code. " + attemptsLeft + " attempt(s) remaining.");
        }

        verificationCodes.remove(key);
    }

    public void validateStrongPassword(String password) {
        if (!STRONG_PASSWORD_PATTERN.matcher(password).matches()) {
            throw new IllegalArgumentException(
                    "Password must be 8-64 chars with uppercase, lowercase, number, and special character.");
        }
    }

    private String codeKey(String email, VerificationPurpose purpose) {
        return email + "|" + purpose.name();
    }

    private record LoginAttemptState(int failedAttempts, Instant lockedUntil) {
    }

    private record VerificationState(String code, Instant expiresAt, int attemptsLeft) {
    }
}
