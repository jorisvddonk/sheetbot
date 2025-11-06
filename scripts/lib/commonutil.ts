export function checkError(res) {
    if (!res || !res.status) {
        throw new Error("Invalid response object");
    }
    if (res.status.toString()[0] !== '2') {
        throw new Error("Request response not OK: " + res.status);
    }
    return res;
}
