/**
 * Hardcoded sample customer requests for demo and testing.
 * These cover the five main triage categories the pipeline handles.
 */

import { IngestRequest } from "../types";

export const sampleRequests: IngestRequest[] = [
  {
    source: "Email",
    message:
      "Hi, I tried logging in this morning and keep getting a 403 error. My account is arcvault.io/user/jsmith. This started after your update last Tuesday.",
  },
  {
    source: "Web Form",
    message:
      "We'd love to see a bulk export feature for our audit logs. We're a compliance-heavy org and this would save us hours every month.",
  },
  {
    source: "Support Portal",
    message:
      "Invoice #8821 shows a charge of $1,240 but our contract rate is $980/month. Can someone look into this?",
  },
  {
    source: "Email",
    message:
      "I'm not sure if this is the right place to ask, but is there a way to set up SSO with Okta? We're evaluating switching our auth provider.",
  },
  {
    source: "Web Form",
    message:
      "Your dashboard stopped loading for us around 2pm EST. Checked our end — it's definitely on yours. Multiple users affected.",
  },
];
