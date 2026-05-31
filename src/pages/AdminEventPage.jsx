import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getApiBaseUrl } from "../services/api.js";
import { deleteAward as apiDeleteAward } from "../services/awards.js";

/* ─── helpers ─── */
function slugify(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function extractNomineeName(v) {
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return String(v).trim();
  if (typeof v !== "object") return "";
  if (typeof v.name === "string" || typeof v.name === "number")
    return String(v.name).trim();
  if (v.name && typeof v.name === "object") {
    return String(v.name.name || v.name.label || v.name.value || "").trim();
  }
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
function normalizeNominees(input) {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const objectCandidates = [
      input.nominees,
      input.contestants,
      input.items,
      input.data?.nominees,
      input.data?.contestants,
      input.data?.items,
      input.results,
      input.list,
    ].find(Array.isArray);

    if (objectCandidates) return normalizeNominees(objectCandidates);

    const values = Object.values(input);
    if (
      values.some(
        (value) =>
          typeof value === "string" ||
          typeof value === "number" ||
          (value &&
            typeof value === "object" &&
            (value.name ||
              value.label ||
              value.value ||
              value.image ||
              value.photo ||
              value.picture ||
              value.avatar ||
              value.imageUrl)),
      )
    ) {
      return normalizeNominees(values);
    }
  }

  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") {
          const n = item.trim();
          return n ? { name: n, imageUrl: "", slug: slugify(n) } : null;
        }
        const n = extractNomineeName(item);
        if (!n) return null;
        return {
          name: n,
          imageUrl: extractNomineeImageUrl(item),
          slug: item.slug || slugify(n),
        };
      })
      .filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/\r?\n|,/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((n) => ({ name: n, imageUrl: "", slug: slugify(n) }));
  }
  return [];
}
function countNomineeVotes(award, nominee) {
  const votes = Array.isArray(award?.votes) ? award.votes : [];
  const targetName = extractNomineeName(nominee).toLowerCase();
  const targetSlug = slugify(nominee?.slug || extractNomineeName(nominee));
  return votes.reduce((total, vote) => {
    const vn =
      vote?.nominee ??
      vote?.nomineeName ??
      vote?.candidate ??
      vote?.choice ??
      "";
    const voteName =
      extractNomineeName(vn).toLowerCase() ||
      String(vn || "")
        .trim()
        .toLowerCase();
    const voteSlug = slugify(vn?.slug || extractNomineeName(vn) || vn);
    return voteName === targetName || voteSlug === targetSlug
      ? total + Number(vote.quantity || 1)
      : total;
  }, 0);
}

function getAwardNominees(award) {
  return normalizeNominees(
    award?.nominees ||
      award?.contestants ||
      award?.items ||
      award?.data?.nominees ||
      award?.data?.contestants ||
      award?.data?.items ||
      award?.results ||
      award?.list ||
      [],
  );
}

function normalizeTicket(ticket) {
  return {
    id: ticket?.id || ticket?._id || ticket?.ticketId || String(ticket?.ticketId || ""),
    ticketId: ticket?.ticketId || "",
    eventId: ticket?.eventId || "",
    attendeeName: ticket?.attendeeName || ticket?.name || "",
    attendeeEmail: ticket?.attendeeEmail || ticket?.email || "",
    ticketType: ticket?.ticketType || ticket?.type || "",
    price: ticket?.price ?? 0,
    amountPaid: ticket?.amountPaid ?? ticket?.price ?? 0,
    status: ticket?.status || ticket?.paymentStatus || "pending",
    paymentReference: ticket?.paymentReference || "",
    checkedInAt: ticket?.checkedInAt || null,
    createdAt: ticket?.createdAt || null,
  };
}

