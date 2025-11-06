const ALLOWED_SHEET_NAME_REGEX = /^[a-zA-Z0-9-_ ]+$/;

/**
 * Validates if the sheet name matches allowed regex.
 * @param name The sheet name to validate
 * @returns True if valid, false otherwise
 */
export function validateSheetName(name: string) {
    return ALLOWED_SHEET_NAME_REGEX.test(name);
}
