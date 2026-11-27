import {
  getDailyReport,
  getMonthToDateReport,
  getMonthlyReport,
} from '../services/reportsService.js';
import { formatMonthYear, formatReportRange } from './dates.js';

export function fetchReportForPeriod(period, date, options) {
  if (period === 'month-to-date') {
    return getMonthToDateReport(date, options);
  }
  if (period === 'monthly') {
    return getMonthlyReport(date, options);
  }
  return getDailyReport(date, options);
}

export function describeReportPeriod(period, report) {
  if (!report) {
    return { title: 'Report range', rangeText: '—' };
  }

  const rangeText = formatReportRange(report.startDate, report.endDate);

  if (period === 'monthly') {
    const monthName = formatMonthYear(report.startDate);
    return {
      title: monthName ? `Previous calendar month (${monthName})` : 'Previous calendar month',
      rangeText,
    };
  }

  if (period === 'month-to-date') {
    return {
      title: 'Month-to-date range',
      rangeText,
    };
  }

  return {
    title: 'Selected date',
    rangeText,
  };
}
