const fs = require('fs');

const path = 'artifacts/web/src/pages/dashboard.tsx';
let code = fs.readFileSync(path, 'utf8');

const returnStart = code.indexOf('  return (\n    <div className="max-w-4xl');
const returnEnd = code.lastIndexOf('  );\n}');

if (returnStart === -1 || returnEnd === -1) {
  console.error("Could not find bounds");
  process.exit(1);
}

const newReturn = `  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Hero */}
      <div className="bg-primary rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-extrabold flex-shrink-0 shadow-sm border-2 border-white/20">
            {(org?.name ?? user?.name ?? "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "??"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">{org?.name ?? user?.name ?? "Your Organisation"}</h1>
              {org?.verified && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-accent border border-accent/30 px-2 py-0.5 rounded-full bg-accent/10 shadow-sm">
                  <CheckCircle className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            {org && (
              <p className="text-white/80 text-sm font-medium">
                {[org.city, org.country].filter(Boolean).join(", ")} &middot; {org.category}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-6 bg-white/10 rounded-xl p-4 border border-white/10 shadow-sm">
          {[
            { label: "Followers",  value: org?.followerCount ?? 0 },
            { label: "Updates",    value: updates.length },
            { label: "Campaigns",  value: campaigns.length },
            { label: "Raised",     value: \`£\${(org?.totalRaised ?? 0).toLocaleString()}\` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-lg font-extrabold text-white">{value}</div>
              <div className="text-xs text-white/70 mt-0.5 font-medium">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-secondary rounded-lg">
          <TabsTrigger value="profile" className="rounded-md font-bold text-sm">Profile & Settings</TabsTrigger>
          <TabsTrigger value="campaigns" className="rounded-md font-bold text-sm">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-2">
          
          <ProfileImagesCard
            org={org}
            orgId={orgId}
            token={token!}
            onUpdated={() => queryClient.invalidateQueries({ queryKey: ["org", orgId] })}
          />

          <div className="grid md:grid-cols-2 gap-6">
            {/* Stripe Connect */}
            <Card className="border-border shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-primary" /> Payouts via Stripe
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col">
                {connectQ.isLoading ? (
                  <div className="h-8 bg-secondary rounded animate-pulse" />
                ) : connectQ.data?.payouts_enabled ? (
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-sm font-semibold text-green-700">Payouts enabled</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-auto">
                      <div className="bg-secondary rounded-xl p-4 text-center border border-border/50">
                        <div className="text-xl font-extrabold text-foreground">£{(org?.totalRaised ?? 0).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Total donations</div>
                      </div>
                      <div className="bg-secondary rounded-xl p-4 text-center border border-border/50">
                        <div className="text-xl font-extrabold text-foreground">—</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Pending payout</div>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full gap-2 mt-4 font-semibold" onClick={async () => {
                      try {
                        const { url } = await api.getConnectDashboardLink(token!);
                        window.open(url, "_blank", "noopener,noreferrer");
                      } catch { alert("Could not open Stripe dashboard. Please try again."); }
                    }}>
                      <ExternalLink className="w-4 h-4" /> View Stripe dashboard
                    </Button>
                  </div>
                ) : connectQ.data?.stripe_account_id ? (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      Finish setting up your Stripe account to receive donations.
                    </div>
                    <Button className="w-full font-bold text-white bg-primary hover:bg-primary/90 mt-4" onClick={(e) => { window.open('/api/stripe/connect/onboard', '_blank', 'noopener,noreferrer'); e.preventDefault(); }}>
                      Complete bank setup
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Connect your bank account so donors can send money directly to your organisation. Root ProjX takes a 5% platform fee automatically.
                    </p>
                    <Button className="w-full font-bold text-white bg-primary hover:bg-primary/90 mt-4" onClick={(e) => { window.open('/api/stripe/connect/onboard', '_blank', 'noopener,noreferrer'); e.preventDefault(); }}>
                      Connect your bank account
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Wise Connect */}
            <Card className="border-border shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-primary" /> Payouts via Wise
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col">
                {wiseQ.isLoading ? (
                  <div className="h-8 bg-secondary rounded animate-pulse" />
                ) : wiseQ.data?.wise_email ? (
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-sm font-semibold text-green-700">
                        {wiseQ.data.wise_verified ? "Connected & verified" : "Saved (pending verification)"}
                      </span>
                    </div>
                    <div className="bg-secondary rounded-xl px-4 py-3 border border-border/50 mb-auto">
                      <p className="text-xs text-muted-foreground mb-0.5">Wise account email</p>
                      <p className="text-sm font-semibold text-foreground truncate">{wiseQ.data.wise_email}</p>
                    </div>
                    {wiseError && (
                      <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mt-3">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {wiseError}
                      </div>
                    )}
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 font-semibold"
                        onClick={() => {
                          setWiseEmailInput(wiseQ.data?.wise_email ?? "");
                          wiseDisconnectMut.mutate();
                        }}
                        disabled={wiseDisconnectMut.isPending}
                      >
                        {wiseDisconnectMut.isPending ? "Disconnecting…" : "Disconnect"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 font-semibold"
                        onClick={() => {
                          setWiseEmailInput(wiseQ.data?.wise_email ?? "");
                          wiseDisconnectMut.reset();
                          wiseConnectMut.reset();
                          setWiseError("");
                        }}
                      >
                        Change email
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Connect your Wise account so Root ProjX can send your funds internationally.
                    </p>
                    
                    {!showWiseInput ? (
                      <div className="flex flex-col gap-2 mt-4">
                        <Button
                          className="w-full font-bold text-white bg-primary hover:bg-primary/90"
                          onClick={() => window.open('https://wise.com/register', '_blank', 'noopener,noreferrer')}
                        >
                          Sign up for Wise
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full font-bold"
                          onClick={() => setShowWiseInput(true)}
                        >
                          I have a Wise account
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-2 mt-2">
                        <div className="space-y-2">
                          <Label htmlFor="wise-email" className="text-sm font-semibold">Wise email</Label>
                          <Input
                            id="wise-email"
                            type="email"
                            placeholder="yourname@example.com"
                            value={wiseEmailInput}
                            onChange={(e) => {
                              setWiseEmailInput(e.target.value);
                              setWiseError("");
                            }}
                            disabled={wiseConnectMut.isPending}
                          />
                        </div>
                        {wiseError && (
                          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {wiseError}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                              className="flex-1 font-bold text-white bg-primary hover:bg-primary/90"
                              disabled={!wiseEmailInput.trim() || wiseConnectMut.isPending}
                              onClick={() => wiseConnectMut.mutate(wiseEmailInput.trim())}
                            >
                              {wiseConnectMut.isPending ? "Connecting…" : "Connect"}
                          </Button>
                          <Button variant="ghost" className="font-semibold" onClick={() => setShowWiseInput(false)} disabled={wiseConnectMut.isPending}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <details className="group border border-border shadow-sm rounded-xl bg-card overflow-hidden">
            <summary className="flex items-center justify-between p-4 cursor-pointer font-semibold text-base hover:bg-secondary/30 transition-colors">
              <span className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Funds usage breakdown (optional)</span>
              <span className="text-muted-foreground group-open:rotate-180 transition-transform"><ChevronDown className="w-4 h-4" /></span>
            </summary>
            <div className="p-4 pt-0 border-t border-border mt-1">
              <div className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  Show supporters how you allocate funds. Percentages must add up to 100.
                  This is self-reported and displayed on your public profile.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      { key: "operations", label: "Operations" },
                      { key: "materials",  label: "Materials & Supplies" },
                      { key: "staff",      label: "Staff & Volunteers" },
                      { key: "events",     label: "Community Events" },
                      { key: "other",      label: "Other" },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={fundsUsageInput[key]}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                            setFundsUsageInput((prev) => ({ ...prev, [key]: val }));
                            setFundsUsageError("");
                            setFundsUsageSaved(false);
                          }}
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 flex-wrap pt-2">
                  {(() => {
                    const total = Object.values(fundsUsageInput).reduce((s, v) => s + v, 0);
                    const ok = total === 100;
                    return (
                      <div
                        className={\`flex items-center px-3 py-1.5 rounded-lg border \${
                          ok ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
                        }\`}
                      >
                        <span className={\`text-xs font-bold \${ok ? "text-green-700" : "text-amber-700"}\`}>
                          Total: {total}% {ok ? "✓" : total < 100 ? \`(\${100 - total}% remaining)\` : \`(over by \${total - 100}%)\`}
                        </span>
                      </div>
                    );
                  })()}
                  
                  {fundsUsageError && (
                    <div className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-2 py-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {fundsUsageError}
                    </div>
                  )}

                  {fundsUsageSaved && (
                    <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> Saved.
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button
                    className="font-bold text-white bg-primary hover:bg-primary/90"
                    disabled={
                      fundsUsageSaving ||
                      Object.values(fundsUsageInput).reduce((s, v) => s + v, 0) !== 100
                    }
                    onClick={saveFundsUsage}
                  >
                    {fundsUsageSaving ? "Saving…" : "Save breakdown"}
                  </Button>
                  {org?.fundsUsage && (
                    <Button
                      variant="outline"
                      className="font-semibold"
                      disabled={fundsUsageSaving}
                      onClick={async () => {
                        await api.updateOrganisation(orgId, { fundsUsage: null } as Partial<api.Org>, token!);
                        setFundsUsageInput({ operations: 0, materials: 0, staff: 0, events: 0, other: 0 });
                        queryClient.invalidateQueries({ queryKey: ["org", orgId] });
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </details>

          {/* ── Updates ────────────────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start pt-6">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base">Post an Update</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handlePost} className="space-y-5">
                  {formError && (
                    <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md font-medium">{formError}</div>
                  )}
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Type</Label>
                    <div className="flex gap-2">
                      {UPDATE_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setPostType(t)}
                          className={\`flex-1 py-2 text-sm font-bold rounded-lg border-2 transition-colors capitalize \${
                            postType === t
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }\`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="title" className="font-semibold">Title</Label>
                    <Input id="title" placeholder="Update title…" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} className="mt-1.5 bg-secondary/30" />
                  </div>
                  <div>
                    <Label htmlFor="content" className="font-semibold">Content</Label>
                    <Textarea id="content" placeholder="Tell your supporters what's happening…" value={postContent} onChange={(e) => setPostContent(e.target.value)} rows={4} className="mt-1.5 bg-secondary/30" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Photos &amp; Videos <span className="text-muted-foreground font-normal ml-1">(up to 5)</span></Label>
                    {selectedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-3">
                        {selectedFiles.map((file, i) => (
                          <div key={i} className="relative group">
                            {file.type.startsWith("video/") ? (
                              <div className="w-16 h-16 bg-secondary rounded-lg flex items-center justify-center border border-border">
                                <Video className="w-6 h-6 text-muted-foreground" />
                              </div>
                            ) : (
                              <img src={previewUrls[i]} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-border shadow-sm" />
                            )}
                            <button type="button" onClick={() => removeFile(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedFiles.length < 5 && (
                      <>
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm" multiple className="hidden" onChange={handleFileChange} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 h-16 w-full border-2 border-dashed border-border rounded-lg text-sm font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors hover:bg-primary/5"><ImageIcon className="w-4 h-4" /> {selectedFiles.length === 0 ? "Add media" : \`Add more (\${selectedFiles.length}/5)\`}</button>
                      </>
                    )}
                  </div>
                  <div className="pt-2">
                    <Button type="submit" className="w-full bg-primary text-white hover:bg-primary/90 font-bold h-11 text-base shadow-sm" disabled={isSubmitting}>{isSubmitting ? uploadLabel : "Publish Update"}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center justify-between">
                  Recent Updates <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{updates.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {updatesQ.isLoading ? (
                  <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
                ) : updates.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-10 px-4">No updates yet. Your published updates will appear here.</p>
                ) : (
                  <div className="space-y-4">
                    {updates.map((u: FeedUpdate) => (
                      <div key={u._id} className="border border-border rounded-xl p-4 bg-card/50 shadow-sm relative overflow-hidden group">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors"></div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={\`text-[10px] font-bold px-2 py-0.5 rounded-full border \${TYPE_COLORS[u.type] ?? TYPE_COLORS.update}\`}>{u.type.toUpperCase()}</span>
                          <span className="text-xs text-muted-foreground font-medium">{timeAgo(u.createdAt)}</span>
                        </div>
                        <h4 className="font-bold text-foreground text-sm leading-tight mb-1">{u.title}</h4>
                        <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">{u.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-2">
          
          <Card className="border-border shadow-sm bg-card">
            <CardHeader className="pb-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" /> Campaigns
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Manage your active fundraising and volunteer drives.</p>
                </div>
                {!showCampForm && (
                  <Button size="sm" onClick={() => setShowCampForm(true)} className="bg-primary text-white hover:bg-primary/90 font-bold shadow-sm">
                    <PlusCircle className="w-4 h-4 mr-1.5" /> New Campaign
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {showCampForm && (
                <div className="mb-8 pb-8 border-b border-border animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-extrabold text-xl text-foreground">Create New Campaign</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowCampForm(false)} className="text-muted-foreground font-semibold">Cancel</Button>
                  </div>
                  <CampaignForm
                    orgId={orgId}
                    token={token!}
                    onSuccess={() => {
                      setShowCampForm(false);
                      queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] });
                    }}
                    onCancel={() => setShowCampForm(false)}
                  />
                </div>
              )}

              {campaignsQ.isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-40 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                </div>
              ) : campaigns.length === 0 && !showCampForm ? (
                <div className="text-center py-16 px-4 bg-secondary/30 rounded-2xl border border-border border-dashed">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary/10 shadow-sm border border-primary/20">
                    <Target className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-extrabold text-lg text-foreground mb-2">Launch your first campaign</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
                    Set a fundraising goal, run a volunteer drive, and add progress phases so donors can follow your impact.
                  </p>
                  <Button onClick={() => setShowCampForm(true)} className="bg-primary text-white font-bold h-11 px-6 shadow-sm hover:bg-primary/90">
                    <PlusCircle className="w-5 h-5 mr-2" /> Create Campaign
                  </Button>
                </div>
              ) : (
                <div className="space-y-8">
                  {activeCampaigns.length > 0 && (
                    <div>
                      <h4 className="font-bold text-sm text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span> Active Campaigns
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        {activeCampaigns.map((c) => (
                          <DashCampaignCard
                            key={c._id}
                            campaign={c}
                            orgId={orgId}
                            token={token!}
                            onUpdated={() => queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] })}
                            onDeleted={() => queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] })}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {completedCampaigns.length > 0 && (
                    <div className={activeCampaigns.length > 0 ? "pt-8 border-t border-border/50" : ""}>
                      <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground"></span> Completed
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2 opacity-80">
                        {completedCampaigns.map((c) => (
                          <DashCampaignCard
                            key={c._id}
                            campaign={c}
                            orgId={orgId}
                            token={token!}
                            onUpdated={() => queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] })}
                            onDeleted={() => queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] })}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
`;

const updatedCode = code.substring(0, returnStart) + newReturn + '\n}';
fs.writeFileSync(path, updatedCode);
