import { fr } from "@/i18n/fr";

/**
 * Turns a storage failure (quota exhausted, blocked schema upgrade, closed or
 * unavailable database) into a message the user can act on. Errors we wrote
 * ourselves (plain Error with a French message) are passed through.
 */
export function describeDbError(error: unknown): string {
  const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  const inner = typeof error === "object" && error !== null && "inner" in error ? (error as { inner?: unknown }).inner : null;
  if (inner && describeDbError(inner) !== fr.errors.generic) return describeDbError(inner);

  switch (name) {
    case "QuotaExceededError":
    case "DatabaseFullError":
      return fr.errors.storageFull;
    case "VersionError":
    case "UpgradeError":
    case "SchemaError":
      return fr.errors.storageUpgrade;
    case "OpenFailedError":
    case "DatabaseClosedError":
    case "MissingAPIError":
    case "SecurityError":
    case "InvalidStateError":
      return fr.errors.storageUnavailable;
  }
  if (error instanceof Error && name === "Error" && error.message) return error.message;
  return fr.errors.generic;
}
