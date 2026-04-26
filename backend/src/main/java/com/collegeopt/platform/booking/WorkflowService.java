package com.collegeopt.platform.booking;

import com.collegeopt.platform.resource.ResourceType;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import org.springframework.stereotype.Service;

@Service
public class WorkflowService {

    public ApprovalStage determineInitialStage(AppUser user, ResourceType resourceType, boolean recurring) {
        if (user.roles().contains(RoleType.SUPER_ADMIN)) {
            return ApprovalStage.COMPLETED;
        }
        if (resourceType == ResourceType.EQUIPMENT || resourceType == ResourceType.LAB || recurring) {
            return ApprovalStage.RESOURCE_MANAGER;
        }
        return ApprovalStage.COLLEGE_ADMIN;
    }

    public boolean requiresApproval(AppUser user, ResourceType resourceType) {
        return !user.roles().contains(RoleType.SUPER_ADMIN)
                && !(user.roles().contains(RoleType.COLLEGE_ADMIN) && resourceType == ResourceType.CLASSROOM);
    }
}
