import { useCallback, useEffect, useState } from "react";
import { apiCall, errorMessage } from "../api";
import { openDocument } from "../openDocument";

const DOCUMENT_LABELS = {
  tin_certificate: "TIN Certificate",
  vat_certificate: "VAT Certificate",
  trade_license: "Trade License",
  restaurant_license: "Restaurant License",
};

const MAX_DOCUMENT_MB = 2;

// The four signup PDFs of a restaurant. Only its owner and the admin can load them.
// With canUpload, the owner can add the ones that are still missing.
export default function RestaurantDocuments({ restaurantId, canUpload = false }) {
  const [loaded, setLoaded] = useState({ id: null, documents: {} });
  const [picked, setPicked] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!restaurantId) return Promise.resolve();

    return apiCall(`/api/restaurant_documents/${restaurantId}/`).then(({ ok, data }) => {
      setLoaded({ id: restaurantId, documents: ok ? data.documents || {} : {} });
    });
  }, [restaurantId]);

  useEffect(() => {
    let active = true;

    if (restaurantId) {
      apiCall(`/api/restaurant_documents/${restaurantId}/`).then(({ ok, data }) => {
        if (active) {
          setLoaded({ id: restaurantId, documents: ok ? data.documents || {} : {} });
        }
      });
    }

    return () => {
      active = false;
    };
  }, [restaurantId]);

  if (!restaurantId) return null;

  const documents = loaded.id === restaurantId ? loaded.documents : {};
  const hasPicked = Object.values(picked).some(Boolean);

  const pick = (kind, file) => {
    if (file && file.size > MAX_DOCUMENT_MB * 1024 * 1024) {
      setMessage(`Each document must be ${MAX_DOCUMENT_MB} MB or smaller.`);
      return;
    }

    setMessage("");
    setPicked((previous) => ({ ...previous, [kind]: file || null }));
  };

  const upload = async () => {
    const body = new FormData();

    Object.entries(picked).forEach(([kind, file]) => {
      if (file) body.append(kind, file);
    });

    setSaving(true);
    const { ok, data } = await apiCall(`/api/upload_restaurant_documents/${restaurantId}/`, {
      method: "POST",
      body,
    });
    setSaving(false);

    if (!ok) {
      setMessage(errorMessage(data));
      return;
    }

    setPicked({});
    setMessage("Documents uploaded.");
    load();
  };

  return (
    <div className="restaurant-documents">
      <h3>Documents</h3>

      <ul>
        {Object.entries(DOCUMENT_LABELS).map(([kind, label]) => (
          <li key={kind}>
            <span>{label}</span>

            {documents[kind] ? (
              <button type="button" onClick={() => openDocument(documents[kind])}>
                View PDF
              </button>
            ) : canUpload ? (
              <input
                key={`${kind}-${hasPicked}`}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => pick(kind, event.target.files[0])}
              />
            ) : (
              <em>Not uploaded</em>
            )}
          </li>
        ))}
      </ul>

      {canUpload && Object.keys(DOCUMENT_LABELS).some((kind) => !documents[kind]) && (
        <button
          type="button"
          className="restaurant-documents-upload"
          onClick={upload}
          disabled={!hasPicked || saving}
        >
          {saving ? "Uploading..." : "Upload PDFs"}
        </button>
      )}

      {message && <p className="restaurant-documents-message">{message}</p>}
    </div>
  );
}
