package com.collegeopt.platform.user;

import com.collegeopt.platform.common.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserDirectoryService userDirectoryService;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserDirectoryService userDirectoryService, PasswordEncoder passwordEncoder) {
        this.userDirectoryService = userDirectoryService;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<AppUser>> getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
            throw new IllegalArgumentException("Session expired. Please log in again.");
        }

        AppUser user = userDirectoryService.findByEmail(auth.getName().trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("User not found in directory"));
        return ResponseEntity.ok(ApiResponse.ok("Profile loaded", user));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY')")
    public ResponseEntity<ApiResponse<List<AppUser>>> listAccessibleUsers() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        AppUser currentUser = userDirectoryService.findByEmail(auth.getName()).orElseThrow();

        if (currentUser.roles().contains(RoleType.SUPER_ADMIN)) {
            // Principal sees all Admins
            return ResponseEntity.ok(ApiResponse.ok("Users loaded", userDirectoryService.listUsers()));
        } else {
            // Admin sees users in their department
            return ResponseEntity.ok(ApiResponse.ok("Department users loaded",
                    userDirectoryService.listUsersByDepartment(currentUser.departmentId())));
        }
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY')")
    public ResponseEntity<ApiResponse<AppUser>> createUser(@Valid @RequestBody CreateUserRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        AppUser currentUser = userDirectoryService.findByEmail(auth.getName()).orElseThrow();

        RoleType targetRole = RoleType.valueOf(request.role().toUpperCase());

        // Enforcement rules
        if (currentUser.roles().contains(RoleType.SUPER_ADMIN)) {
            // Principal has full access
        } else if (currentUser.roles().contains(RoleType.COLLEGE_ADMIN)) {
            if (targetRole == RoleType.SUPER_ADMIN) {
                throw new IllegalArgumentException("Admins cannot create Principals");
            }
        } else if (currentUser.roles().contains(RoleType.FACULTY)) {
            if (targetRole != RoleType.STUDENT) {
                throw new IllegalArgumentException("Faculty can only create Student accounts");
            }
        }

        // Department matching
        if (!currentUser.roles().contains(RoleType.SUPER_ADMIN)) {
            if (!Objects.equals(currentUser.departmentId(), request.departmentId())) {
                throw new IllegalArgumentException("User creation restricted to your own department");
            }
        }
        if (targetRole == RoleType.COLLEGE_ADMIN && userDirectoryService.hasCollegeAdminForDepartment(request.departmentId())) {
            throw new IllegalArgumentException("Selected department already has an assigned admin");
        }

        AppUser newUser = userDirectoryService.register(
                request.fullName(),
                request.email(),
                passwordEncoder.encode(request.password()),
                EnumSet.of(targetRole),
                currentUser.tenantId(),
                currentUser.campusId(),
                request.departmentId(),
                request.pnrNo(),
                request.rollNo(),
                request.yearSemester());

        return ResponseEntity.ok(ApiResponse.ok("User created successfully", newUser));
    }

    @PostMapping("/bulk-upload")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> bulkUploadUsers(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty())
            throw new IllegalArgumentException("File is empty");

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        AppUser currentUser = userDirectoryService.findByEmail(auth.getName()).orElseThrow();

        List<String> successList = new ArrayList<>();
        List<String> errorList = new ArrayList<>();

        try {
            List<List<String>> rows = readSpreadsheetRows(file);
            int headerIndex = findHeaderRowIndex(rows, List.of("email", "name", "role"));
            if (headerIndex < 0) {
                throw new IllegalArgumentException("Could not find a valid header row in the uploaded file.");
            }

            Map<String, Integer> headerMap = buildHeaderMap(rows.get(headerIndex));
            for (int rowIndex = headerIndex + 1; rowIndex < rows.size(); rowIndex++) {
                List<String> row = rows.get(rowIndex);
                if (isBlankRow(row)) {
                    continue;
                }

                String name = readCell(row, headerMap, "name");
                String email = readCell(row, headerMap, "email");
                String roleStr = readCell(row, headerMap, "role");
                String deptIdStr = firstNonBlank(
                        readCell(row, headerMap, "deptid"),
                        readCell(row, headerMap, "departmentid"),
                        readCell(row, headerMap, "dept")
                );
                String password = firstNonBlank(readCell(row, headerMap, "password"), "Welcome@123");
                String pnrNo = firstNonBlank(readCell(row, headerMap, "pnrno"), readCell(row, headerMap, "pnr"));
                String rollNo = firstNonBlank(readCell(row, headerMap, "rollno"), readCell(row, headerMap, "rollnumber"));
                String yearSemester = firstNonBlank(
                        readCell(row, headerMap, "yearsemester"),
                        readCell(row, headerMap, "year"),
                        readCell(row, headerMap, "academicyear")
                );

                if (isAnyBlank(name, email, roleStr, deptIdStr)) {
                    errorList.add("Row " + (rowIndex + 1) + ": Missing one of required fields Name, Email, Role, or deptID");
                    continue;
                }

                try {
                    Long deptId = Long.parseLong(deptIdStr);
                    RoleType role = RoleType.valueOf(roleStr.toUpperCase());

                    if (currentUser.roles().contains(RoleType.FACULTY) && role != RoleType.STUDENT) {
                        throw new IllegalArgumentException("Faculty can only bulk upload Students");
                    }

                    Long finalDeptId = currentUser.roles().contains(RoleType.SUPER_ADMIN) ? deptId
                            : currentUser.departmentId();
                    if (role == RoleType.COLLEGE_ADMIN && userDirectoryService.hasCollegeAdminForDepartment(finalDeptId)) {
                        throw new IllegalArgumentException("Selected department already has an assigned admin");
                    }

                    userDirectoryService.register(name, email, passwordEncoder.encode(password), EnumSet.of(role), 1L,
                            1L, finalDeptId, pnrNo, rollNo, yearSemester);
                    successList.add(email);
                } catch (Exception e) {
                    errorList.add("Row " + (rowIndex + 1) + " (" + email + "): " + e.getMessage());
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Bulk upload processing failed: " + e.getMessage());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("successCount", successList.size());
        result.put("errors", errorList);

        return ResponseEntity.ok(ApiResponse.ok("Bulk upload processed", result));
    }

    @GetMapping("/bulk-template")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY')")
    public ResponseEntity<byte[]> downloadBulkUserTemplate() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        AppUser currentUser = userDirectoryService.findByEmail(auth.getName()).orElseThrow();

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Sheet createSheet = workbook.createSheet("Create Users");
            createSheet.createFreezePane(0, 1);
            List<String> createHeaders = List.of("name", "email", "role", "deptId", "password", "prnNo", "rollNo", "yearSemester");
            Row createHeaderRow = createSheet.createRow(0);
            for (int index = 0; index < createHeaders.size(); index++) {
                Cell cell = createHeaderRow.createCell(index);
                cell.setCellValue(createHeaders.get(index));
                cell.setCellStyle(headerStyle);
                createSheet.setColumnWidth(index, 20 * 256);
            }

            Sheet deleteSheet = workbook.createSheet("Delete Users");
            deleteSheet.createFreezePane(0, 1);
            Row deleteHeaderRow = deleteSheet.createRow(0);
            Cell deleteHeaderCell = deleteHeaderRow.createCell(0);
            deleteHeaderCell.setCellValue("email");
            deleteHeaderCell.setCellStyle(headerStyle);
            deleteSheet.setColumnWidth(0, 28 * 256);

            Sheet referenceSheet = workbook.createSheet("Reference");
            referenceSheet.setColumnWidth(0, 24 * 256);
            referenceSheet.setColumnWidth(1, 28 * 256);
            referenceSheet.setColumnWidth(2, 18 * 256);

            Row titleRow = referenceSheet.createRow(0);
            titleRow.createCell(0).setCellValue("Allowed Roles");
            referenceSheet.createRow(1).createCell(0).setCellValue("FACULTY");
            referenceSheet.createRow(2).createCell(0).setCellValue("COLLEGE_ADMIN");
            referenceSheet.createRow(3).createCell(0).setCellValue("STUDENT");

            Row yearTitleRow = referenceSheet.createRow(5);
            yearTitleRow.createCell(0).setCellValue("Allowed yearSemester");
            referenceSheet.createRow(6).createCell(0).setCellValue("FE");
            referenceSheet.createRow(7).createCell(0).setCellValue("SE");
            referenceSheet.createRow(8).createCell(0).setCellValue("TE");
            referenceSheet.createRow(9).createCell(0).setCellValue("BE");

            Row notesTitle = referenceSheet.createRow(11);
            notesTitle.createCell(0).setCellValue("Notes");
            referenceSheet.createRow(12).createCell(0).setCellValue("Fill only data rows below the headers.");
            referenceSheet.createRow(13).createCell(0).setCellValue("For non-students, prnNo, rollNo, and yearSemester can be left blank.");
            referenceSheet.createRow(14).createCell(0).setCellValue("Faculty users can bulk create Students only.");

            Row deptHeader = referenceSheet.createRow(16);
            deptHeader.createCell(0).setCellValue("Department ID");
            deptHeader.createCell(1).setCellValue("Department Scope");

            int deptRowIndex = 17;
            if (currentUser.roles().contains(RoleType.SUPER_ADMIN)) {
                Row row = referenceSheet.createRow(deptRowIndex);
                row.createCell(0).setCellValue("Use existing department ID");
                row.createCell(1).setCellValue("Super admin can create users for any department");
            } else {
                Row row = referenceSheet.createRow(deptRowIndex);
                row.createCell(0).setCellValue(currentUser.departmentId() == null ? "" : String.valueOf(currentUser.departmentId()));
                row.createCell(1).setCellValue("Your department only");
            }

            workbook.write(outputStream);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=bulk-user-template.xlsx")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(outputStream.toByteArray());
        } catch (Exception exception) {
            throw new RuntimeException("Could not generate bulk user template: " + exception.getMessage(), exception);
        }
    }

    @PostMapping("/bulk-delete")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> bulkDeleteUsers(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        AppUser currentUser = userDirectoryService.findByEmail(auth.getName()).orElseThrow();

        List<String> successList = new ArrayList<>();
        List<String> errorList = new ArrayList<>();

        try {
            List<List<String>> rows = readSpreadsheetRows(file);
            boolean firstLine = true;
            for (List<String> row : rows) {
                String rawLine = String.join(",", row).trim();
                if (rawLine.isBlank()) {
                    continue;
                }

                if (firstLine) {
                    firstLine = false;
                    String loweredHeader = rawLine.toLowerCase(Locale.ROOT);
                    if (loweredHeader.equals("email") || loweredHeader.equals("email,address") || loweredHeader.startsWith("email,")) {
                        continue;
                    }
                }

                String email = row.isEmpty() ? "" : row.get(0).trim().toLowerCase(Locale.ROOT);
                if (email.isBlank()) {
                    errorList.add("Blank email row encountered");
                    continue;
                }

                try {
                    if (currentUser.email().equalsIgnoreCase(email)) {
                        throw new IllegalArgumentException("Cannot delete your own account from bulk delete");
                    }

                    AppUser targetUser = userDirectoryService.findByEmail(email)
                            .orElseThrow(() -> new IllegalArgumentException("User not found"));

                    if (!currentUser.roles().contains(RoleType.SUPER_ADMIN)) {
                        if (!Objects.equals(currentUser.departmentId(), targetUser.departmentId())) {
                            throw new IllegalArgumentException("Access Denied: Different Department");
                        }
                        if (currentUser.roles().contains(RoleType.FACULTY) && !targetUser.roles().contains(RoleType.STUDENT)) {
                            throw new IllegalArgumentException("Faculty can only remove Students");
                        }
                    }

                    userDirectoryService.deleteByEmail(email);
                    successList.add(email);
                } catch (Exception e) {
                    errorList.add(email + ": " + e.getMessage());
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Bulk delete processing failed: " + e.getMessage());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("successCount", successList.size());
        result.put("errors", errorList);

        return ResponseEntity.ok(ApiResponse.ok("Bulk delete processed", result));
    }

    private List<List<String>> readSpreadsheetRows(MultipartFile file) throws Exception {
        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (originalName.endsWith(".xlsx")) {
            return readExcelRows(file);
        }
        return readCsvRows(file);
    }

    private List<List<String>> readCsvRows(MultipartFile file) throws Exception {
        List<List<String>> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String rawLine = line == null ? "" : line.trim();
                if (rawLine.isBlank()) {
                    continue;
                }
                rows.add(Arrays.stream(line.split(",", -1)).map(String::trim).toList());
            }
        }
        return rows;
    }

    private List<List<String>> readExcelRows(MultipartFile file) throws Exception {
        List<List<String>> rows = new ArrayList<>();
        DataFormatter formatter = new DataFormatter();
        try (XSSFWorkbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) {
                return rows;
            }

            for (Row row : sheet) {
                List<String> cells = new ArrayList<>();
                int lastCell = Math.max(row.getLastCellNum(), 1);
                for (int index = 0; index < lastCell; index++) {
                    Cell cell = row.getCell(index, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                    cells.add(cell == null ? "" : formatter.formatCellValue(cell).trim());
                }
                boolean hasAnyValue = cells.stream().anyMatch(value -> value != null && !value.isBlank());
                if (hasAnyValue) {
                    rows.add(cells);
                }
            }
        }
        return rows;
    }

    private int findHeaderRowIndex(List<List<String>> rows, List<String> requiredHeaders) {
        for (int index = 0; index < rows.size(); index++) {
            Map<String, Integer> headerMap = buildHeaderMap(rows.get(index));
            boolean hasAllRequiredHeaders = requiredHeaders.stream().allMatch(headerMap::containsKey);
            if (hasAllRequiredHeaders) {
                return index;
            }
        }
        return -1;
    }

    private Map<String, Integer> buildHeaderMap(List<String> headerRow) {
        Map<String, Integer> headerMap = new HashMap<>();
        for (int index = 0; index < headerRow.size(); index++) {
            String normalized = normalizeHeader(headerRow.get(index));
            if (!normalized.isBlank()) {
                headerMap.putIfAbsent(normalized, index);
            }
        }
        return headerMap;
    }

    private String normalizeHeader(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private String readCell(List<String> row, Map<String, Integer> headerMap, String headerKey) {
        Integer index = headerMap.get(headerKey);
        if (index == null || index < 0 || index >= row.size()) {
            return "";
        }
        return row.get(index).trim();
    }

    private boolean isBlankRow(List<String> row) {
        return row == null || row.stream().allMatch(value -> value == null || value.trim().isBlank());
    }

    private boolean isAnyBlank(String... values) {
        for (String value : values) {
            if (value == null || value.trim().isBlank()) {
                return true;
            }
        }
        return false;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    @DeleteMapping("/{email}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY')")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable("email") String email) {
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
        if (normalizedEmail.isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        AppUser currentUser = userDirectoryService.findByEmail(auth.getName())
                .orElseThrow(() -> new IllegalArgumentException("Session expired. Please log in again."));

        if (currentUser.email().equalsIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("Cannot delete your own account from here");
        }

        AppUser targetUser = userDirectoryService.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User '" + normalizedEmail + "' not found."));

        // Enrollment logic
        if (!currentUser.roles().contains(RoleType.SUPER_ADMIN)) {
            if (!Objects.equals(currentUser.departmentId(), targetUser.departmentId())) {
                throw new IllegalArgumentException("Access Denied: Different Department");
            }
            if (currentUser.roles().contains(RoleType.FACULTY) && !targetUser.roles().contains(RoleType.STUDENT)) {
                throw new IllegalArgumentException("Faculty can only remove Students");
            }
        }

        userDirectoryService.deleteByEmail(normalizedEmail);
        return ResponseEntity.ok(ApiResponse.ok("User deleted successfully", null));
    }

    @PostMapping("/{userId}/assign-department-admin")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AppUser>> assignDepartmentAdmin(@PathVariable("userId") Long userId,
            @Valid @RequestBody AssignDepartmentAdminRequest request) {
        AppUser updatedUser = userDirectoryService.assignCollegeAdmin(userId, request.departmentId());
        return ResponseEntity.ok(ApiResponse.ok("Department admin assigned successfully", updatedUser));
    }
}

record CreateUserRequest(
        @NotBlank String fullName,
        @NotBlank String email,
        @NotBlank String password,
        @NotBlank String role,
        Long departmentId,
        String pnrNo,
        String rollNo,
        String yearSemester) {
}

record AssignDepartmentAdminRequest(
        Long departmentId) {
}
