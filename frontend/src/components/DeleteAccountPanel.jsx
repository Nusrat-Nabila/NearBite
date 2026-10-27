import { useState } from "react";
import { createPortal } from "react-dom";
import { apiCall, errorMessage } from "../api";
import "./DeleteAccountPanel.css";

// "Delete account" box with the Instagram-style flow: ask if they are sure, then ask for the
// name and password. The account is deleted after 30 days unless they log in again.
export default function DeleteAccountPanel({
  endpoint,
  accountName,
  onScheduled,
  className = "",
  buttonClassName = "",
  title = "Delete Account",
  description = "Your account will be deleted after 30 days. Log in again before then to keep it.",
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setStep(0);
    setName("");
    setPassword("");
    setError("");
  };

  const confirmDelete = async (event) => {
    event.preventDefault();

    if (!name.trim() || !password) {
      setError("Enter your name and password.");
      return;
    }

    setBusy(true);
    const { ok, data } = await apiCall(endpoint, {
      method: "DELETE",
      body: { name: name.trim(), password },
    });
    setBusy(false);

    if (!ok) {
      setError(errorMessage(data));
      return;
    }

    close();
    onScheduled?.(data);
  };

  return (
    <>
      <div className={className}>
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>

        <button type="button" className={buttonClassName} onClick={() => setStep(1)}>
          {title}
        </button>
      </div>

      {step > 0 &&
        createPortal(
          <div
            className="delete-account-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <form className="delete-account-modal" role="dialog" aria-modal="true" onSubmit={confirmDelete}>
              {step === 1 ? (
                <>
                  <h2>Are you sure?</h2>
                  <p>
                    Your account will be <strong>permanently deleted after 30 days</strong>. We will
                    email you. If you log in again before then, your account stays and nothing is
                    deleted.
                  </p>

                  <div className="delete-account-actions">
                    <button type="button" className="delete-account-cancel" onClick={close}>
                      No, keep my account
                    </button>

                    <button type="button" className="delete-account-danger" onClick={() => setStep(2)}>
                      Yes, continue
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2>Confirm it is you</h2>
                  <p>Type your name{accountName ? ` (${accountName})` : ""} and your password.</p>

                  <label>
                    Name
                    <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" autoFocus />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                    />
                  </label>

                  {error && <p className="delete-account-error">{error}</p>}

                  <div className="delete-account-actions">
                    <button type="button" className="delete-account-cancel" onClick={close}>
                      Cancel
                    </button>

                    <button type="submit" className="delete-account-danger" disabled={busy}>
                      {busy ? "Please wait..." : "Delete my account"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
