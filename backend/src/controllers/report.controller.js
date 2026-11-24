import { Report } from '../models/index.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendResponse } from '../utils/apiResponse.js';
import { notifyAdminsReportSubmitted } from '../services/notification.service.js';

export const submitReport = catchAsync(async (req, res) => {
  const report = await Report.create({
    reporter: req.user._id,
    ...req.body,
    reportHistory: [{ action: 'created', admin: null, details: {}, createdAt: new Date() }],
  });

  // Real admin action item: every submitted report needs review. Non-critical —
  // if the fan-out fails the report itself is still saved.
  notifyAdminsReportSubmitted({ report, reporter: req.user }).catch(() => {});

  sendResponse(res, 201, 'Report submitted. Our team will review it.', report);
});
