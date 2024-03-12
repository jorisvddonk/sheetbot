const ALLOWED_SHEET_NAME_REGEX = /^[a-zA-Z0-9-_ ]+$/;

export function validateSheetName(name: string) {
    return ALLOWED_SHEET_NAME_REGEX.test(name);
}
