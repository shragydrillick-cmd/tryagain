// Pick & Sort's server code on Firebase.
//
// billingCap: the spending cut-off. The $5 budget in Google Cloud sends a message to the "billing-cap" topic whenever
// its spending figure updates. When the spending has reached the budget, this removes the card from the project:
// Firebase drops back to the free plan (the free parts keep working; server code like the Shopify connection pauses)
// and nothing more can be charged until the card is put back by hand. Google's figures can run a few hours behind.
const { setGlobalOptions } = require("firebase-functions/v2");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { CloudBillingClient } = require("@google-cloud/billing");

setGlobalOptions({ region: "us-central1", maxInstances: 2 }); // never many copies running at once
const PROJECT = process.env.GCLOUD_PROJECT || "pick-and-sort";

exports.billingCap = onMessagePublished({ topic: "billing-cap", maxInstances: 1 }, async event => {
  let data = null;
  try { data = event.data.message.json; } catch (e) {}
  if (!data || data.costAmount == null || data.budgetAmount == null) { console.log("Budget message without amounts, ignored."); return; }
  console.log(`Spending ${data.costAmount} ${data.currencyCode || ""} of a ${data.budgetAmount} budget.`);
  if (data.costAmount < data.budgetAmount) return;
  const billing = new CloudBillingClient(), name = `projects/${PROJECT}`;
  const [info] = await billing.getProjectBillingInfo({ name });
  if (!info.billingEnabled) { console.log("Billing is already off."); return; }
  await billing.updateProjectBillingInfo({ name, projectBillingInfo: { billingAccountName: "" } });
  console.log("The budget was reached: billing is now OFF for the project. Put the card back in Firebase to turn it on again.");
});
