import type { Plugin } from "esbuild";

/** Route fixtures must not initialise mail providers or send actual messages.
 * Delivery, assets, dedupe and private storage have their own email tests. */
export function emailEventsStubPlugin(captureModule?: string): Plugin {
  return {
    name: "isolated-email-events",
    setup(build) {
      build.onResolve({ filter: /\/email\/(?:account-events|application-events|campaign-events|donation-events|payout-events)\.(?:js|ts)$/ },
        args => ({ path: args.path, namespace: "test-email-events" }));
      build.onLoad({ filter: /.*/, namespace: "test-email-events" }, () => ({
        loader: "js",
        contents: `${captureModule ? `import {state} from ${JSON.stringify(captureModule)};` : "const state={};"}
          const capture=(name,args)=>{
            if(name==="donation" && state.failEmailJournal)throw Error("Fixture email journal unavailable");
            const events=state.emailEvents??=[];
            if(!events.some(e=>e.name===name && JSON.stringify(e.args)===JSON.stringify(args)))events.push({name,args});
            const source=(state.documents??state.docs)?.get("donations/"+args[0]);
            if(name==="donation" && source)source.emailDonationPending=false;
          };
          export const welcomeEmailEvent=async(...args)=>capture("welcome",args);
          export const applicationEmails=async(...args)=>capture("application",args);
          export const campaignEmailEvent=async(...args)=>capture("campaign",args);
          export const donationEmailEvent=async(...args)=>capture("donation",args);
          export const payoutEmailEvent=async(...args)=>capture("payout",args);
          export const stripePayoutEmailEvent=async(...args)=>capture("stripe-payout",args);`,
      }));
    },
  };
}
