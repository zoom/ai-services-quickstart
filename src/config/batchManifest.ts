// Shared by the playground and server so invalid manifests never reach the API.
export function batchManifestError(entries: readonly string[]): string | null {
    if (entries.length < 1 || entries.length > 1000) return 'Enter between 1 and 1,000 manifest URIs (excluding comments and empty lines).'
    const sources = new Set<string>()
    for (const entry of entries) {
        try {
            const url = new URL(entry)
            if (!url.hostname || !/^(s3|https):\/\//i.test(entry)) return 'Manifest entries must be valid s3:// URIs or https:// URLs.'
            sources.add(url.protocol)
        } catch {
            return 'Manifest entries must be valid s3:// URIs or https:// URLs.'
        }
    }
    return sources.size > 1 ? 'Use either all S3 URIs or all HTTPS URLs in a manifest. Submit separate jobs for each source type.' : null
}
