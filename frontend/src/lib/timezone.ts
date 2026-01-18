import { format, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

// South African Standard Time (SAST) - GMT+2
export const TIMEZONE = "Africa/Johannesburg";
export const TIMEZONE_ABBR = "SAST";
export const TIMEZONE_OFFSET = "+02:00";

/**
 * Format a date in South African timezone
 */
export const formatSAST = (date: Date | string, formatString: string): string => {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return formatInTimeZone(dateObj, TIMEZONE, formatString);
};

/**
 * Get current time in South African timezone
 */
export const nowSAST = (): Date => {
  return toZonedTime(new Date(), TIMEZONE);
};

/**
 * Convert a local date to South African timezone
 */
export const toSAST = (date: Date): Date => {
  return toZonedTime(date, TIMEZONE);
};

/**
 * Convert a South African time to UTC for storage
 */
export const fromSAST = (date: Date): Date => {
  return fromZonedTime(date, TIMEZONE);
};

/**
 * Format time with SAST indicator
 */
export const formatTimeSAST = (date: Date | string): string => {
  return formatSAST(date, "h:mm a") + " SAST";
};

/**
 * Format date and time with SAST indicator
 */
export const formatDateTimeSAST = (date: Date | string): string => {
  return formatSAST(date, "MMM d, yyyy 'at' h:mm a") + " SAST";
};

/**
 * Format just the date in SAST
 */
export const formatDateSAST = (date: Date | string): string => {
  return formatSAST(date, "MMM d, yyyy");
};

/**
 * Format full date with day name in SAST
 */
export const formatFullDateSAST = (date: Date | string): string => {
  return formatSAST(date, "EEEE, MMMM d, yyyy");
};

/**
 * Check if a date/time has passed in South African time
 */
export const isPassedSAST = (date: Date | string): boolean => {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  const nowInSAST = nowSAST();
  const dateInSAST = toSAST(dateObj);
  return dateInSAST < nowInSAST;
};

/**
 * Get today's date in SAST (start of day)
 */
export const todaySAST = (): Date => {
  const now = nowSAST();
  now.setHours(0, 0, 0, 0);
  return now;
};
