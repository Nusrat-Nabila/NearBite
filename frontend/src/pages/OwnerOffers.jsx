import { useCallback, useEffect, useState } from "react";
import { Plus, X, Image as ImageIcon } from "lucide-react";

import { apiCall, errorMessage, fetchAllPages } from "../api";

/* ================= CONSTANTS ================= */

const OFFER_TYPES = [
  { id: "percentage", label: "Percentage Discount" },
  { id: "bogo", label: "Buy One Get One" },
  { id: "combo", label: "Combo Offer" },
  { id: "free_item", label: "Free Item" },
  { id: "other", label: "Other" },
];

const STATUS_TABS = [
  { id: "all", label: "All Offers" },
  { id: "active", label: "Active" },
  { id: "scheduled", label: "Scheduled" },
  { id: "expired", label: "Expired" },
  { id: "paused", label: "Paused" },
];

const EMPTY_OFFER = {
  title: "",
  offerType: "percentage",
  discount: "",
  description: "",
  startDate: "",
  endDate: "",
  isActive: true,
  image: "",
  menuItems: [],
};

/* ================= HELPERS ================= */

function offerTypeLabel(type) {
  return OFFER_TYPES.find((item) => item.id === type)?.label || type;
}

// "2026-10-24" -> "24 Oct 2026"
function formatDate(value) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateRange(offer) {
  if (!offer.start_date && !offer.end_date) return "Always";

  if (offer.start_date && offer.end_date) {
    return `${formatDate(offer.start_date)} - ${formatDate(offer.end_date)}`;
  }

  return offer.start_date
    ? `From ${formatDate(offer.start_date)}`
    : `Until ${formatDate(offer.end_date)}`;
}

function readImageFile(file, onSuccess, onError) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    onError("Please select an image file.");
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    onError("Image must be smaller than 2 MB.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => onSuccess(String(reader.result || ""));
  reader.onerror = () => onError("Could not read the image.");

  reader.readAsDataURL(file);
}

async function dataUrlToFile(dataUrl, name) {
  const blob = await (await fetch(dataUrl)).blob();
  const extension = blob.type.split("/")[1] || "png";

  return { blob, filename: `${name}.${extension}` };
}

/* ================= COMPONENT ================= */

