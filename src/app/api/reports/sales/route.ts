// The Sales Report is split into focused endpoints:
//   /summary          day / range summary (end-of-day report)
//   /by-day           one row per business day
//   /by-salesperson   per cashier / online store
//   /receipts         every sale, paged (+ /receipts/[id] for one receipt)
//   /by-payment       takings per payment method + day × method matrix
//   /by-product       per product or per colour/size option
//   /by-category      per category, with sub-category roll-up
//   /meta             filter options
// GET /api/reports/sales itself returns the summary.
export { GET } from "./summary/route";
