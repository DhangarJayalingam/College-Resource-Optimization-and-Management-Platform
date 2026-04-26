package com.collegeopt.platform.timetable;

import com.collegeopt.platform.resource.ResourceDto;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.resource.ResourceType;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import com.collegeopt.platform.user.UserDirectoryService;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class TimetableBulkImportService {

    private static final List<String> TEMPLATE_HEADERS = List.of(
            "Course Code",
            "Academic Level",
            "Section Code",
            "Faculty Name",
            "Resource ID",
            "Resource Type",
            "Entry Type",
            "Duration",
            "Day Of Week",
            "Start Time",
            "End Time"
    );

    private final TimetableService timetableService;
    private final ResourceService resourceService;
    private final UserDirectoryService userDirectoryService;

    public TimetableBulkImportService(TimetableService timetableService,
                                      ResourceService resourceService,
                                      UserDirectoryService userDirectoryService) {
        this.timetableService = timetableService;
        this.resourceService = resourceService;
        this.userDirectoryService = userDirectoryService;
    }

    public Map<String, Object> bulkUpload(MultipartFile file, AppUser currentUser) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        List<String> successList = new ArrayList<>();
        List<String> errorList = new ArrayList<>();

        try {
            List<ResourceDto> accessibleResources = currentUser.roles().contains(RoleType.SUPER_ADMIN)
                    ? resourceService.getAllResources()
                    : resourceService.getResourcesByDepartment(currentUser.departmentId());
            List<List<String>> rows = readSpreadsheetRows(file);
            int headerIndex = findHeaderRowIndex(rows, List.of("coursecode", "facultyname", "resourceid", "dayofweek", "starttime", "endtime"));
            if (headerIndex < 0) {
                throw new IllegalArgumentException("Could not find a valid timetable header row in the uploaded file.");
            }

            Map<String, Integer> headerMap = buildHeaderMap(rows.get(headerIndex));
            for (int rowIndex = headerIndex + 1; rowIndex < rows.size(); rowIndex++) {
                List<String> row = rows.get(rowIndex);
                if (isBlankRow(row)) {
                    continue;
                }

                try {
                    String course = firstNonBlank(
                            readCell(row, headerMap, "coursecode"),
                            readCell(row, headerMap, "course")
                    );
                    String academicLevel = firstNonBlank(
                            readCell(row, headerMap, "academiclevel"),
                            readCell(row, headerMap, "level")
                    ).toUpperCase(Locale.ROOT);
                    String sectionCode = firstNonBlank(
                            readCell(row, headerMap, "sectioncode"),
                            readCell(row, headerMap, "section")
                    ).toUpperCase(Locale.ROOT);
                    String faculty = firstNonBlank(
                            readCell(row, headerMap, "facultyname"),
                            readCell(row, headerMap, "faculty")
                    );
                    String resourceIdValue = firstNonBlank(
                            readCell(row, headerMap, "resourceid"),
                            readCell(row, headerMap, "classroomid"),
                            readCell(row, headerMap, "laboratoryid")
                    );
                    String resourceTypeValue = firstNonBlank(
                            readCell(row, headerMap, "resourcetype"),
                            readCell(row, headerMap, "resource")
                    );
                    String entryTypeValue = firstNonBlank(
                            readCell(row, headerMap, "entrytype"),
                            readCell(row, headerMap, "type")
                    );
                    String durationValue = firstNonBlank(readCell(row, headerMap, "duration"), "1");
                    String dayOfWeek = normalizeDayOfWeek(firstNonBlank(
                            readCell(row, headerMap, "dayofweek"),
                            readCell(row, headerMap, "day")
                    ));
                    String startTimeValue = firstNonBlank(
                            readCell(row, headerMap, "starttime"),
                            readCell(row, headerMap, "start")
                    );
                    String endTimeValue = firstNonBlank(
                            readCell(row, headerMap, "endtime"),
                            readCell(row, headerMap, "end")
                    );

                    if (isAnyBlank(course, academicLevel, sectionCode, faculty, resourceIdValue, dayOfWeek, startTimeValue, endTimeValue)) {
                        throw new IllegalArgumentException("Missing one or more required values");
                    }

                    ResourceDto resource = resolveResource(accessibleResources, resourceIdValue);
                    long resourceId = resource.id();
                    ensureDepartmentAccess(currentUser, resource.departmentId());

                    String resolvedResourceType = resourceTypeValue.isBlank()
                            ? resource.type().name()
                            : resourceTypeValue.trim().toUpperCase(Locale.ROOT);
                    if (!resolvedResourceType.equals(resource.type().name())) {
                        throw new IllegalArgumentException("Resource type does not match the selected resource ID");
                    }

                    String resolvedEntryType = entryTypeValue.isBlank()
                            ? (resource.type() == ResourceType.LAB ? TimetableEntryType.LAB.name() : TimetableEntryType.LECTURE.name())
                            : entryTypeValue.trim().toUpperCase(Locale.ROOT);

                    UpsertTimetableEntryRequest request = new UpsertTimetableEntryRequest(
                            course,
                            academicLevel,
                            sectionCode,
                            faculty,
                            resourceId,
                            resolvedResourceType,
                            TimetableEntryType.valueOf(resolvedEntryType),
                            Integer.parseInt(durationValue.trim()),
                            dayOfWeek,
                            parseTime(startTimeValue),
                            parseTime(endTimeValue)
                    );

                    TimetableEntryDto created = timetableService.createEntry(request);
                    successList.add(created.courseCode() + " / " + created.dayOfWeek() + " / " + created.startTime());
                } catch (Exception e) {
                    errorList.add("Row " + (rowIndex + 1) + ": " + e.getMessage());
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Bulk timetable upload failed: " + e.getMessage());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("successCount", successList.size());
        result.put("errors", errorList);
        return result;
    }

    public byte[] buildTemplate(AppUser currentUser) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            buildClassesSheet(workbook);
            buildReferenceSheet(workbook, currentUser);
            workbook.write(outputStream);
            return outputStream.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Could not build timetable template: " + e.getMessage(), e);
        }
    }

    private void buildClassesSheet(XSSFWorkbook workbook) {
        Sheet sheet = workbook.createSheet("Classes");
        sheet.createFreezePane(0, 1);

        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerFont.setColor(IndexedColors.WHITE.getIndex());
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        Row headerRow = sheet.createRow(0);
        for (int index = 0; index < TEMPLATE_HEADERS.size(); index++) {
            Cell cell = headerRow.createCell(index);
            cell.setCellValue(TEMPLATE_HEADERS.get(index));
            cell.setCellStyle(headerStyle);
            sheet.setColumnWidth(index, switch (index) {
                case 0, 3 -> 22 * 256;
                case 1, 2, 5, 6, 8 -> 18 * 256;
                case 4, 7 -> 14 * 256;
                default -> 16 * 256;
            });
        }

        for (int rowIndex = 1; rowIndex <= 25; rowIndex++) {
            sheet.createRow(rowIndex);
        }
    }

    private void buildReferenceSheet(XSSFWorkbook workbook, AppUser currentUser) {
        Sheet sheet = workbook.createSheet("Reference");
        int rowIndex = 0;

        rowIndex = writeReferenceBlock(sheet, rowIndex, "Allowed Academic Levels", List.of("FE", "SE", "TE", "BE"));
        rowIndex = writeReferenceBlock(sheet, rowIndex + 1, "Allowed Resource Types", List.of("CLASSROOM", "LAB"));
        rowIndex = writeReferenceBlock(sheet, rowIndex + 1, "Allowed Entry Types", List.of("LECTURE", "LAB"));
        rowIndex = writeReferenceBlock(sheet, rowIndex + 1, "Allowed Day Values", List.of("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"));

        Row noteHeader = sheet.createRow(rowIndex + 1);
        noteHeader.createCell(0).setCellValue("Notes");
        sheet.createRow(rowIndex + 2).createCell(0).setCellValue("Use exact Faculty Name values from the list below.");
        sheet.createRow(rowIndex + 3).createCell(0).setCellValue("Use Resource ID or exact Resource Name/room number from the resources list below.");
        sheet.createRow(rowIndex + 4).createCell(0).setCellValue("Time format should be HH:mm, for example 09:00 or 14:30.");

        int facultyStartRow = rowIndex + 6;
        Row facultyHeader = sheet.createRow(facultyStartRow);
        facultyHeader.createCell(0).setCellValue("Teaching Staff");
        Row facultyColumns = sheet.createRow(facultyStartRow + 1);
        facultyColumns.createCell(0).setCellValue("Faculty Name");
        facultyColumns.createCell(1).setCellValue("Email");
        facultyColumns.createCell(2).setCellValue("Department ID");
        facultyColumns.createCell(3).setCellValue("Roles");

        List<AppUser> teachingStaff = currentUser.roles().contains(RoleType.SUPER_ADMIN)
                ? userDirectoryService.listUsers().stream()
                .filter(user -> user.roles().contains(RoleType.FACULTY) || user.roles().contains(RoleType.COLLEGE_ADMIN))
                .toList()
                : userDirectoryService.listTeachingStaffByDepartment(currentUser.departmentId());

        int writeRow = facultyStartRow + 2;
        for (AppUser user : teachingStaff) {
            Row row = sheet.createRow(writeRow++);
            row.createCell(0).setCellValue(user.fullName());
            row.createCell(1).setCellValue(user.email());
            row.createCell(2).setCellValue(user.departmentId() == null ? "" : String.valueOf(user.departmentId()));
            row.createCell(3).setCellValue(user.roles().stream().map(RoleType::name).sorted().reduce((first, second) -> first + ", " + second).orElse(""));
        }

        int resourceStartRow = writeRow + 1;
        Row resourceHeader = sheet.createRow(resourceStartRow);
        resourceHeader.createCell(0).setCellValue("Resources");
        Row resourceColumns = sheet.createRow(resourceStartRow + 1);
        resourceColumns.createCell(0).setCellValue("Resource ID");
        resourceColumns.createCell(1).setCellValue("Resource Name");
        resourceColumns.createCell(2).setCellValue("Resource Type");
        resourceColumns.createCell(3).setCellValue("Department ID");
        resourceColumns.createCell(4).setCellValue("Building");

        List<ResourceDto> resources = currentUser.roles().contains(RoleType.SUPER_ADMIN)
                ? resourceService.getAllResources()
                : resourceService.getResourcesByDepartment(currentUser.departmentId());

        writeRow = resourceStartRow + 2;
        for (ResourceDto resource : resources) {
            Row row = sheet.createRow(writeRow++);
            row.createCell(0).setCellValue(resource.id());
            row.createCell(1).setCellValue(resource.name());
            row.createCell(2).setCellValue(resource.type().name());
            row.createCell(3).setCellValue(resource.departmentId() == null ? "" : String.valueOf(resource.departmentId()));
            row.createCell(4).setCellValue(resource.building() == null ? "" : resource.building());
        }

        for (int index = 0; index < 5; index++) {
            sheet.autoSizeColumn(index);
            sheet.setColumnWidth(index, Math.max(sheet.getColumnWidth(index), 18 * 256));
        }
    }

    private int writeReferenceBlock(Sheet sheet, int startRow, String title, List<String> values) {
        Row titleRow = sheet.createRow(startRow);
        titleRow.createCell(0).setCellValue(title);
        for (int index = 0; index < values.size(); index++) {
            Row row = sheet.createRow(startRow + index + 1);
            row.createCell(0).setCellValue(values.get(index));
        }
        return startRow + values.size() + 1;
    }

    private void ensureDepartmentAccess(AppUser user, Long departmentId) {
        if (user == null || user.roles().contains(RoleType.SUPER_ADMIN)) {
            return;
        }
        if (!Objects.equals(user.departmentId(), departmentId)) {
            throw new IllegalArgumentException("Access restricted to your own department");
        }
    }

    private ResourceDto resolveResource(List<ResourceDto> accessibleResources, String resourceReference) {
        String normalizedReference = resourceReference == null ? "" : resourceReference.trim();
        if (normalizedReference.isBlank()) {
            throw new IllegalArgumentException("Resource is required");
        }

        if (normalizedReference.chars().allMatch(Character::isDigit)) {
            try {
                long resourceId = Long.parseLong(normalizedReference);
                for (ResourceDto resource : accessibleResources) {
                    if (resource.id() == resourceId) {
                        return resource;
                    }
                }
            } catch (NumberFormatException ignored) {
                // Fall back to matching by resource name.
            }
        }

        return accessibleResources.stream()
                .filter(resource -> resource.name().equalsIgnoreCase(normalizedReference))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Selected resource was not found in the accessible resource list"));
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
                if (!isBlankRow(cells)) {
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

    private long parseLong(String value, String fieldName) {
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Invalid " + fieldName + " value");
        }
    }

    private LocalTime parseTime(String value) {
        List<DateTimeFormatter> formatters = List.of(
                DateTimeFormatter.ofPattern("H:mm"),
                DateTimeFormatter.ofPattern("HH:mm"),
                DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH),
                DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH)
        );

        for (DateTimeFormatter formatter : formatters) {
            try {
                return LocalTime.parse(value.trim().toUpperCase(Locale.ENGLISH), formatter);
            } catch (DateTimeParseException ignored) {
                // Try next format.
            }
        }

        throw new IllegalArgumentException("Invalid time value '" + value + "'. Use HH:mm format like 09:00");
    }

    private String normalizeDayOfWeek(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        Map<String, String> aliases = Map.ofEntries(
                Map.entry("MON", "MONDAY"),
                Map.entry("MONDAY", "MONDAY"),
                Map.entry("TUE", "TUESDAY"),
                Map.entry("TUES", "TUESDAY"),
                Map.entry("TUESDAY", "TUESDAY"),
                Map.entry("WED", "WEDNESDAY"),
                Map.entry("WEDNESDAY", "WEDNESDAY"),
                Map.entry("THU", "THURSDAY"),
                Map.entry("THUR", "THURSDAY"),
                Map.entry("THURSDAY", "THURSDAY"),
                Map.entry("FRI", "FRIDAY"),
                Map.entry("FRIDAY", "FRIDAY"),
                Map.entry("SAT", "SATURDAY"),
                Map.entry("SATURDAY", "SATURDAY")
        );

        String resolved = aliases.get(normalized);
        if (resolved == null) {
            throw new IllegalArgumentException("Invalid day value '" + value + "'");
        }
        return resolved;
    }
}
