import { useEffect } from "react";
import { useSearch, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";

export default function DonateSuccessPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const sessionId = params.get("session_id") ?? "";

  const confirmQ = useQuery({
    queryKey: ["donation-confirm", sessionId],
    queryFn: () => api.confirmDonation(sessionId),
    enabled: !!sessionId,
    retry: 2,
  });

  const donation = confirmQ.data;

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="text-center space-y-6">

        {/* Icon */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mx-auto"
          style={{ backgroundColor: "rgba(245,192,0,0.15)", border: "2px solid #F5C000" }}
        >
          {confirmQ.isLoading ? (
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckCircle className="w-12 h-12" style={{ color: "#CC0000" }} />
          )}
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">Thank you!</h1>
          {donation ? (
            <>
              <p className="text-muted-foreground text-base">
                Your donation of{" "}
                <strong className="text-foreground text-lg">
                  £{donation.amountGbp.toFixed(2)}
                </strong>{" "}
                to{" "}
                <strong className="text-foreground">{donation.orgName}</strong>{" "}
                was successful.
              </p>
              <p
                className="text-sm font-semibold mt-4 tracking-wide uppercase"
                style={{ color: "#CC0000" }}
              >
                Your support goes straight to the source.
              </p>
            </>
          ) : confirmQ.isError ? (
            <p className="text-muted-foreground">
              Your payment was received. If you have questions, contact us.
            </p>
          ) : (
            <p className="text-muted-foreground">Confirming your donation…</p>
          )}
        </div>

        {/* Platform fee note */}
        {donation && (
          <div
            className="rounded-xl px-5 py-4 text-sm text-center"
            style={{ backgroundColor: "rgba(245,192,0,0.1)" }}
          >
            <Heart className="w-4 h-4 inline mr-1.5" style={{ color: "#CC0000" }} />
            <span className="text-muted-foreground">
              £{(donation.amountGbp * 0.95).toFixed(2)} goes directly to the organisation · 5% platform fee keeps Root ProjX running
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center pt-2">
          {donation?.orgId ? (
            <Link href={`/organisations/${donation.orgId}`}>
              <Button variant="outline">Back to Organisation</Button>
            </Link>
          ) : null}
          <Link href="/feed">
            <Button
              className="font-bold text-black"
              style={{ backgroundColor: "#F5C000" }}
            >
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
