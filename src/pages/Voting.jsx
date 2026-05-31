import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import BackButton from "../components/BackButton.jsx";
import { getApiBaseUrl } from "../services/api.js";

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function slugify(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function formatDisplay(v) {
  return String(v || "")
    .split("@")[0]
    .replace(/[._+-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
function formatMoney(n) {
  return `₦${Number(n || 0).toLocaleString()}`;
}
function estimateFee(n) {
  const v = Number(n || 0);
  return v ? Math.round(v * 0.015) + 1 : 0;
}
function formatDateLong(d) {
  if (!d) return "Date TBC";
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? d
    : new Intl.DateTimeFormat("en-NG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(dt);
}
function formatTimeRange(s, e) {
  return [s, e].filter(Boolean).join(" – ") || "Time TBC";
}
const MIN_VOTE_QTY = 2;
function deriveNameFromEmail(email) {
  return String(email || "")
    .split("@")[0]
    .replace(/[._+-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
function extractNomineeName(v) {
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return String(v).trim();
  if (typeof v !== "object") return "";
  if (typeof v.name === "string" || typeof v.name === "number")
    return String(v.name).trim();
  if (v.name && typeof v.name === "object")
    return String(v.name.name || v.name.label || v.name.value || "").trim();
  return String(
    v.nominee || v.label || v.value || v.title || v.text || v.fullName || "",
  ).trim();
}
function extractNomineeImageUrl(v) {
  if (!v || typeof v !== "object") return "";
  const img = v.image || v.photo || v.picture || v.avatar || v.imageUrl || "";
  if (typeof img === "string") return img.trim();
  if (img && typeof img === "object")
    return String(img.url || img.src || img.path || img.value || "").trim();
  return "";
}
function resolveNomineeDetails(award, input) {
  if (!award) return null;
  const target = String(input || "")
    .trim()
    .toLowerCase();
  if (!target) return null;
  const pool = [...(award.contestants || []), ...(award.nominees || [])];
  const match = pool.find((n) => {
    const name = (
      extractNomineeName(n) || String(n?.name || n || "")
    ).toLowerCase();
    return (
      name === target ||
      slugify(n?.slug || extractNomineeName(n) || n) === target
    );
  });
  if (!match) return null;
  if (typeof match === "string")
    return { name: match, imageUrl: "", slug: slugify(match) };
  return {
    name: extractNomineeName(match) || match.name || "",
    imageUrl: extractNomineeImageUrl(match),
    slug: match.slug || slugify(extractNomineeName(match) || match.name || ""),
  };
}

async function verifyVotePayment(ctx, response) {
  const {
    apiBase,
    eventId,
    awardId,
    voteReference,
    quantity,
    name,
    email,
    nominee,
    setAwards,
    setVoteMsg,
    navigate,
  } = ctx;
  try {
    const res = await fetch(
      `${apiBase}/awards/events/${eventId}/${awardId}/vote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: response.reference || voteReference,
          name,
          email,
          quantity,
          nominee,
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to verify vote");
    setAwards((prev) =>
      prev.map((a) =>
        a.id === awardId
          ? {
              ...a,
              voteCount: data.award?.voteCount ?? a.voteCount,
              votesCount: data.award?.votesCount ?? a.votesCount,
              selectedVotes: data.award?.totalVotes ?? a.totalVotes,
              votes: data.award?.votes ?? a.votes,
            }
          : a,
      ),
    );
    const ref = encodeURIComponent(response.reference || voteReference || '')
    navigate(`/voting-success?reference=${ref}&eventId=${eventId}&awardId=${awardId}`, { replace: true });
  } catch (err) {
    setVoteMsg(err.message);
  }
}

/* ══════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════ */
export default function VotingPage() {
  const { eventId, awardId, nomineeSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const API_BASE = getApiBaseUrl();
  const redirectingRef = useRef(false);

  const [event, setEvent] = useState(null);
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [voteMsg, setVoteMsg] = useState("");
  const [votingId, setVotingId] = useState("");
  const [verifyingVote, setVerifyingVote] = useState(false);
  const [quantity, setQuantity] = useState(MIN_VOTE_QTY);
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState({ name: "", email: "" });

  /* responsive */
  const [vw, setVw] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  useEffect(() => {
    const fn = () => setVw(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const isMobile = vw < 768;

  /* auto-fill name */
  useEffect(() => {
    if (!form.email) return;
    const derived = deriveNameFromEmail(form.email);
    setForm((prev) =>
      prev.name && prev.name !== deriveNameFromEmail(prev.email)
        ? prev
        : { ...prev, name: derived },
    );
  }, [form.email]);

  /* load data */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [evRes, awRes] = await Promise.all([
          fetch(`${API_BASE}/events/public/${eventId}`),
          fetch(`${API_BASE}/awards/events/${eventId}`),
        ]);
        const evData = await evRes.json();
        const awData = await awRes.json();
        if (!evRes.ok)
          throw new Error(evData.message || "Failed to load event");
        if (!awRes.ok)
          throw new Error(awData.message || "Failed to load awards");
        const loadedEvent =
          evData.event || evData.data?.event || evData.data || null;
        const rawAwards = Array.isArray(awData.awards)
          ? awData.awards
          : Array.isArray(awData.data?.awards)
            ? awData.data.awards
            : [];
        const baseAwards = rawAwards.map((a) => ({
          ...a,
          contestants: Array.isArray(a.contestants) ? a.contestants : [],
        }));
        if (cancelled) return;
        setEvent(loadedEvent);
        setAwards(baseAwards);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;

    async function loadContestants() {
      const activeAwardId = heroAward?.id || awardId;
      const awardToLoad = awards.find((a) => a.id === activeAwardId) || heroAward;
      if (!awardToLoad?.id || !eventId) return;

      try {
        const cRes = await fetch(
          `${API_BASE}/awards/events/${eventId}/${awardToLoad.id}/contestants`,
        );
        const cData = await cRes.json();
        if (!cRes.ok) return;

        const contestants = Array.isArray(cData.data?.contestants)
          ? cData.data.contestants
          : Array.isArray(cData.contestants)
            ? cData.contestants
            : [];

        if (cancelled) return;
        setAwards((prev) =>
          prev.map((award) =>
            award.id === awardToLoad.id ? { ...award, contestants } : award,
          ),
        );
      } catch {
        // best-effort only
      }
    }

    loadContestants();
    return () => {
      cancelled = true;
    };
  }, [API_BASE, awardId, eventId, heroAward?.id]);

  /* derive active award + nominee */
  const heroAward = awards.find((a) => a.id === awardId) || awards[0] || null;
  const heroNominees =
    Array.isArray(heroAward?.contestants) && heroAward.contestants.length > 0
      ? heroAward.contestants
      : Array.isArray(heroAward?.nominees)
        ? heroAward.nominees
        : [];
  const activeKey = heroAward?.id || awardId || eventId;
  const voteReference = searchParams.get("reference");
  const awardIdFromQuery = searchParams.get("awardId") || awardId;

  /* resolve selected nominee from URL slug or first */
  const defaultNominee = heroNominees[0]
    ? extractNomineeName(heroNominees[0]) || String(heroNominees[0])
    : "";
  const currentNominee = selected || defaultNominee;
  const nomDetails =
    resolveNomineeDetails(heroAward, currentNominee) ||
    (heroNominees[0] && typeof heroNominees[0] === "object"
      ? {
          name: extractNomineeName(heroNominees[0]),
          imageUrl: extractNomineeImageUrl(heroNominees[0]),
          slug: "",
        }
      : null);

  /* payment calc */
  const subtotal = quantity * 50;
  const fee = estimateFee(subtotal);
  const total = subtotal + fee;

  useEffect(() => {
    if (!voteReference || verifyingVote) return;
    if (!eventId || !awardIdFromQuery) return;

    const nominee = nomDetails?.name || currentNominee;
    setVoteMsg("Verifying payment with Paystack...");
    setVerifyingVote(true);

    verifyVotePayment({
      apiBase: API_BASE,
      eventId,
      awardId: awardIdFromQuery,
      voteReference,
      quantity,
      name: form.name,
      email: form.email,
      nominee,
      setAwards,
      setVoteMsg,
      navigate,
    }).finally(() => {
      setVerifyingVote(false);
    });
  }, [
    API_BASE,
    awardIdFromQuery,
    currentNominee,
    eventId,
    form.email,
    form.name,
    navigate,
    nomDetails,
    quantity,
    verifyingVote,
    voteReference,
  ]);

  async function handleVote() {
    setVoteMsg("");
    setError("");
    if (!form.email) {
      setVoteMsg("Please enter your email first.");
      return;
    }
    if (!currentNominee) {
      setVoteMsg("Please select a nominee.");
      return;
    }

    if (quantity < MIN_VOTE_QTY) {
      setVoteMsg("Minimum vote is 2");
      return;
    }
    setVotingId(activeKey);
    try {
      const totalAmountInKobo = Math.round(total * 100)
      const normalizedNomineeName =
        formatDisplay(currentNominee).toLowerCase() ||
        String(currentNominee || "").trim().toLowerCase();
      const normalizedNomineeSlug = slugify(currentNominee);
      const resolvedNominee = heroNominees.find((nominee) => {
        const nomineeNameValue = extractNomineeName(nominee);
        const normalizedName =
          formatDisplay(nomineeNameValue).toLowerCase() ||
          String(nomineeNameValue || "").trim().toLowerCase();
        const normalizedSlug = slugify(
          nominee?.slug || nomineeNameValue || nominee
        );
        return (
          normalizedName === normalizedNomineeName ||
          normalizedSlug === normalizedNomineeSlug
        );
      });
      const nomineeIdValue = String(
        resolvedNominee?.id ||
          resolvedNominee?._id ||
          resolvedNominee?.nomineeId ||
          resolvedNominee?.contestantId ||
          resolvedNominee?.uuid ||
          nomDetails?.slug ||
          currentNominee ||
          "",
      );
      // 1. Make an API request to your backend to initialize the payment session
      const res = await fetch(
        `${API_BASE}/awards/events/${eventId}/${activeKey}/vote/initialize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: totalAmountInKobo,
            name: form.name,
            email: form.email,
            nominee: currentNominee,
            metadata: {
              type: 'vote',
              nomineeId: nomineeIdValue,
              numberOfVotes: quantity,
            },
            quantity: quantity,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || "Failed to initialize payment tracking session",
        );
      }

      const authorizationUrl = data.data?.authorization_url;

      if (authorizationUrl) {
        setVoteMsg("Redirecting to secure Paystack window...");
        redirectingRef.current = true;
        window.location.assign(authorizationUrl);
        return;
      } else {
        throw new Error("No checkout URL returned from server configurations.");
      }
    } catch (err) {
      setVoteMsg(err.message);
    } finally {
      if (!redirectingRef.current) {
        setVotingId("");
      }
    }
  }

  if (loading) return <Shell msg="Loading voting page…" />;
  if (error && !event)
    return (
      <Shell msg={error} label="Back" onAction={() => navigate("/events")} />
    );
  if (!event)
    return (
      <Shell
        msg="Event not found"
        label="Back"
        onAction={() => navigate("/events")}
      />
    );

  const nomName = formatDisplay(nomDetails?.name || currentNominee);
  const nomImage = nomDetails?.imageUrl || "";

  return (
    <div style={S.page}>
      {/* ── TOPBAR ── */}
      <header style={S.topbar}>
        <div style={S.topbarLeft}>
          <BackButton fallback="/" />
          <span style={S.brandMark}>NEST✦</span>
        </div>
        <div style={S.secureTag}>
          <span style={S.secureDot} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#6b6b7a" }}>
            {isMobile ? "Secure" : "Secure Voting · Paystack"}
          </span>
        </div>
      </header>

      {/* ── PAGE WRAPPER ── */}
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: isMobile ? "20px 16px 80px" : "32px 24px 80px",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? 20 : 28,
          alignItems: "start",
        }}
      >
        {/* ════════ LEFT COLUMN ════════ */}
        <div style={S.leftCol}>
          {/* category badge + title */}
          <div style={S.categoryBadge}>
            {heroAward?.title || "Award Category"}
          </div>
          <h1 style={S.pageTitle}>
            Vote for{" "}
            <span style={S.pageTitleAccent}>{nomName || "Nominee"}</span>
          </h1>
          <p style={S.eventSubtitle}>{event.title}</p>
          {heroAward?.description && (
            <p style={S.awardDesc}>{heroAward.description}</p>
          )}

          {/* stats row */}
          <div style={S.statsRow}>
            <div style={S.statPill}>
              <span style={S.statPillIcon}>₦</span>
              <span>₦50 per vote</span>
            </div>
          </div>

          {/* ── NOMINEE PHOTO + RANK ── */}
          <div style={S.nomineePhotoCard}>
            {nomImage ? (
              <img src={nomImage} alt={nomName} style={S.nomineePhoto} />
            ) : (
              <div style={S.nomineePhotoFb}>
                <span
                  style={{
                    fontSize: 72,
                    fontWeight: 900,
                    color: "#c4b5fd",
                    opacity: 0.6,
                  }}
                >
                  {String(nomName || "?")
                    .charAt(0)
                    .toUpperCase()}
                </span>
              </div>
            )}
            {/* overlay: name */}
            <div style={S.nomineePhotoOverlay}>
              <div style={S.nomineeNameOverlay}>{nomName}</div>
            </div>
          </div>

          {/* ── OTHER NOMINEES (if multiple) ── */}
          {heroNominees.length > 1 && (
            <div style={S.otherNominees}>
              <div style={S.otherNomineesLabel}>Other Nominees</div>
              <div style={S.otherNomineesList}>
                {heroNominees.map((n) => {
                  const name =
                    typeof n === "string"
                      ? n
                      : extractNomineeName(n) || n?.name || "";
                  const img =
                    typeof n === "object" ? extractNomineeImageUrl(n) : "";
                  const nSlug =
                    typeof n === "object"
                      ? n.slug || slugify(name)
                      : slugify(name);
                  const isActive =
                    formatDisplay(currentNominee) === formatDisplay(name);
                  return (
                    <button
                      key={nSlug || name}
                      style={{
                        ...S.otherNomineeBtn,
                        ...(isActive ? S.otherNomineeBtnOn : {}),
                      }}
                      onClick={() => {
                        setSelected(name);
                        navigate(
                          `/public/events/${eventId}/voting/${heroAward?.id}/${nSlug}`,
                        );
                      }}
                    >
                      {img ? (
                        <img
                          src={img}
                          alt={name}
                          style={S.otherNomineeAvatar}
                        />
                      ) : (
                        <div style={S.otherNomineeAvatarFb}>
                          {String(name).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span style={S.otherNomineeName}>
                        {formatDisplay(name)}
                      </span>
                      {isActive && <span style={S.otherNomineeCheck}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── EVENT DETAILS BOX ── */}
          <div style={S.infoBox}>
            <div style={S.infoBoxTitle}>Event Details</div>
            <MetaRow label="Event" value={event.title} />
            <MetaRow label="Date" value={formatDateLong(event.startDate)} />
            <MetaRow
              label="Time"
              value={formatTimeRange(event.startTime, event.endTime)}
            />
            <MetaRow
              label="Venue"
              value={event.location || "To be announced"}
            />
          </div>

          <div style={S.infoBox}>
            <div style={S.infoBoxTitle}>Award Category</div>
            <MetaRow label="Award" value={heroAward?.title || "—"} />
            <MetaRow label="Category" value={heroAward?.description || "—"} />
            <MetaRow label="Price per Vote" value="₦50" />
          </div>

          {/* other award categories */}
          {awards.length > 1 && (
            <div style={S.infoBox}>
              <div style={S.infoBoxTitle}>Other Categories</div>
              {awards
                .filter((a) => a.id !== heroAward?.id)
                .map((a) => (
                  <button
                    key={a.id}
                    style={S.categoryLink}
                    onClick={() =>
                      navigate(`/public/events/${eventId}/voting/${a.id}`)
                    }
                  >
                    {a.title}
                    <span style={{ marginLeft: "auto", opacity: 0.5 }}>›</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* ════════ RIGHT COLUMN — VOTE CARD ════════ */}
        <aside
          style={{
            ...S.voteCard,
            position: isMobile ? "static" : "sticky",
            top: 80,
          }}
        >
          {/* selected nominee mini-header */}
          <div style={S.voteCardTop}>
            {nomImage ? (
              <img src={nomImage} alt={nomName} style={S.voteCardAvatar} />
            ) : (
              <div style={S.voteCardAvatarFb}>
                {String(nomName || "?")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.voteCardLabel}>Voting for</div>
              <div style={S.voteCardName}>{nomName || "Select a nominee"}</div>
              <div style={S.voteCardCategory}>{heroAward?.title}</div>
            </div>
          </div>

          {/* message banner */}
          {voteMsg && (
            <div
              style={{
                ...S.msgBanner,
                background: voteMsg.startsWith("✓")
                  ? "rgba(74,222,128,0.1)"
                  : "rgba(248,113,113,0.1)",
                borderColor: voteMsg.startsWith("✓")
                  ? "rgba(74,222,128,0.25)"
                  : "rgba(248,113,113,0.25)",
                color: voteMsg.startsWith("✓") ? "#4ade80" : "#fca5a5",
              }}
            >
              {voteMsg}
            </div>
          )}

          <div style={S.voteForm}>
            <div style={S.sectionHeading}>Cast Your Vote</div>
            <p style={S.voteSubtitle}>
              Support{" "}
              <strong style={{ color: "#c4b5fd" }}>
                {nomName || "your nominee"}
              </strong>{" "}
              with a secure Paystack payment.
            </p>

            {/* email */}
            <FormField label="Email Address *">
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="you@example.com"
                style={S.input}
                required
              />
            </FormField>

            {/* name */}
            <FormField label="Your Name">
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Auto-filled from email"
                style={S.input}
              />
            </FormField>

            {/* quantity stepper */}
            <FormField label="Number of Votes">
              <div style={S.qRow}>
                <button
                  style={S.qBtn}
                  type="button"
                  onClick={() =>
                    setQuantity((q) => Math.max(MIN_VOTE_QTY, q - 1))
                  }
                >
                  −
                </button>
                <input
                  type="number"
                  min={MIN_VOTE_QTY}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(
                        MIN_VOTE_QTY,
                        Number(e.target.value || MIN_VOTE_QTY),
                      ),
                    )
                  }
                  style={{ ...S.input, textAlign: "center", flex: 1 }}
                />
                <button
                  style={S.qBtn}
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  +
                </button>
              </div>
            </FormField>

            {/* ── PAYMENT BREAKDOWN ── */}
            <div style={S.breakdownBox}>
              <div style={S.breakdownTitle}>Payment Breakdown</div>

              {/* nominee preview */}
              <div style={S.nomPreview}>
                {nomImage ? (
                  <img src={nomImage} alt={nomName} style={S.nomPreviewImg} />
                ) : (
                  <div style={S.nomPreviewFb}>
                    {String(nomName || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#6b6b7a",
                      textTransform: "uppercase",
                      letterSpacing: ".5px",
                      fontWeight: 700,
                      marginBottom: 2,
                    }}
                  >
                    Current nominee
                  </div>
                  <div
                    style={{ fontSize: 14, fontWeight: 700, color: "#e8e8f0" }}
                  >
                    {nomName || "Select nominee"}
                  </div>
                </div>
              </div>

              <BRow label="Contestant" value={nomName || "—"} />
              <BRow label="Category" value={heroAward?.title || "—"} />
              <BRow label="Price per Vote" value={formatMoney(50)} />
              <BRow label="Number of Votes" value={String(quantity)} />
              <BRow label="Subtotal" value={formatMoney(subtotal)} />
              <BRow label="Transaction Fee" value={formatMoney(fee)} />

              <div style={S.totalRow}>
                <span style={S.totalLabel}>Total Amount</span>
                <span style={S.totalAmt}>{formatMoney(total)}</span>
              </div>
            </div>

            {/* CTA */}
            <button
              style={{
                ...S.voteBtn,
                opacity: votingId === activeKey ? 0.55 : 1,
                cursor: votingId === activeKey ? "not-allowed" : "pointer",
              }}
              onClick={handleVote}
              disabled={votingId === activeKey}
              type="button"
            >
              {votingId === activeKey
                ? "Opening Paystack…"
                : `Vote for ${nomName || "Nominee"} →`}
            </button>

            <div style={S.secureRow}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#4ade80",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: "#6b6b7a" }}>
                Secure payment via Paystack
              </span>
            </div>

            {/* repeat event + award info below form, like eventbry */}
            <div style={{ ...S.infoBox, marginTop: 8 }}>
              <div style={S.infoBoxTitle}>Event Details</div>
              <MetaRow label="Event" value={event.title} />
              <MetaRow label="Date" value={formatDateLong(event.startDate)} />
              <MetaRow
                label="Time"
                value={formatTimeRange(event.startTime, event.endTime)}
              />
              <MetaRow
                label="Venue"
                value={event.location || "To be announced"}
              />
            </div>
            <div style={{ ...S.infoBox, marginTop: 8 }}>
              <div style={S.infoBoxTitle}>Award Category</div>
              <MetaRow label="Award" value={heroAward?.title || "—"} />
              <MetaRow label="Category" value={heroAward?.description || "—"} />
              <MetaRow label="Price per Vote" value="₦50" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── tiny sub-components ── */
function Shell({ msg, label, onAction }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0c0c10",
        color: "#e8e8f0",
        fontFamily: "'DM Sans',system-ui,sans-serif",
        padding: 16,
      }}
    >
      <div
        style={{
          padding: 32,
          borderRadius: 20,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
          maxWidth: 400,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <p style={{ fontSize: 16, marginBottom: 16, color: "#9ca3af" }}>
          {msg}
        </p>
        {onAction && (
          <button
            onClick={onAction}
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "#e8e8f0",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "10px 20px",
              cursor: "pointer",
              fontFamily: "'DM Sans',system-ui,sans-serif",
            }}
          >
            {label}
          </button>
        )}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        marginBottom: 12,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".5px",
          color: "#6b6b7a",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "#6b6b7a",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "#c0c0d0",
          fontWeight: 500,
          textAlign: "right",
          lineHeight: 1.4,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function BRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 13,
        color: "#9ca3af",
        padding: "4px 0",
      }}
    >
      <span>{label}:</span>
      <strong style={{ color: "#e8e8f0" }}>{value}</strong>
    </div>
  );
}

/* ══════════════════════════════════════
   STYLES — keeps your dark bg + purple
══════════════════════════════════════ */
const S = {
  page: {
    minHeight: "100vh",
    background: "#0c0c10",
    color: "#e8e8f0",
    fontFamily: "'DM Sans',system-ui,sans-serif",
    WebkitFontSmoothing: "antialiased",
  },

  /* topbar */
  topbar: {
    minHeight: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px clamp(12px, 3vw, 24px)",
    background: "rgba(12,12,16,0.92)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  topbarLeft: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 },
  brandMark: {
    fontFamily: "'Arial Black',sans-serif",
    fontWeight: 900,
    fontSize: 18,
    letterSpacing: 3,
    color: "rgba(245,240,232,0.25)",
  },
  secureTag: { display: "flex", alignItems: "center", gap: 7 },
  secureDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#4ade80",
    flexShrink: 0,
  },

  /* columns */
  leftCol: { display: "flex", flexDirection: "column", gap: 16 },

  /* category badge above title */
  categoryBadge: {
    alignSelf: "flex-start",
    background: "rgba(167,139,250,0.12)",
    border: "1px solid rgba(167,139,250,0.25)",
    borderRadius: 999,
    padding: "5px 14px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#c4b5fd",
  },
  pageTitle: {
    fontSize: "clamp(22px,3.5vw,34px)",
    fontWeight: 900,
    letterSpacing: "-1px",
    lineHeight: 1.1,
    margin: 0,
    color: "#f0f0f4",
  },
  pageTitleAccent: { color: "#c4b5fd" },
  eventSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.55)", margin: 0 },
  awardDesc: { fontSize: 13, color: "#6b6b7a", margin: 0, lineHeight: 1.6 },

  /* stats pills */
  statsRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  statPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    color: "#c4b5fd",
  },
  statPillIcon: { fontSize: 12 },

  /* nominee photo */
  nomineePhotoCard: {
    position: "relative",
    width: "100%",
    aspectRatio: "3/4",
    borderRadius: 20,
    overflow: "hidden",
    background: "#161620",
    border: "1px solid rgba(167,139,250,0.15)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  },
  nomineePhoto: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center top",
    display: "block",
  },
  nomineePhotoFb: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    background: "rgba(167,139,250,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  nomineePhotoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background:
      "linear-gradient(0deg,rgba(12,12,16,0.95) 0%,rgba(12,12,16,0.6) 50%,transparent 100%)",
    padding: "32px 20px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  nomineeNameOverlay: {
    fontSize: "clamp(18px,2.5vw,26px)",
    fontWeight: 900,
    color: "#fff",
    letterSpacing: "-.5px",
    lineHeight: 1.1,
    textShadow: "0 2px 12px rgba(0,0,0,0.8)",
  },
  nomineeVoteBadge: {
    alignSelf: "flex-start",
    background: "rgba(12,12,16,0.7)",
    border: "1px solid rgba(167,139,250,0.3)",
    borderRadius: 12,
    padding: "10px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    backdropFilter: "blur(10px)",
  },

  /* other nominees */
  otherNominees: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: "16px 18px",
  },
  otherNomineesLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".5px",
    color: "#6b6b7a",
    marginBottom: 12,
  },
  otherNomineesList: { display: "flex", flexDirection: "column", gap: 6 },
  otherNomineeBtn: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
    cursor: "pointer",
    fontFamily: "'DM Sans',system-ui,sans-serif",
    textAlign: "left",
    transition: "all .15s",
  },
  otherNomineeBtnOn: {
    background: "rgba(167,139,250,0.1)",
    borderColor: "rgba(167,139,250,0.35)",
  },
  otherNomineeAvatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
    border: "1px solid rgba(255,255,255,0.1)",
  },
  otherNomineeAvatarFb: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "rgba(167,139,250,0.15)",
    color: "#c4b5fd",
    display: "grid",
    placeItems: "center",
    fontSize: 14,
    fontWeight: 800,
    flexShrink: 0,
  },
  otherNomineeName: {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    color: "#e8e8f0",
  },
  otherNomineeCheck: { fontSize: 13, color: "#a78bfa", fontWeight: 900 },

  /* info boxes */
  infoBox: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: "16px 18px",
  },
  infoBoxTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1px",
    color: "#6b6b7a",
    marginBottom: 10,
  },

  categoryLink: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    fontSize: 13,
    fontWeight: 600,
    color: "#c0c0d0",
    cursor: "pointer",
    fontFamily: "'DM Sans',system-ui,sans-serif",
    background: "none",
    border: "none",
    textAlign: "left",
  },

  /* vote card */
  voteCard: {
    background: "#161620",
    border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: 20,
    overflow: "hidden",
    boxShadow: "0 8px 40px rgba(124,58,237,0.12)",
    boxSizing: "border-box",
    width: "100%",
  },
  voteCardTop: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "20px 22px",
    background: "linear-gradient(135deg,#1e1030,#2a1050)",
    borderBottom: "1px solid rgba(167,139,250,0.15)",
  },
  voteCardAvatar: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid rgba(167,139,250,0.4)",
    flexShrink: 0,
  },
  voteCardAvatarFb: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "rgba(167,139,250,0.15)",
    color: "#c4b5fd",
    display: "grid",
    placeItems: "center",
    fontSize: 20,
    fontWeight: 900,
    border: "2px solid rgba(167,139,250,0.3)",
    flexShrink: 0,
  },
  voteCardLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".5px",
    color: "#9ca3af",
    marginBottom: 2,
  },
  voteCardName: {
    fontSize: 17,
    fontWeight: 800,
    color: "#f0f0f4",
    letterSpacing: "-.3px",
    lineHeight: 1.2,
  },
  voteCardCategory: { fontSize: 12, color: "#9ca3af", marginTop: 2 },

  msgBanner: {
    margin: "12px 22px 0",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.5,
  },

  voteForm: {
    padding: "20px 22px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 900,
    color: "#f0f0f4",
    letterSpacing: "-.3px",
    marginBottom: 6,
  },
  voteSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    lineHeight: 1.6,
    marginBottom: 18,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 10,
    padding: "11px 14px",
    fontSize: 14,
    color: "#e8e8f0",
    outline: "none",
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },

  qRow: { display: "flex", alignItems: "center", gap: 8 },
  qBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "rgba(167,139,250,0.1)",
    border: "1px solid rgba(167,139,250,0.2)",
    color: "#c4b5fd",
    fontSize: 20,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },

  /* breakdown */
  breakdownBox: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 14,
    marginTop: 4,
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".5px",
    color: "#a78bfa",
    marginBottom: 6,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  nomPreview: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    marginBottom: 6,
  },
  nomPreviewImg: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
  },
  nomPreviewFb: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(167,139,250,0.15)",
    color: "#c4b5fd",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    flexShrink: 0,
  },

  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".5px",
    color: "#6b6b7a",
  },
  totalAmt: {
    fontSize: 24,
    fontWeight: 900,
    color: "#c4b5fd",
    letterSpacing: "-1px",
  },

  voteBtn: {
    width: "100%",
    background: "linear-gradient(90deg,#7c3aed,#a78bfa)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px 0",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "-.2px",
    cursor: "pointer",
    marginBottom: 10,
    fontFamily: "'DM Sans',system-ui,sans-serif",
    boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
    transition: "opacity .15s,transform .15s",
  },
  secureRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginBottom: 16,
  },
};
