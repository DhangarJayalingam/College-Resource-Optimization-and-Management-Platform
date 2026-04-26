package com.collegeopt.platform.booking;

import com.collegeopt.platform.common.ApiResponse;
import com.collegeopt.platform.resource.ResourceType;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.UserDirectoryService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/bookings")
public class BookingController {

    private final BookingService bookingService;
    private final UserDirectoryService userDirectoryService;

    public BookingController(BookingService bookingService, UserDirectoryService userDirectoryService) {
        this.bookingService = bookingService;
        this.userDirectoryService = userDirectoryService;
    }

    @GetMapping("/requests")
    public ResponseEntity<ApiResponse<List<ResourceRequestDto>>> listRequests(Authentication authentication) {
        AppUser currentUser = currentUser(authentication);
        return ResponseEntity.ok(ApiResponse.ok("Resource requests",
                currentUser.roles().contains(com.collegeopt.platform.user.RoleType.SUPER_ADMIN)
                        ? bookingService.getAllRequests()
                        : bookingService.getRequestsForDepartment(currentUser.departmentId())));
    }

    @PostMapping("/requests")
    public ResponseEntity<ApiResponse<ResourceRequestDto>> createRequest(@Valid @RequestBody ResourceRequestCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Resource request submitted", bookingService.createRequest(request)));
    }

    @PostMapping("/requests/{requestId}/approve")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<ResourceRequestDto>> approveRequest(@PathVariable("requestId") Long requestId, @Valid @RequestBody ApproveRequestAction action) {
        return ResponseEntity.ok(ApiResponse.ok("Request approved", bookingService.approveRequest(requestId, action)));
    }

    @PostMapping("/requests/{requestId}/reject")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<ResourceRequestDto>> rejectRequest(@PathVariable("requestId") Long requestId, @Valid @RequestBody ApproveRequestAction action) {
        return ResponseEntity.ok(ApiResponse.ok("Request rejected", bookingService.rejectRequest(requestId, action)));
    }

    @GetMapping("/facility")
    public ResponseEntity<ApiResponse<List<FacilityBookingDto>>> listFacilityBookings(Authentication authentication) {
        AppUser currentUser = currentUser(authentication);
        return ResponseEntity.ok(ApiResponse.ok("Facility bookings",
                currentUser.roles().contains(com.collegeopt.platform.user.RoleType.SUPER_ADMIN)
                        ? bookingService.getAllBookings()
                        : bookingService.getBookingsForDepartment(currentUser.departmentId())));
    }

    @GetMapping("/facility/resource/{resourceId}")
    public ResponseEntity<ApiResponse<List<FacilityBookingDto>>> listBookingsForResource(@PathVariable("resourceId") Long resourceId,
                                                                                          Authentication authentication) {
        AppUser currentUser = currentUser(authentication);
        List<FacilityBookingDto> bookings = currentUser.roles().contains(com.collegeopt.platform.user.RoleType.SUPER_ADMIN)
                ? bookingService.getBookingsForResource(resourceId)
                : bookingService.getBookingsForDepartment(currentUser.departmentId()).stream()
                .filter(booking -> booking.resourceId().equals(resourceId))
                .toList();
        return ResponseEntity.ok(ApiResponse.ok("Resource bookings", bookings));
    }

    @PostMapping("/request")
    @PreAuthorize("hasAnyRole('FACULTY','COLLEGE_ADMIN','SUPER_ADMIN','STUDENT')")
    public ResponseEntity<ApiResponse<BookingDto>> requestBooking(@Valid @RequestBody BookingRequestDto request, Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("Booking request created", bookingService.createAdvancedBooking(request, currentUser(authentication))));
    }

    @PutMapping("/approve/{id}")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<BookingDto>> approveBooking(@PathVariable("id") Long id, @RequestBody BookingActionDto action, Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("Booking approved", bookingService.approveAdvancedBooking(id, action, currentUser(authentication))));
    }

    @PutMapping("/reject/{id}")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<BookingDto>> rejectBooking(@PathVariable("id") Long id, @RequestBody BookingActionDto action, Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("Booking rejected", bookingService.rejectAdvancedBooking(id, action, currentUser(authentication))));
    }

    @PutMapping("/cancel/{id}")
    @PreAuthorize("hasAnyRole('FACULTY','COLLEGE_ADMIN','SUPER_ADMIN','STUDENT')")
    public ResponseEntity<ApiResponse<BookingDto>> cancelBooking(@PathVariable("id") Long id, @RequestBody BookingActionDto action, Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("Booking cancelled", bookingService.cancelAdvancedBooking(id, action, currentUser(authentication))));
    }

    @GetMapping("/history")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<BookingDto>>> history(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("Booking history", bookingService.listHistory(currentUser(authentication))));
    }

    @GetMapping("/pending-approvals")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<BookingDto>>> pendingApprovals(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("Pending approvals", bookingService.listPendingApprovals(currentUser(authentication))));
    }

    @GetMapping("/recommend")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<BookingRecommendationDto>>> recommend(
            @RequestParam ResourceType resourceType,
            @RequestParam(required = false) Integer expectedCapacity,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime endTime,
            Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("Booking recommendations",
                bookingService.recommend(resourceType, expectedCapacity, date, startTime, endTime, currentUser(authentication))));
    }

    @GetMapping("/notifications")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<BookingNotificationDto>>> notifications(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("Booking notifications", bookingService.notifications(currentUser(authentication))));
    }

    @GetMapping("/analytics")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<BookingAnalyticsDto>> analytics(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("Booking analytics", bookingService.analytics(currentUser(authentication))));
    }

    private AppUser currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new IllegalArgumentException("Session expired. Please log in again.");
        }
        return userDirectoryService.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user not found"));
    }
}
