// Test-only stand-in: the app never uses Supabase analytics buckets.
export class IcebergRestCatalog { constructor() { throw new Error("analytics buckets are not available in this test build"); } }
export class IcebergError extends Error {}