export default function AdminEventPage({ user = null }) {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const API_BASE = getApiBaseUrl();
  const nomineeFileRefs = useRef([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    nominees: [],
  });
  const [deleting, setDeleting] = useState(null); // awardId being deleted
  const [editingAwardId, setEditingAwardId] = useState(null);
  const [awardEdits, setAwardEdits] = useState(null);
  const [savingAwardEdit, setSavingAwardEdit] = useState(false);
  const [editingNominee, setEditingNominee] = useState(null);
  const [nomineeEdits, setNomineeEdits] = useState(null);
  const [savingNomineeEdit, setSavingNomineeEdit] = useState(false);
  const [nomineeError, setNomineeError] = useState("");

  useEffect(() => {
  async function load() {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("es_token");
      const res = await fetch(`${API_BASE}/events/${eventId}/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.message || "Failed to load admin data");
      }

      // Keep admin response as source of truth (tickets + vote stats)
      setData(payload.data);
      setForm({ title: "", description: "", nominees: [] });
    } catch (err) {
      setError(err.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  load();
}, [API_BASE, eventId]);

  async function handleCreateAward(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const token = localStorage.getItem("es_token");
      const res = await fetch(`${API_BASE}/awards/events/${eventId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          nominees: form.nominees
            .map((n) => ({
              name: n.name.trim(),
              imageUrl: n.imageUrl.trim(),
              slug: slugify(n.name),
            }))
            .filter((n) => n.name),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || "Failed to create award");
      setSuccess("Award created successfully.");
      setForm({ title: "", description: "", nominees: [] });
      setData((prev) =>
        prev
          ? {
              ...prev,
              awards: [
                payload.data?.award,
                ...(Array.isArray(prev.awards) ? prev.awards : []),
              ],
            }
          : prev,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAward(awardId, awardTitle) {
    if (!window.confirm(`Delete "${awardTitle}"? This cannot be undone.`))
      return;
    setDeleting(awardId);
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiDeleteAward(eventId, awardId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              awards: (Array.isArray(prev.awards) ? prev.awards : []).filter(
                (a) => a.id !== awardId,
              ),
            }
          : prev,
      );
      setSuccess("Award deleted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setDeleting(null);
    }
  }

  function handleNomineeFileChange(index, file) {
    if (!file || !file.type?.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        nominees: prev.nominees.map((n, i) =>
          i === index ? { ...n, imageUrl: String(reader.result || "") } : n,
        ),
      }));
    };
    reader.readAsDataURL(file);
  }

  function openNomineeEdit(award, nominee, nomineeIndex) {
    setNomineeError("");
    setEditingNominee({ awardId: award.id, nomineeIndex, mode: "edit" });
    setNomineeEdits({
      name: nominee?.name || "",
      imageUrl: nominee?.imageUrl || "",
    });
  }

  function openNomineeAdd(award) {
    setNomineeError("");
    setEditingNominee({ awardId: award.id, nomineeIndex: null, mode: "add" });
    setNomineeEdits({
      name: "",
      imageUrl: "",
    });
  }

  async function handleSaveNomineeEdit() {
    if (!editingNominee || !nomineeEdits) return;
    if (!window.confirm("Update this nominee?")) return;
    setNomineeError("");
    try {
      setSavingNomineeEdit(true);

      const award = safeAwards.find(
        (item) => String(item.id) === String(editingNominee.awardId),
      );
      if (!award) {
        throw new Error("Award not found");
      }

      const updatedNominees = getAwardNominees(award).map((nominee, index) => {
        if (
          editingNominee.mode !== "edit" ||
          index !== editingNominee.nomineeIndex
        )
          return nominee;
        return {
          ...nominee,
          name: nomineeEdits.name,
          imageUrl: nomineeEdits.imageUrl,
        };
      });

      if (editingNominee.mode === "add") {
        const nomineeName = String(nomineeEdits.name || "").trim();
        if (!nomineeName) {
          throw new Error("Nominee name is required");
        }
        updatedNominees.push({
          name: nomineeName,
          imageUrl: String(nomineeEdits.imageUrl || "").trim(),
          slug: slugify(nomineeName),
        });
      }

      const token = localStorage.getItem("es_token");
      const res = await fetch(
        `${API_BASE}/awards/events/${eventId}/${editingNominee.awardId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: award.title,
            description: award.description,
            nominees: updatedNominees,
          }),
        },
      );
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.message || "Failed to update nominee");
      }

      const updatedAward = payload.data?.award || payload.data || payload;
      setData((prev) => {
        if (!prev) return prev;
        const nextAwards = Array.isArray(prev.awards)
          ? prev.awards.map((item) =>
              String(item.id) === String(updatedAward.id) ? updatedAward : item,
            )
          : prev.awards;

        return { ...prev, awards: nextAwards };
      });

      setSuccess(
        editingNominee.mode === "add"
          ? "Nominee added successfully."
          : "Updated successfully",
      );
      setEditingNominee(null);
      setNomineeEdits(null);
    } catch (err) {
      setNomineeError(err.message);
    } finally {
      setSavingNomineeEdit(false);
    }
  }

  if (loading) return <Shell message="Loading admin dashboard…" />;
  if (error && !data)
    return (
      <Shell
        message={error}
        actionLabel="Back to Events"
        onAction={() => navigate("/events")}
      />
    );
  if (!data)
    return (
      <Shell
        message="Admin data not found"
        actionLabel="Back to Events"
        onAction={() => navigate("/events")}
      />
    );

  const {
    event,
  paidCount,
  freeCount,
  scannedCount = 0,
  unscannedCount = 0,
  totalTickets = 0,
  ticketCount = 0,
  totalTicketCount = 0,
  paidTickets = [],
  scannedTickets = [],
  unscannedTickets = [],
  awards = [],
  } = data;
  const allTickets = Array.isArray(data.tickets) ? data.tickets.map(normalizeTicket) : [];
  const normalizedPaidTickets =
    Array.isArray(paidTickets) && paidTickets.length > 0
      ? paidTickets
      : allTickets.filter(
          (ticket) =>
            String(ticket.status || "").toLowerCase() === "confirmed" &&
            Number(ticket.price || ticket.amountPaid || 0) > 0,
        );
  const normalizedFreeTickets = allTickets.filter(
    (ticket) =>
      String(ticket.status || "").toLowerCase() === "confirmed" &&
      Number(ticket.price || ticket.amountPaid || 0) <= 0,
  );
  const normalizedScannedTickets =
    Array.isArray(scannedTickets) && scannedTickets.length > 0
      ? scannedTickets
      : allTickets.filter(
          (ticket) => String(ticket.status || "").toLowerCase() === "checked-in",
        );
  const normalizedUnscannedTickets =
    Array.isArray(unscannedTickets) && unscannedTickets.length > 0
      ? unscannedTickets
      : allTickets.filter(
          (ticket) => String(ticket.status || "").toLowerCase() === "confirmed",
        );
  const safeAwards = Array.isArray(awards) ? awards : [];
  const resolvedPaidCount = Number(paidCount || normalizedPaidTickets.length || 0);
  const resolvedFreeCount = Number(freeCount || normalizedFreeTickets.length || 0);
  const vipPaidCount = normalizedPaidTickets.filter(
    (ticket) => String(ticket?.ticketType || "").toLowerCase() === "vip",
  ).length;
  const tablePaidCount = normalizedPaidTickets.filter(
    (ticket) => String(ticket?.ticketType || "").toLowerCase() === "table",
  ).length;

  const resolvedScannedCount = Number(scannedCount || normalizedScannedTickets.length || 0);
  const resolvedUnscannedCount = Number(unscannedCount || normalizedUnscannedTickets.length || 0);
  const resolvedTicketTotal =
    Number(totalTickets || ticketCount || totalTicketCount || allTickets.length || 0);

  const currentNominees =
    form.nominees.length > 0 ? form.nominees : [{ name: "", imageUrl: "" }];
  const nomineesByAward = safeAwards.map((award) => ({
    award,
    nominees: getAwardNominees(award),
  }));
  const totalNominees = nomineesByAward.reduce(
    (total, group) => total + group.nominees.length,
    0,
  );

  const isOrganizer = String(event.organizerId) === String(user?.userId);
  const isCoHost = Boolean(
    user?.email &&
    Array.isArray(event.coHosts) &&
    event.coHosts.some(
      (h) =>
        String(h.email || "").toLowerCase() ===
        String(user.email || "").toLowerCase(),
    ),
  );
  const canManageEvent = isOrganizer || isCoHost;

  return (
    <div style={A.page}>
      {/* ─── TOPBAR ─── */}
      <header style={A.topbar}>
        <div>
          <div style={A.kicker}>Admin Dashboard</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={A.pageTitle}>{event.title}</h1>
            {isCoHost && !isOrganizer && (
              <span style={A.coHostBadge}>Co-host</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            style={A.ghostBtn}
            onClick={() => navigate(`/events/${eventId}`)}
          >
            ← Back to Event
          </button>
          <button
            style={A.accentBtn}
            onClick={() => navigate(`/events/${eventId}/scan`)}
          >
            📷 Scanner
          </button>
        </div>
      </header>

      <main style={A.main}>
        {/* ─── STATS ─── */}
        <div style={A.statsGrid}>
          {[
            { label: "Paid Tickets", value: resolvedPaidCount, color: "#a78bfa" },
            { label: "VIP Paid", value: vipPaidCount, color: "#c084fc" },
            { label: "Table Paid", value: tablePaidCount, color: "#f472b6" },
            { label: "Free Tickets", value: resolvedFreeCount, color: "#38bdf8" },
            { label: "Checked In", value: resolvedScannedCount, color: "#4ade80" },
            { label: "Not Scanned", value: resolvedUnscannedCount, color: "#fb7185" },
            { label: "Awards", value: safeAwards.length, color: "#fbbf24" },
            {
              label: "Total Votes",
              value: safeAwards.reduce(
                (t, a) =>
                  t + Number(a.totalVotes ?? a.votesCount ?? a.voteCount ?? 0),
                0,
              ),
              color: "#fb923c",
            },
            { label: "Total Tickets", value: resolvedTicketTotal, color: "#60a5fa" },
          ].map((s) => (
            <div key={s.label} style={A.statCard}>
              <div style={A.statLabel}>{s.label}</div>
              <div style={{ ...A.statValue, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ─── MAIN GRID ─── */}
        <div style={A.grid}>
          {/* CREATE AWARD */}
          <div style={A.panel}>
            <div style={A.panelHead}>
              <span style={A.panelIcon}>🏆</span> Create Award
            </div>
            {success && <div style={A.successBanner}>{success}</div>}
            {error && <div style={A.errorBanner}>{error}</div>}

            <form
              onSubmit={handleCreateAward}
              style={{ display: "grid", gap: 14 }}
            >
              <FormField label="Award Title">
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                  style={A.input}
                  placeholder="e.g. Best Dressed"
                  required
                />
              </FormField>
              <FormField label="Description (optional)">
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  style={{ ...A.input, ...A.textarea }}
                  rows={3}
                  placeholder="Describe this award category"
                />
              </FormField>

              <FormField label={`Nominees (${currentNominees.length}/6)`}>
                <div style={{ display: "grid", gap: 10 }}>
                  {currentNominees.map((nominee, index) => (
                    <div key={index} style={A.nomineeCard}>
                      {/* thumbnail preview */}
                      {nominee.imageUrl && (
                        <img
                          src={nominee.imageUrl}
                          alt="preview"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div style={{ flex: 1, display: "grid", gap: 8 }}>
                        <input
                          value={nominee.name}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              nominees: currentNominees.map((n, i) =>
                                i === index
                                  ? { ...n, name: e.target.value }
                                  : n,
                              ),
                            }))
                          }
                          style={A.input}
                          placeholder={`Nominee ${index + 1} name`}
                          required={index === 0}
                        />
                        <input
                          value={nominee.imageUrl}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              nominees: currentNominees.map((n, i) =>
                                i === index
                                  ? { ...n, imageUrl: e.target.value }
                                  : n,
                              ),
                            }))
                          }
                          style={A.input}
                          placeholder="Photo URL (optional)"
                        />
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          <button
                            type="button"
                            style={A.ghostSmBtn}
                            onClick={() =>
                              nomineeFileRefs.current[index]?.click()
                            }
                          >
                            📱 Upload from phone
                          </button>
                          {nominee.imageUrl && (
                            <button
                              type="button"
                              style={A.ghostSmBtn}
                              onClick={() =>
                                setForm((p) => ({
                                  ...p,
                                  nominees: currentNominees.map((n, i) =>
                                    i === index ? { ...n, imageUrl: "" } : n,
                                  ),
                                }))
                              }
                            >
                              ✕ Clear photo
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        style={{
                          ...A.dangerSmBtn,
                          alignSelf: "flex-start",
                          flexShrink: 0,
                        }}
                        disabled={currentNominees.length === 1}
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            nominees: currentNominees.filter(
                              (_, i) => i !== index,
                            ),
                          }))
                        }
                      >
                        Remove
                      </button>
                      <input
                        ref={(el) => {
                          nomineeFileRefs.current[index] = el;
                        }}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) =>
                          handleNomineeFileChange(index, e.target.files?.[0])
                        }
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    style={A.addNomineeBtn}
                    disabled={currentNominees.length >= 6}
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        nominees: [
                          ...currentNominees,
                          { name: "", imageUrl: "" },
                        ].slice(0, 6),
                      }))
                    }
                  >
                    + Add Nominee
                  </button>
                </div>
              </FormField>

              <p style={A.helperText}>
                Up to 6 nominees. Paste a photo URL or use the phone picker.
              </p>
              <button type="submit" style={A.primaryBtn} disabled={saving}>
                {saving ? "Creating…" : "Create Award"}
              </button>
            </form>
          </div>

          {/* PAID ATTENDEES */}
          <div style={A.panel}>
            <div style={A.panelHead}>
              <span style={A.panelIcon}>💳</span> Paid Attendees{" "}
              <span style={A.countBadge}>{normalizedPaidTickets.length}</span>
            </div>
            <TicketList tickets={normalizedPaidTickets} type="paid" />
          </div>

          {/* CHECKED-IN */}
          <div style={A.panel}>
            <div style={A.panelHead}>
              <span style={A.panelIcon}>✅</span> Checked In{" "}
              <span style={A.countBadge}>{normalizedScannedTickets.length}</span>
            </div>
            <TicketList tickets={normalizedScannedTickets} type="scanned" />
          </div>

          {/* NOT SCANNED */}
          <div style={A.panel}>
            <div style={A.panelHead}>
              <span style={A.panelIcon}>⏳</span> Not Scanned Yet{" "}
              <span style={A.countBadge}>{normalizedUnscannedTickets.length}</span>
            </div>
            <TicketList tickets={normalizedUnscannedTickets} type="unscanned" />
          </div>

          {/* AWARDS & VOTES — full width */}
          <div style={A.panelWide}>
            <div style={A.panelHead}>
              <span style={A.panelIcon}>🏅</span> Awards & Votes{" "}
              <span style={A.countBadge}>{safeAwards.length}</span>
            </div>
            {safeAwards.length === 0 ? (
              <p style={A.empty}>
                No awards created yet. Use the form on the left to create one.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {safeAwards.map((award) => {
                  const nominees = getAwardNominees(award);
                  const totalAwardVotes =
                    Number(
                      award.totalVotes ??
                        award.votesCount ??
                        award.voteCount ??
                        0,
                    ) ||
                    nominees.reduce((t, n) => t + Number(n.voteCount || 0), 0);
                  return (
                    <div key={award.id} style={A.awardCard}>
                      {/* award header */}
                      <div style={A.awardHeader}>
                        {editingAwardId === award.id ? (
                          <div style={{ flex: 1 }}>
                            <input
                              value={awardEdits?.title || ""}
                              onChange={(e) =>
                                setAwardEdits((p) => ({
                                  ...p,
                                  title: e.target.value,
                                }))
                              }
                              style={{ ...A.input, marginBottom: 8 }}
                              placeholder="Award title"
                            />
                            <textarea
                              value={awardEdits?.description || ""}
                              onChange={(e) =>
                                setAwardEdits((p) => ({
                                  ...p,
                                  description: e.target.value,
                                }))
                              }
                              style={{
                                ...A.input,
                                ...A.textarea,
                                marginBottom: 8,
                              }}
                              rows={2}
                              placeholder="Description (optional)"
                            />
                          </div>
                        ) : (
                          <div>
                            <div style={A.awardTitle}>{award.title}</div>
                            {award.description && (
                              <div style={A.awardDesc}>{award.description}</div>
                            )}
                            <div style={A.awardMeta}>
                              {totalAwardVotes} total votes · {nominees.length}{" "}
                              nominees
                            </div>
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {editingAwardId === award.id ? (
                            <>
                              <button
                                style={A.ghostSmBtn}
                                disabled={savingAwardEdit}
                                onClick={async () => {
                                  // save
                                  try {
                                    setSavingAwardEdit(true);
                                    setError("");
                                    setSuccess("");
                                    const token =
                                      localStorage.getItem("es_token");
                                    const res = await fetch(
                                      `${API_BASE}/awards/events/${eventId}/${award.id}`,
                                      {
                                        method: "PATCH",
                                        headers: {
                                          "Content-Type": "application/json",
                                          Authorization: `Bearer ${token}`,
                                        },
                                        body: JSON.stringify({
                                          title: awardEdits.title,
                                          description: awardEdits.description,
                                        }),
                                      },
                                    );
                                    const payload = await res.json();
                                    if (!res.ok)
                                      throw new Error(
                                        payload.message ||
                                          "Failed to update award",
                                      );
                                    // replace award in data
                                    setData((prev) => {
                                      if (!prev) return prev;
                                      const newAwards = (
                                        Array.isArray(prev.awards)
                                          ? prev.awards
                                          : []
                                      ).map((a) =>
                                        a.id === award.id
                                          ? payload.data?.award || payload.data
                                          : a,
                                      );
                                      return { ...prev, awards: newAwards };
                                    });
                                    setSuccess("Award updated.");
                                    setEditingAwardId(null);
                                    setAwardEdits(null);
                                  } catch (err) {
                                    setError(err.message);
                                  } finally {
                                    setSavingAwardEdit(false);
                                  }
                                }}
                              >
                                Save
                              </button>
                              <button
                                style={A.ghostSmBtn}
                                onClick={() => {
                                  setEditingAwardId(null);
                                  setAwardEdits(null);
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                style={A.ghostSmBtn}
                                onClick={() => {
                                  setEditingAwardId(award.id);
                                  setAwardEdits({
                                    title: award.title || "",
                                    description: award.description || "",
                                  });
                                }}
                              >
                                Edit
                              </button>
                              <button
                                style={A.ghostSmBtn}
                                onClick={() => openNomineeAdd(award)}
                              >
                                + Add nominee
                              </button>
                              {/* delete button commented out; keep for future */}
                            </>
                          )}
                        </div>
                      </div>

                      {/* nominee leaderboard */}
                      {isOrganizer ? (
                        <div style={A.nomineeLeaderboard}>
                          {nominees.length === 0 ? (
                            <p style={A.empty}>No nominees.</p>
                          ) : (
                            nominees
                              .map((n) => ({
                                ...n,
                                votes:
                                  Number(n.voteCount || 0) ||
                                  countNomineeVotes(award, n),
                              }))
                              .sort((a, b) => b.votes - a.votes)
                              .map((n, rank) => {
                                const pct =
                                  totalAwardVotes > 0
                                    ? Math.round(
                                        (n.votes / totalAwardVotes) * 100,
                                      )
                                    : 0;
                                const isLeader = rank === 0 && n.votes > 0;
                                return (
                                  <div
                                    key={n.slug || n.name}
                                    style={{
                                      ...A.nomineeRow,
                                      ...(isLeader ? A.nomineeRowLeader : {}),
                                    }}
                                  >
                                    {/* rank */}
                                    <div
                                      style={{
                                        ...A.rankBadge,
                                        ...(rank < 3
                                          ? {
                                              background:
                                                [
                                                  "#fbbf24",
                                                  "#9ca3af",
                                                  "#f97316",
                                                ][rank] + "22",
                                              color: [
                                                "#fbbf24",
                                                "#9ca3af",
                                                "#f97316",
                                              ][rank],
                                            }
                                          : {}),
                                      }}
                                    >
                                      #{rank + 1}
                                    </div>
                                    {/* avatar */}
                                    {n.imageUrl ? (
                                      <img
                                        src={n.imageUrl}
                                        alt={n.name}
                                        style={A.nomineeAvatar}
                                      />
                                    ) : (
                                      <div style={A.nomineeAvatarFb}>
                                        {String(n.name)
                                          .charAt(0)
                                          .toUpperCase()}
                                      </div>
                                    )}
                                    {/* name + bar */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={A.nomineeName}>
                                        {n.name}
                                        {isLeader && (
                                          <span style={A.leaderTag}>
                                            👑 Leading
                                          </span>
                                        )}
                                      </div>
                                      <div style={A.barTrack}>
                                        <div
                                          style={{
                                            ...A.barFill,
                                            width: `${pct}%`,
                                            background: isLeader
                                              ? "#a78bfa"
                                              : "rgba(255,255,255,0.25)",
                                          }}
                                        />
                                      </div>
                                    </div>
                                    {/* vote count */}
                                    <div style={A.nomineeVotes}>
                                      <span
                                        style={{
                                          ...A.voteCount,
                                          ...(isLeader
                                            ? { color: "#a78bfa" }
                                            : {}),
                                        }}
                                      >
                                        {n.votes}
                                      </span>
                                      <span style={A.votePct}>{pct}%</span>
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      ) : (
                        <div style={A.nomineeLeaderboard}>
                          <div style={A.empty}>
                            Private Leaderboard — live leaderboard is available to the event organizer only.
                          </div>
                          {nominees.length > 0 && (
                            <div style={{ marginTop: 8, fontSize: 13, color: '#9ca3af' }}>
                              Showing static nominee counts available to co-hosts.
                            </div>
                          )}
                        </div>
                      )}

                      {/* recent votes */}
                      {(award.votes || []).length > 0 && (
                        <div style={A.recentVotes}>
                          <div style={A.recentVotesLabel}>Recent votes</div>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            {(award.votes || []).slice(0, 5).map((v, i) => (
                              <div key={i} style={A.voteChip}>
                                <strong>{v.name || v.email}</strong> →{" "}
                                {v.nominee} × {v.quantity || 1}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* NOMINEES — full width */}
          <div style={A.panelWide}>
            <div style={A.panelHead}>
              <span style={A.panelIcon}>🧿</span> Nominees{" "}
              <span style={A.countBadge}>{totalNominees}</span>
            </div>
            {totalNominees === 0 ? (
              <p style={A.empty}>No nominees yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {nomineesByAward.map((group) => (
                  <div key={group.award.id} style={A.nomineeGroup}>
                    <div style={A.nomineeGroupTitle}>{group.award.title}</div>
                    {group.nominees.length === 0 ? (
                      <p style={A.empty}>No nominees for this award.</p>
                    ) : (
                      <div style={A.nomineeGrid}>
                        {group.nominees.map((nominee, nomineeIndex) => {
                          return (
                            <div key={nominee.id} style={A.nomineeCardLg}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                }}
                              >
                                {nominee.imageUrl ? (
                                  <img
                                    src={nominee.imageUrl}
                                    alt={nominee.name}
                                    style={A.nomineeAvatarLg}
                                  />
                                ) : (
                                  <div style={A.nomineeAvatarFbLg}>
                                    {String(nominee.name || "N")
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={A.nomineeNameLg}>
                                    {nominee.name}
                                  </div>
                                  {nominee.category && (
                                    <div style={A.nomineeMeta}>
                                      {nominee.category}
                                    </div>
                                  )}
                                  <div style={A.nomineeMeta}>
                                    Votes: {nominee.voteCount || 0} · Voters:{" "}
                                    {nominee.voterCount || 0}
                                  </div>
                                </div>
                              </div>
                              <div style={A.nomineeActions}>
                                <button
                                  style={{
                                    ...A.ghostSmBtn,
                                    opacity: canManageEvent ? 1 : 0.5,
                                  }}
                                  disabled={!canManageEvent}
                                  onClick={() =>
                                    openNomineeEdit(
                                      group.award,
                                      nominee,
                                      nomineeIndex,
                                    )
                                  }
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {editingNominee && nomineeEdits && (
        <div style={A.modalOverlay}>
          <div style={A.modalCard}>
            <div style={A.modalHeader}>
              <div>
                <div style={A.modalTitle}>
                  {editingNominee.mode === "add"
                    ? "Add Nominee"
                    : "Edit Nominee"}
                </div>
                <div style={A.modalSub}>
                  Organizer and co-hosts can manage nominees for this event.
                </div>
              </div>
              <button
                style={A.ghostSmBtn}
                onClick={() => {
                  setEditingNominee(null);
                  setNomineeEdits(null);
                  setNomineeError("");
                }}
              >
                Close
              </button>
            </div>

            {nomineeError && <div style={A.errorBanner}>{nomineeError}</div>}

            <div style={A.modalBody}>
              <FormField label="Nominee Name">
                <input
                  value={nomineeEdits.name}
                  onChange={(e) =>
                    setNomineeEdits((p) => ({ ...p, name: e.target.value }))
                  }
                  style={A.input}
                />
              </FormField>
              <FormField label="Image URL">
                <input
                  value={nomineeEdits.imageUrl}
                  onChange={(e) =>
                    setNomineeEdits((p) => ({ ...p, imageUrl: e.target.value }))
                  }
                  style={A.input}
                />
              </FormField>
            </div>

            <div style={A.modalFooter}>
              <button
                style={A.ghostSmBtn}
                onClick={() => {
                  setEditingNominee(null);
                  setNomineeEdits(null);
                  setNomineeError("");
                }}
              >
                Cancel
              </button>
              <button
                style={A.accentBtn}
                disabled={savingNomineeEdit}
                onClick={handleSaveNomineeEdit}
              >
                {savingNomineeEdit
                  ? "Saving…"
                  : editingNominee.mode === "add"
                    ? "Add Nominee"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── sub-components ─── */
function Shell({ message, actionLabel, onAction }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0f0f13",
        color: "#f1f1f5",
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
        <div style={{ fontSize: 18, marginBottom: 16 }}>{message}</div>
        {onAction && (
          <button
            onClick={onAction}
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "#f1f1f5",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: "10px 22px",
              cursor: "pointer",
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: "#6b6b7a",
          textTransform: "uppercase",
          letterSpacing: ".5px",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function TicketList({ tickets, type }) {
  if (tickets.length === 0)
    return (
      <p style={A.empty}>
        {type === "paid"
          ? "No paid tickets yet."
          : type === "scanned"
            ? "No check-ins yet."
            : "No confirmed tickets waiting to scan."}
      </p>
    );
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
      {tickets.map((ticket) => (
        <div key={ticket.id} style={A.ticketRow}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={A.ticketName}>{ticket.attendeeName}</div>
            <div style={A.ticketEmail}>{ticket.attendeeEmail}</div>
            {type === "scanned" && ticket.checkedInAt && (
              <div style={A.ticketTime}>
                {new Intl.DateTimeFormat("en-NG", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(ticket.checkedInAt))}
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 5,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                ...A.chip,
                ...(type === "unscanned" ? A.chipOff : A.chipOn),
              }}
            >
              {type === "paid"
                ? "Paid"
                : type === "scanned"
                  ? "✓ Scanned"
                  : "⏳ Pending"}
            </span>
            <span style={A.ticketAmount}>
              ₦
              {Number(
                (ticket.amountPaid ?? ticket.price) || 0,
              ).toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── styles ─── */
const A = {
  page: {
    minHeight: "100vh",
    background: "#0c0c10",
    color: "#f0f0f4",
    fontFamily: "'DM Sans',system-ui,sans-serif",
    WebkitFontSmoothing: "antialiased",
  },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    padding: "20px 28px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(12,12,16,0.9)",
    position: "sticky",
    top: 0,
    zIndex: 100,
    backdropFilter: "blur(18px)",
  },
  kicker: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1.5px",
    color: "#a78bfa",
    marginBottom: 4,
  },
  pageTitle: {
    margin: 0,
    fontSize: "clamp(22px,3.5vw,36px)",
    fontWeight: 900,
    letterSpacing: "-.04em",
    color: "#f0f0f4",
  },

  main: { maxWidth: 1280, margin: "0 auto", padding: "28px 24px 80px" },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    padding: "18px 16px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b6b7a",
    marginBottom: 8,
    fontWeight: 600,
  },
  statValue: {
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: "-.04em",
    lineHeight: 1,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))",
    gap: 16,
    alignItems: "start",
  },
  panel: {
    padding: 22,
    borderRadius: 20,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  panelWide: {
    gridColumn: "1 / -1",
    padding: 22,
    borderRadius: 20,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  panelHead: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 16,
    fontWeight: 800,
    marginBottom: 16,
    color: "#f0f0f4",
  },
  panelIcon: { fontSize: 18 },
  countBadge: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: 700,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    padding: "2px 10px",
    color: "#9ca3af",
  },
  coHostBadge: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: 800,
    background: "#fef3c7",
    color: "#92400e",
    borderRadius: 8,
    padding: "6px 10px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    color: "#f0f0f4",
    padding: "11px 14px",
    fontFamily: "'DM Sans',system-ui,sans-serif",
    fontSize: 14,
    outline: "none",
  },
  textarea: { resize: "vertical" },
  helperText: { fontSize: 12, color: "#6b6b7a", margin: "-8px 0 0" },

  nomineeCard: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
  },

  primaryBtn: {
    width: "100%",
    background: "#f0f0f4",
    color: "#111",
    border: "none",
    borderRadius: 12,
    padding: "13px 0",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },
  accentBtn: {
    background: "#a78bfa",
    color: "#1a0533",
    border: "none",
    borderRadius: 999,
    padding: "9px 18px",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },
  ghostBtn: {
    background: "rgba(255,255,255,0.07)",
    color: "#f0f0f4",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 999,
    padding: "9px 18px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },
  ghostSmBtn: {
    background: "rgba(255,255,255,0.06)",
    color: "#b0b0c0",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: "7px 12px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },
  addNomineeBtn: {
    background: "rgba(167,139,250,0.1)",
    color: "#c4b5fd",
    border: "1px dashed rgba(167,139,250,0.3)",
    borderRadius: 10,
    padding: "11px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },
  dangerBtn: {
    background: "rgba(248,113,113,0.1)",
    color: "#fca5a5",
    border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: 10,
    padding: "9px 16px",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "'DM Sans',system-ui,sans-serif",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  dangerSmBtn: {
    background: "rgba(248,113,113,0.08)",
    color: "#fca5a5",
    border: "1px solid rgba(248,113,113,0.2)",
    borderRadius: 8,
    padding: "7px 12px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },

  successBanner: {
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(74,222,128,0.1)",
    color: "#86efac",
    marginBottom: 14,
    fontWeight: 700,
    fontSize: 14,
    border: "1px solid rgba(74,222,128,0.2)",
  },
  errorBanner: {
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(248,113,113,0.1)",
    color: "#fca5a5",
    marginBottom: 14,
    fontWeight: 700,
    fontSize: 14,
    border: "1px solid rgba(248,113,113,0.2)",
  },

  ticketRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  ticketName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#f0f0f4",
    marginBottom: 2,
  },
  ticketEmail: { fontSize: 12, color: "#6b6b7a" },
  ticketTime: { fontSize: 11, color: "#4ade80", marginTop: 3 },
  ticketAmount: { fontSize: 13, fontWeight: 700, color: "#ddd6fe" },
  chip: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  chipOn: { background: "rgba(74,222,128,0.12)", color: "#86efac" },
  chipOff: { background: "rgba(248,113,113,0.1)", color: "#fca5a5" },
  empty: { color: "#6b6b7a", fontSize: 14, padding: "8px 0" },

  /* award card */
  awardCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    overflow: "hidden",
  },
  awardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: "18px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
    flexWrap: "wrap",
  },
  awardTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#f0f0f4",
    marginBottom: 4,
  },
  awardDesc: { fontSize: 13, color: "#9ca3af", marginBottom: 6 },
  awardMeta: { fontSize: 12, color: "#6b6b7a", fontWeight: 600 },

  /* nominee leaderboard */
  nomineeLeaderboard: { padding: "16px 20px", display: "grid", gap: 10 },
  nomineeRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    transition: "border-color .2s",
  },
  nomineeRowLeader: {
    background: "rgba(167,139,250,0.07)",
    border: "1px solid rgba(167,139,250,0.2)",
  },
  rankBadge: {
    fontSize: 11,
    fontWeight: 800,
    color: "#6b6b7a",
    background: "rgba(255,255,255,0.07)",
    borderRadius: 6,
    padding: "3px 8px",
    flexShrink: 0,
    minWidth: 32,
    textAlign: "center",
  },
  nomineeAvatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
  },
  nomineeAvatarFb: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "rgba(167,139,250,0.15)",
    color: "#c4b5fd",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    fontSize: 15,
    flexShrink: 0,
  },
  nomineeName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#f0f0f4",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  leaderTag: {
    fontSize: 11,
    fontWeight: 700,
    color: "#a78bfa",
    background: "rgba(167,139,250,0.12)",
    borderRadius: 999,
    padding: "2px 8px",
  },
  barTrack: {
    height: 5,
    background: "rgba(255,255,255,0.07)",
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    transition: "width .6s ease",
    minWidth: 4,
  },
  nomineeVotes: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    flexShrink: 0,
    minWidth: 56,
  },
  voteCount: {
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: "-.5px",
    color: "#f0f0f4",
    lineHeight: 1,
  },
  votePct: { fontSize: 11, color: "#6b6b7a", fontWeight: 600 },

  nomineeGroup: {
    padding: 16,
    borderRadius: 14,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  nomineeGroupTitle: {
    fontSize: 15,
    fontWeight: 800,
    marginBottom: 12,
    color: "#f0f0f4",
  },
  nomineeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
    gap: 12,
  },
  nomineeCardLg: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  nomineeActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  nomineeAvatarLg: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
  },
  nomineeAvatarFbLg: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "rgba(167,139,250,0.15)",
    color: "#c4b5fd",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    fontSize: 16,
    flexShrink: 0,
  },
  nomineeNameLg: {
    fontSize: 14,
    fontWeight: 800,
    color: "#f0f0f4",
    marginBottom: 4,
  },
  nomineeMeta: { fontSize: 12, color: "#9ca3af" },
  nomineeLock: { fontSize: 11, color: "#fca5a5", fontWeight: 700 },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(5,5,8,0.7)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 120,
  },
  modalCard: {
    width: "min(680px, 100%)",
    background: "#101018",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    padding: 20,
    boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 800, color: "#f0f0f4" },
  modalSub: { fontSize: 12, color: "#9ca3af" },
  modalBody: { display: "grid", gap: 12 },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },

  recentVotes: {
    padding: "12px 20px 16px",
    borderTop: "1px solid rgba(255,255,255,0.05)",
  },
  recentVotesLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".5px",
    color: "#6b6b7a",
    marginBottom: 8,
  },
  voteChip: {
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(167,139,250,0.1)",
    color: "#ddd6fe",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid rgba(167,139,250,0.15)",
  },
};
