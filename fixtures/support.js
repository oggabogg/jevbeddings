// Authored synthetic examples and provisional binary labels, NOT JEV predictions.
// Have domain reviewers independently label real held-out data before quality claims.
const examples = [
  ['ticket_01', 'Two charges, work blocked', 'We are an existing enterprise customer. Our subscription was charged twice this morning. This is unacceptable. Our finance team is blocked and needs an answer today. Please refund the extra charge.', ['is_customer','enterprise','about_billing','duplicate_charge','refund_request','urgent','needs_reply','is_complaint']],
  ['ticket_02', 'Duplicate monthly payment', 'I pay for the standard plan. My monthly subscription was charged twice. Please check and return the extra payment whenever convenient.', ['is_customer','about_billing','duplicate_charge','refund_request','needs_reply']],
  ['ticket_03', 'Latest product newsletter', 'Your weekly product newsletter: new billing dashboards, faster payments, enterprise features, and a limited-time upgrade offer. Sent to all subscribers.', ['is_newsletter','is_marketing','about_billing']],
  ['ticket_04', 'Enterprise login outage', 'We are a contracted enterprise account. No employee can log in and production work is stopped. The login page crashes. Please fix this immediately.', ['is_customer','enterprise','about_account_access','is_bug','urgent','needs_reply']],
  ['ticket_05', 'Account recovery', 'I am on your paid starter plan and forgot my password. Could you help me get back into my account? There is no rush.', ['is_customer','about_account_access','needs_reply']],
  ['ticket_06', 'Cancellation over invoices', 'We are an existing enterprise customer. These incorrect invoices are unacceptable. Unless you correct them before renewal tomorrow, we will cancel our contract. Please respond.', ['is_customer','enterprise','about_billing','churn_risk','is_complaint','urgent','needs_reply']],
  ['ticket_07', 'Resolved, thank you', 'Thanks for resolving my support request. Our paid subscription works perfectly again. No further action needed.', ['is_customer','is_praise']],
  ['ticket_08', 'CSV export request', 'As a paying user, I would like CSV export for the reports page. Could you consider adding it? This is optional for us.', ['is_customer','is_feature_request','needs_reply']],
  ['ticket_09', 'Export crashes', 'I subscribe to the pro plan. Clicking Export raises a 500 error instead of downloading the file. Can you investigate? I can use the other format in the meantime.', ['is_customer','is_bug','needs_reply']],
  ['ticket_10', 'Security incident', 'We are a contracted enterprise customer. An unauthorized user downloaded our private records today. We need immediate incident response and confirmation that access has been revoked.', ['is_customer','enterprise','security_issue','urgent','needs_reply']],
  ['ticket_11', 'Privacy request', 'I am a paying subscriber. Under applicable data protection law I request a copy of the personal information you hold about me. Please confirm receipt.', ['is_customer','legal_issue','needs_reply']],
  ['ticket_12', 'Internal rollout notes', 'Internal engineering memo for our employees: next month we should add dark mode to the dashboard. Please discuss the proposal at our planning meeting.', ['is_internal','is_feature_request','needs_reply']],
  ['ticket_13', 'Sales promotion', 'Upgrade now: save 20 percent on your new subscription. This promotional offer is for prospective customers. No reply needed.', ['is_marketing']],
  ['ticket_14', 'Enterprise invoice question', 'We are an existing enterprise account. Could you explain the line items on our latest invoice? Nothing is blocked and there is no deadline.', ['is_customer','enterprise','about_billing','needs_reply']],
  ['ticket_15', 'Subscription refund', 'I am a paid subscriber and would like a refund for this month. The product did not meet my expectations and I am unhappy. Please process the refund.', ['is_customer','about_billing','refund_request','is_complaint','needs_reply']],
  ['ticket_16', 'Internal vulnerability review', 'For our internal security team: the staging app exposes access tokens in logs. This is a vulnerability. Please remove the tokens before tomorrow morning.', ['is_internal','security_issue','is_bug','urgent','needs_reply']],
  ['ticket_17', 'Legal demand', 'We represent an existing enterprise client. This letter demands that you preserve all account records relevant to pending litigation. Please acknowledge receipt today.', ['is_customer','enterprise','legal_issue','urgent','needs_reply']],
  ['ticket_18', 'Thinking of leaving', 'I am a paying customer. The support experience has been terrible. I plan to switch to a competitor at the end of this subscription. What can you do?', ['is_customer','churn_risk','is_complaint','needs_reply']],
  ['ticket_19', 'Praise from enterprise team', 'Our enterprise contract has been active for two years. We love the improved dashboard. This is just a thank-you note, no response required.', ['is_customer','enterprise','is_praise']],
  ['ticket_20', 'Customer community digest', 'Monthly newsletter to all subscribers: highlights from the community and recent events. This issue contains no product offers. No response is needed.', ['is_newsletter']],
  ['ticket_21', 'Internal legal policy', 'Internal memo to staff: our new retention policy must comply with the legal recordkeeping obligations. Please review the policy document.', ['is_internal','legal_issue','needs_reply']],
  ['ticket_22', 'Billing failure today', 'We are on a paid enterprise contract. Your billing system shows a payment failure even though our bank confirmed settlement. This is unacceptable and access will stop tonight. Please resolve today.', ['is_customer','enterprise','about_billing','is_complaint','urgent','needs_reply']],
  ['ticket_23', 'A quiet reference note', 'The office plant was watered on Tuesday. This note is for the public visitor noticeboard. No action is requested.', []],
  ['ticket_24', 'Account permissions bug', 'We have an existing enterprise contract. Newly added users cannot access their assigned workspace because the permissions screen throws an error. Please investigate; current users are unaffected.', ['is_customer','enterprise','about_account_access','is_bug','needs_reply']],
  ['ticket_25', 'Refund completed', 'Your previously requested refund has been processed for your paid subscription. This is an automated billing receipt. No reply is needed.', ['is_customer','about_billing']],
  ['ticket_26', 'Legitimate two orders', 'I am a paid customer. I bought two separate add-ons and received two correct charges. Both invoices are paid. This message simply confirms completion; no reply required.', ['is_customer','about_billing']],
  ['ticket_27', 'Internal finance check', 'Internal finance request: please reconcile the vendor invoice with our company bank payment next week.', ['is_internal','about_billing','needs_reply']],
  ['ticket_28', 'Feature praise', 'I am on the paid plan. The new keyboard shortcuts are excellent, thank you! No need to reply.', ['is_customer','is_praise']],
  ['ticket_29', 'Urgent duplicate payment', 'We are an existing enterprise customer and were charged twice for one invoice. The duplicate payment blocks payroll today. Please return it and respond immediately.', ['is_customer','enterprise','about_billing','duplicate_charge','refund_request','urgent','needs_reply']],
  ['ticket_30', 'Security marketing digest', 'Weekly sponsored security newsletter for all subscribers: buy our threat monitoring product and read about industry incidents. This is an advertisement, not an incident report.', ['is_newsletter','is_marketing']],
];
export const documents = examples.map(([id, title, body, positive]) => ({ id, source: 'synthetic_support_v1', title, body, positive }));
export const benchmarkQueries = [
  { id: 'duplicates', query: 'customers accidentally charged twice', requirements: { weights: { is_customer: 1, duplicate_charge: 1 }, filters: [] }, relevant: { ticket_01: 3, ticket_02: 3, ticket_29: 3 } },
  { id: 'enterprise_billing', query: 'urgent billing complaints from enterprise customers', requirements: { weights: { urgent: 1, about_billing: 1, is_complaint: 1, enterprise: 1, is_customer: 1 }, filters: [] }, relevant: { ticket_01: 3, ticket_06: 3, ticket_22: 3, ticket_29: 2, ticket_14: 1 } },
  { id: 'no_newsletters', query: 'billing emails from customers, exclude newsletters', requirements: { weights: { about_billing: 1, is_customer: 1 }, filters: [{ feature: 'is_newsletter', operator: '<=', value: 0.2 }] }, relevant: { ticket_01: 2, ticket_02: 2, ticket_06: 2, ticket_14: 2, ticket_15: 2, ticket_22: 2, ticket_25: 2, ticket_26: 2, ticket_29: 2 } },
  { id: 'refunds', query: 'refund requests, prefer to avoid complaints', requirements: { weights: { refund_request: 1, is_complaint: -0.5 }, filters: [] }, relevant: { ticket_02: 3, ticket_29: 3, ticket_01: 1, ticket_15: 1 } },
  { id: 'security', query: 'urgent security issues, exclude internal messages', requirements: { weights: { urgent: 1, security_issue: 1 }, filters: [{ feature: 'is_internal', operator: '<=', value: 0.2 }] }, relevant: { ticket_10: 3 } },
  { id: 'access_bugs', query: 'account access bugs from enterprise customers', requirements: { weights: { about_account_access: 1, is_bug: 1, enterprise: 1, is_customer: 1 }, filters: [] }, relevant: { ticket_04: 3, ticket_24: 3, ticket_05: 1 } },
  { id: 'churn', query: 'customers at risk of cancellation', requirements: { weights: { is_customer: 1, churn_risk: 1 }, filters: [] }, relevant: { ticket_06: 3, ticket_18: 3 } },
  { id: 'praise', query: 'praise from customers without messages needing a reply', requirements: { weights: { is_customer: 1, is_praise: 1 }, filters: [{ feature: 'needs_reply', operator: '<=', value: 0.2 }] }, relevant: { ticket_07: 3, ticket_19: 3, ticket_28: 3 } },
];

export function seedFixtures(store) {
  for (const { positive, ...document } of documents) {
    store.createDocument(document);
    store.saveFeatures(document.id, Object.fromEntries(store.schema().features.map(f => [f.id, positive.includes(f.id) ? 1 : 0])),
      store.schema(), { model: null }, 'manual_fixture');
  }
}
