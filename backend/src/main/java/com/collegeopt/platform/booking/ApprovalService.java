package com.collegeopt.platform.booking;

import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import org.springframework.stereotype.Service;

@Service
public class ApprovalService {

    public void validateApprovalAccess(BookingDto booking, AppUser approver) {
        if (booking.currentApprovalStage() == ApprovalStage.COLLEGE_ADMIN
                && !(approver.roles().contains(RoleType.COLLEGE_ADMIN) || approver.roles().contains(RoleType.SUPER_ADMIN))) {
            throw new IllegalArgumentException("Only department admins can approve this booking at the current stage");
        }

        if (booking.currentApprovalStage() == ApprovalStage.RESOURCE_MANAGER
                && !approver.roles().contains(RoleType.SUPER_ADMIN)) {
            throw new IllegalArgumentException("Only superadmin can complete resource manager approval");
        }
    }
}