// The restaurant's daily deals: list, create, edit, pause and delete.
// menuItems: the restaurant's dishes [{ id, name }] (a deal can be put on some of them).
export default function OwnerOffers({ menuItems = [], onNotify }) {
  const [offers, setOffers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ ...EMPTY_OFFER });
  const [isSaving, setIsSaving] = useState(false);

  const notify = useCallback(
    (message) => onNotify?.(message),
    [onNotify]
  );

  /* ---------- LOAD ---------- */

  const loadOffers = useCallback(async () => {
    const rows = await fetchAllPages("/api/list_offer/");

    if (rows) setOffers(rows);

    setLoaded(true);
  }, []);

  useEffect(() => {
    let active = true;

    fetchAllPages("/api/list_offer/").then((rows) => {
      if (!active) return;

      if (rows) setOffers(rows);

      setLoaded(true);
    });

    return () => {
      active = false;
    };
  }, []);

  /* ---------- CLOSE POPUP WITH ESC ---------- */

  useEffect(() => {
    if (!modalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") setModalOpen(false);
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [modalOpen]);

  /* ---------- POPUP ---------- */

  const updateField = (field, value) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft({ ...EMPTY_OFFER });
    setModalOpen(true);
  };

  const openEdit = (offer) => {
    setEditingId(offer.id);

    setDraft({
      title: offer.deal_title || "",
      offerType: offer.offer_type || "percentage",
      discount: offer.discount_percentage ?? "",
      description: offer.description || "",
      startDate: offer.start_date || "",
      endDate: offer.end_date || "",
      isActive: offer.is_active !== false,
      image: offer.image || "",
      menuItems: offer.menu_items || [],
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setDraft({ ...EMPTY_OFFER });
  };

  const toggleDish = (dishId) => {
    setDraft((previous) => ({
      ...previous,
      menuItems: previous.menuItems.includes(dishId)
        ? previous.menuItems.filter((id) => id !== dishId)
        : [...previous.menuItems, dishId],
    }));
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    readImageFile(file, (image) => updateField("image", image), notify);

    event.target.value = "";
  };

  /* ---------- SAVE ---------- */

  const handleSave = async (event) => {
    event.preventDefault();

    if (isSaving) return;

    const title = draft.title.trim();
    const isPercentage = draft.offerType === "percentage";
    const discount = Number(draft.discount);

    if (!title) {
      notify("Please enter a deal title.");
      return;
    }

    if (
      isPercentage &&
      (!Number.isInteger(discount) || discount < 1 || discount > 100)
    ) {
      notify("Please enter a discount from 1 to 100 percent.");
      return;
    }

    if (
      draft.startDate &&
      draft.endDate &&
      draft.endDate < draft.startDate
    ) {
      notify("End date cannot be before the start date.");
      return;
    }

    setIsSaving(true);

    try {
      const form = new FormData();

      form.append("deal_title", title);
      form.append("offer_type", draft.offerType);
      form.append("discount_percentage", isPercentage ? String(discount) : "");
      form.append("description", draft.description.trim());
      form.append("start_date", draft.startDate);
      form.append("end_date", draft.endDate);
      form.append("is_active", String(draft.isActive));

      const current = offers.find((offer) => offer.id === editingId);

      if (draft.image.startsWith("data:")) {
        const { blob, filename } = await dataUrlToFile(draft.image, "deal");

        form.append("image", blob, filename);
      } else if (!draft.image && current?.image) {
        form.append("image", "");
      }

      const wasAdding = editingId === null;

      const saved = await apiCall(
        wasAdding ? "/api/create_offer/" : `/api/update_offer/${editingId}/`,
        { method: wasAdding ? "POST" : "PUT", body: form }
      );

      if (!saved.ok) {
        notify(errorMessage(saved.data));
        return;
      }

      // The dishes are sent on their own: a list in a JSON body can also be emptied.
      const offerId = wasAdding ? saved.data.data.id : editingId;

      if (!wasAdding || draft.menuItems.length > 0) {
        const dishes = await apiCall(`/api/update_offer/${offerId}/`, {
          method: "PUT",
          body: { menu_items: draft.menuItems },
        });

        if (!dishes.ok) {
          notify(errorMessage(dishes.data));
          await loadOffers();
          return;
        }
      }

      closeModal();

      notify(
        wasAdding
          ? "Offer created successfully."
          : "Offer updated successfully."
      );

      await loadOffers();
    } finally {
      setIsSaving(false);
    }
  };

  /* ---------- PAUSE / RESUME / DELETE ---------- */

  const togglePause = async (offer) => {
    const { ok, data } = await apiCall(`/api/update_offer/${offer.id}/`, {
      method: "PUT",
      body: { is_active: !offer.is_active },
    });

    if (!ok) {
      notify(errorMessage(data));
      return;
    }

    notify(offer.is_active ? "Offer paused." : "Offer resumed.");

    await loadOffers();
  };

  const deleteOffer = async (offer) => {
    if (!window.confirm(`Delete the offer "${offer.deal_title}"?`)) return;

    const { ok, data } = await apiCall(`/api/delete_offer/${offer.id}/`, {
      method: "DELETE",
    });

    if (!ok) {
      notify(errorMessage(data));
      return;
    }

    notify("Offer deleted successfully.");

    await loadOffers();
  };

  /* ---------- LIST ---------- */

  const visibleOffers = offers.filter(
    (offer) => statusFilter === "all" || offer.status === statusFilter
  );

  const dishName = (dishId) =>
    menuItems.find((dish) => dish.id === dishId)?.name;

  const dishSummary = (offer) => {
    const names = (offer.menu_items || [])
      .map(dishName)
      .filter(Boolean);

    if (names.length === 0) return "-";

    return names.length > 2
      ? `${names.slice(0, 2).join(", ")} +${names.length - 2}`
      : names.join(", ");
  };

  /* ================= UI ================= */

  return (
    <section className="owner-content-card owner-menu-card-new">
      <div className="owner-menu-top-actions">
        <button
          type="button"
          className="owner-primary-button"
          onClick={openCreate}
        >
          <Plus size={16} />
          Create New Offer
        </button>
      </div>

      {/* STATUS TABS */}

      <div className="owner-menu-toolbar">
        <div className="owner-offer-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={statusFilter === tab.id ? "active" : ""}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="owner-offer-count">
          Showing {visibleOffers.length} of {offers.length}
        </span>
      </div>

      {/* OFFERS TABLE */}

      <div className="owner-menu-table-scroll">
        <table className="owner-menu-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Deal</th>
              <th>Type</th>
              <th>Discount</th>
              <th>Dates</th>
              <th>Dishes</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {visibleOffers.length === 0 ? (
              <tr>
                <td colSpan={8} className="owner-menu-empty">
                  {!loaded
                    ? "Loading offers..."
                    : offers.length === 0
                    ? "You have no offers yet. Create your first one."
                    : "No offers found."}
                </td>
              </tr>
            ) : (
              visibleOffers.map((offer) => (
                <tr key={offer.id}>
                  <td>
                    <div className="owner-menu-thumbnail">
                      {offer.image ? (
                        <img src={offer.image} alt={offer.deal_title} />
                      ) : (
                        <ImageIcon size={22} />
                      )}
                    </div>
                  </td>

                  <td>
                    <strong>{offer.deal_title}</strong>
                  </td>

                  <td>{offerTypeLabel(offer.offer_type)}</td>

                  <td>
                    {offer.discount_percentage
                      ? `${offer.discount_percentage}%`
                      : "-"}
                  </td>

                  <td>{dateRange(offer)}</td>

                  <td>{dishSummary(offer)}</td>

                  <td>
                    <span
                      className={`owner-offer-status ${offer.status}`}
                    >
                      • {offer.status}
                    </span>
                  </td>

                  <td>
                    <div className="owner-menu-table-actions">
                      <button
                        type="button"
                        className="owner-menu-edit"
                        onClick={() => openEdit(offer)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="owner-offer-pause"
                        onClick={() => togglePause(offer)}
                      >
                        {offer.is_active ? "Pause" : "Resume"}
                      </button>

                      <button
                        type="button"
                        className="owner-menu-delete"
                        onClick={() => deleteOffer(offer)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ================= CREATE / EDIT POPUP ================= */}

      {modalOpen && (
        <div
          className="owner-food-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            className="owner-food-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-offer-modal-title"
          >
            <div className="owner-food-modal-heading">
              <h2 id="owner-offer-modal-title">
                {editingId === null ? "Create New Offer" : "Edit Offer"}
              </h2>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Close popup"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="owner-food-modal-layout">
                {/* IMAGE */}

                <div className="owner-food-modal-image-column">
                  <div className="owner-food-modal-image">
                    {draft.image ? (
                      <img src={draft.image} alt="Offer preview" />
                    ) : (
                      <ImageIcon size={60} />
                    )}
                  </div>

                  <label className="owner-food-modal-upload">
                    Change Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      hidden
                    />
                  </label>

                  {draft.image && (
                    <button
                      type="button"
                      className="owner-food-modal-cancel"
                      onClick={() => updateField("image", "")}
                    >
                      Remove Image
                    </button>
                  )}
                </div>

                {/* DETAILS */}

                <div className="owner-food-modal-fields">
                  <label>
                    <span>
                      Deal Title <em>*</em>
                    </span>

                    <input
                      type="text"
                      value={draft.title}
                      onChange={(event) =>
                        updateField("title", event.target.value)
                      }
                      placeholder="e.g. Weekend Burger Deal"
                      maxLength={200}
                      required
                    />
                  </label>

                  <div className="owner-food-modal-two-col">
                    <label>
                      <span>
                        Offer Type <em>*</em>
                      </span>

                      <select
                        value={draft.offerType}
                        onChange={(event) =>
                          updateField("offerType", event.target.value)
                        }
                      >
                        {OFFER_TYPES.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {draft.offerType === "percentage" && (
                      <label>
                        <span>
                          Discount (%) <em>*</em>
                        </span>

                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={draft.discount}
                          onChange={(event) =>
                            updateField("discount", event.target.value)
                          }
                          placeholder="20"
                        />
                      </label>
                    )}
                  </div>

                  <div className="owner-food-modal-two-col">
                    <label>
                      <span>Start Date</span>

                      <input
                        type="date"
                        value={draft.startDate}
                        onChange={(event) =>
                          updateField("startDate", event.target.value)
                        }
                      />
                    </label>

                    <label>
                      <span>End Date</span>

                      <input
                        type="date"
                        value={draft.endDate}
                        onChange={(event) =>
                          updateField("endDate", event.target.value)
                        }
                      />
                    </label>
                  </div>

                  <label>
                    <span>Description</span>

                    <textarea
                      rows={3}
                      value={draft.description}
                      onChange={(event) =>
                        updateField("description", event.target.value)
                      }
                      placeholder="Describe your offer..."
                    />
                  </label>

                  <div className="owner-choice-group">
                    <span className="owner-choice-title">
                      Dishes on this offer (optional)
                    </span>

                    {menuItems.length === 0 ? (
                      <p className="owner-choice-empty">
                        Add dishes in Manage Menu first.
                      </p>
                    ) : (
                      <div className="owner-choice-list">
                        {menuItems.map((dish) => (
                          <label key={dish.id} className="owner-choice">
                            <input
                              type="checkbox"
                              checked={draft.menuItems.includes(dish.id)}
                              onChange={() => toggleDish(dish.id)}
                            />
                            {dish.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <fieldset className="owner-food-modal-availability">
                    <legend>Status</legend>

                    <label>
                      <input
                        type="radio"
                        name="offerActive"
                        checked={draft.isActive}
                        onChange={() => updateField("isActive", true)}
                      />
                      On
                    </label>

                    <label>
                      <input
                        type="radio"
                        name="offerActive"
                        checked={!draft.isActive}
                        onChange={() => updateField("isActive", false)}
                      />
                      Paused
                    </label>
                  </fieldset>
                </div>
              </div>

              <div className="owner-food-modal-footer">
                <button
                  type="button"
                  className="owner-food-modal-cancel"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="owner-primary-button"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Saving..."
                    : editingId === null
                    ? "Create Offer"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
