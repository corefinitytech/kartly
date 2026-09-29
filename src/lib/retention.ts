export const RETENTION = {
  unverifiedAccountsDays: 7,
  sessionDays: 30,
  guestAndAbandonedCartsDays: 30,
  tokens: "deleted on use or expiry",
  searchHistoryDays: 90,
  notificationsDays: 90,
  emailOutboxDays: 90,
  dsarExportFilesHours: 24,
  dsarRequestRecordsYears: 3,
  auditLogMonths: 12,
  consentProofYearsAfterAccountDeletion: 3,
  anonymizedOrderRecordsYears: 7,
} as const;

export type RetentionKey = keyof typeof RETENTION;
